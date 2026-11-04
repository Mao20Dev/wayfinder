import type { Analysis, Route } from './types'

type Coordinate = [number, number]
export type Directions = { origin: Coordinate; destination: Coordinate; waypoints: Coordinate[] }
export type SavedTrip = {
  id: string
  originName: string
  destinationName: string
  routeName: string
  departure: number
  timezone?: string
  load: number
  savedAt: number
  directions: Directions
}
const STORAGE_KEY = 'wayfinder-saved-trips-v1'

export function routeDirections(route: Route): Directions {
  const origin = route.coordinates[0]
  const destination = route.coordinates[route.coordinates.length - 1]
  const waypoints: Coordinate[] = []
  for (const fraction of [0.25, 0.5, 0.75]) {
    const point = route.checkpoints.reduce((best, candidate) =>
      Math.abs(candidate.mile - route.distance_miles * fraction) <
      Math.abs(best.mile - route.distance_miles * fraction)
        ? candidate
        : best,
    )
    if (
      point.mile > 0 &&
      point.mile < route.distance_miles &&
      !waypoints.some(
        (coordinates) =>
          coordinates[0] === point.coordinates[0] && coordinates[1] === point.coordinates[1],
      )
    )
      waypoints.push(point.coordinates)
  }
  return { origin, destination, waypoints }
}

export function googleMapsUrl(directions: Directions, navigate = false) {
  const coordinate = ([longitude, latitude]: Coordinate) =>
    `${latitude.toFixed(5)},${longitude.toFixed(5)}`
  const parameters = new URLSearchParams({
    api: '1',
    origin: coordinate(directions.origin),
    destination: coordinate(directions.destination),
    travelmode: 'driving',
  })
  if (directions.waypoints.length)
    parameters.set('waypoints', directions.waypoints.slice(0, 3).map(coordinate).join('|'))
  if (navigate) parameters.set('dir_action', 'navigate')
  return `https://www.google.com/maps/dir/?${parameters}`
}

function validCoordinate(value: unknown): value is Coordinate {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((number) => typeof number === 'number' && Number.isFinite(number)) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  )
}
function validSavedTrip(value: unknown): value is SavedTrip {
  if (!value || typeof value !== 'object') return false
  const trip = value as SavedTrip
  if (trip.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: trip.timezone }).format()
    } catch {
      return false
    }
  }
  return (
    [trip.id, trip.originName, trip.destinationName, trip.routeName].every(
      (text) => typeof text === 'string' && text.length < 300,
    ) &&
    [trip.departure, trip.load, trip.savedAt].every(
      (number) => typeof number === 'number' && Number.isFinite(number),
    ) &&
    !!trip.directions &&
    validCoordinate(trip.directions.origin) &&
    validCoordinate(trip.directions.destination) &&
    Array.isArray(trip.directions.waypoints) &&
    trip.directions.waypoints.length <= 3 &&
    trip.directions.waypoints.every(validCoordinate)
  )
}
export function readSavedTrips(): SavedTrip[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(validSavedTrip).slice(0, 10) : []
  } catch {
    return []
  }
}
export function writeSavedTrips(trips: SavedTrip[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips))
}
export function saveTrip(data: Analysis, route: Route, previous: SavedTrip[]): SavedTrip[] {
  const directions = routeDirections(route)
  const duplicate = previous.some(
    (trip) =>
      trip.departure === data.departure_epoch &&
      trip.load === data.load_lb &&
      googleMapsUrl(trip.directions) === googleMapsUrl(directions),
  )
  if (duplicate) return previous
  if (previous.length >= 10)
    throw new Error('You have 10 saved trips. Remove one before saving another.')
  return [
    {
      id: crypto.randomUUID(),
      originName: data.origin.name,
      destinationName: data.destination.name,
      routeName: `Route ${data.routes.findIndex((option) => option.id === route.id) + 1}`,
      departure: data.departure_epoch,
      timezone: data.origin.timezone,
      load: data.load_lb,
      savedAt: Date.now(),
      directions,
    },
    ...previous,
  ]
}
