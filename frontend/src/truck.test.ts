import { describe, expect, it } from 'vitest'
import { EMPTY_TRUCK, parseTruck } from './truck'
import { truckGpx } from './maps'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { TripActions } from './components/TripActions'
import type { Analysis, Route } from './types'

const input = {
  empty_weight_lb: '32000',
  height_ft: '13.5',
  width_ft: '8.5',
  length_ft: '70',
  max_axle_weight_lb: '17000',
  axles: '5',
  non_hazardous: true,
}
describe('Truck routing and navigation boundaries', () => {
  it('requires actual measurements and coherent axle weights', () => {
    expect(parseTruck(EMPTY_TRUCK, 28000)).toBeNull()
    expect(parseTruck({ ...input, non_hazardous: false }, 28000)).toBeNull()
    expect(parseTruck({ ...input, axles: '2.5' }, 28000)).toBeNull()
    expect(parseTruck({ ...input, max_axle_weight_lb: '100' }, 28000)).toBeNull()
    expect(parseTruck(input, 28000)?.height_ft).toBe(13.5)
  })
  it('exports the complete track and the truck profile without implying navigation enforcement', () => {
    const gpx = truckGpx(
      [
        [-87, 41],
        [-85, 42],
        [-83, 42],
      ],
      parseTruck(input, 28000)!,
      28000,
    )
    expect(gpx.match(/<trkpt /g)).toHaveLength(3)
    expect(gpx).toContain('60000 lb gross')
    expect(gpx).toContain('GPX does not enforce access restrictions')
    expect(gpx).toContain('lat="41" lon="-87"')
  })
  it('never hands truck navigation to Google Maps or enables demo exports', () => {
    const route = { summary: { eligible: true } } as Route
    const data = {
      mode: 'demo',
      routing_profile: 'weather_demo',
      departure_epoch: 1000,
      origin: { timezone: 'UTC' },
    } as Analysis
    const demo = renderToStaticMarkup(
      createElement(TripActions, { data, route, busy: false, onSave() {} }),
    )
    expect(demo).not.toContain('href=')
    expect(demo).not.toContain('Start trip')
    expect(demo).toMatch(/disabled=""[^>]*>.*?Export GPX/)
    const truck = renderToStaticMarkup(
      createElement(TripActions, {
        data: {
          ...data,
          mode: 'live',
          routing_profile: 'truck',
          vehicle: parseTruck(input, 28000),
        },
        route,
        busy: false,
        onSave() {},
      }),
    )
    expect(truck).toContain('GPX does not enforce restrictions')
    expect(truck).not.toContain('href=')
  })
})
