import { describe, expect, it } from 'vitest'
import { googleMapsUrl, routeDirections, saveTrip } from './maps'
import type { Analysis, Route } from './types'
const route = {
  id: 'route-2',
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
describe('Google Maps handoff', () => {
  it('uses latitude,longitude, ordered route anchors and navigation intent', () => {
    const url = new URL(googleMapsUrl(routeDirections(route), true))
    expect(url.origin).toBe('https://www.google.com')
    expect(url.searchParams.get('origin')).toBe('41.00000,-87.00000')
    expect(url.searchParams.get('waypoints')?.split('|')).toHaveLength(3)
    expect(url.searchParams.get('dir_action')).toBe('navigate')
    expect(url.searchParams.get('travelmode')).toBe('driving')
  })
  it('does not imply navigation when opening a saved route preview', () => {
    expect(new URL(googleMapsUrl(routeDirections(route))).searchParams.has('dir_action')).toBe(
      false,
    )
  })
  it('saves a trip snapshot without pretending to save into a Google account', () => {
    const data = {
      origin: { name: 'Chicago' },
      destination: { name: 'Detroit' },
      routes: [route],
      departure_epoch: 1000,
      load_lb: 28000,
    } as Analysis
    const saved = saveTrip(data, route, [])
    expect(saved[0].directions.waypoints).toHaveLength(3)
    expect(saved[0].departure).toBe(1000)
    expect(saveTrip(data, route, saved)).toBe(saved)
    expect(saved[0]).not.toHaveProperty('weather')
  })
})
