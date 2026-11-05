import { describe, expect, it } from 'vitest'
import { EMPTY_TRUCK, exampleTruck, parseTruck } from './truck'
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
  it('starts with a usable example and updates its stated axle assumption with cargo', () => {
    expect(parseTruck(exampleTruck(28000), 28000)).toEqual(parseTruck(input, 28000))
    expect(parseTruck(exampleTruck(45000), 45000)?.max_axle_weight_lb).toBe(21817)
  })
  it('requires actual measurements and coherent axle weights', () => {
    expect(parseTruck(EMPTY_TRUCK, 28000)).toBeNull()
    expect(parseTruck({ ...input, non_hazardous: false }, 28000)).toBeNull()
    expect(parseTruck({ ...input, axles: '2.5' }, 28000)).toBeNull()
    expect(parseTruck({ ...input, max_axle_weight_lb: '100' }, 28000)).toBeNull()
    expect(parseTruck(input, 28000)?.height_ft).toBe(13.5)
  })
  it('hands selected route anchors to Maps and leaves unknown or blocked routes disabled', () => {
    const route = {
      summary: { eligible: true },
      coordinates: [
        [-87, 41],
        [-83, 42],
      ],
      distance_miles: 100,
      checkpoints: [0, 25, 50, 75, 100].map((mile) => ({
        mile,
        coordinates: [-87 + mile / 25, 41 + mile / 100],
      })),
    } as Route
    const data = {
      mode: 'demo',
      routing_profile: 'weather_demo',
      departure_epoch: 1000,
      origin: { timezone: 'UTC' },
    } as Analysis
    const demo = renderToStaticMarkup(
      createElement(TripActions, { data, route, busy: false, onSave() {} }),
    )
    expect(demo).toContain('Open in Google Maps')
    expect(demo).not.toContain('dir_action=navigate')
    expect(demo).not.toContain('GPX')
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
    expect(truck).toContain('dir_action=navigate')
    expect(truck).toContain('waypoints=')
    expect(truck).toContain('truck settings are not transferred')
    const blocked = renderToStaticMarkup(
      createElement(TripActions, {
        data,
        route: { ...route, summary: { ...route.summary, eligible: false } },
        busy: false,
        onSave() {},
      }),
    )
    expect(blocked).not.toContain('href=')
    expect(blocked).toContain('disabled')
  })
})
