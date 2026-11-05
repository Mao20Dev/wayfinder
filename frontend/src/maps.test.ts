import { describe, expect, it, vi } from 'vitest'
import { googleMapsUrl, readSavedTrips, routeDirections, saveTrip } from './maps'
import { exampleTruck, parseTruck } from './truck'
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
  it('preserves a saved truck route and its Maps guide points after reload', () => {
    const data = {
      origin: { name: 'Chicago' },
      destination: { name: 'Detroit' },
      routes: [route],
      departure_epoch: 1000,
      load_lb: 28000,
      vehicle: parseTruck(exampleTruck(28000), 28000),
      vehicle_source: 'example',
      routing_profile: 'truck',
      vehicle_brand: 'Volvo',
    } as Analysis
    const saved = saveTrip(data, route, [])
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(saved) })
    try {
      const restored = readSavedTrips()
      expect(restored).toHaveLength(1)
      expect(restored[0].vehicleBrand).toBe('Volvo')
      expect(googleMapsUrl(restored[0].directions)).toBe(googleMapsUrl(routeDirections(route)))
    } finally {
      vi.unstubAllGlobals()
    }
  })
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
