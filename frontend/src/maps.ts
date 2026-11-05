import type { Analysis, Route, Truck } from './types'
import { EMPTY_TRUCK, parseTruck, TRUCK_FIELDS, type TruckInputs } from './truck'

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
  profile?: 'truck' | 'weather_demo'
  vehicle?: Truck | null
  coordinates?: Coordinate[]
  eligible?: boolean
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

export function truckGpx(coordinates: Coordinate[], vehicle: Truck, cargo: number) {
  const points = coordinates.map(([lon, lat]) => `<trkpt lat="${lat}" lon="${lon}"/>`).join('')
  const description = `Truck: ${vehicle.height_ft} ft high, ${vehicle.width_ft} ft wide, ${vehicle.length_ft} ft long; ${vehicle.empty_weight_lb + cargo} lb gross; ${vehicle.max_axle_weight_lb} lb maximum axle weight; ${vehicle.axles} axles. Non-hazardous cargo. Planning track only: configure this vehicle in a truck navigator and recheck restrictions before driving. GPX does not enforce access restrictions.`
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Wayfinder" xmlns="http://www.topografix.com/GPX/1/1"><metadata><desc>${description}</desc></metadata><trk><name>Wayfinder truck planning track</name><trkseg>${points}</trkseg></trk></gpx>`
}

export function downloadTruckGpx(coordinates: Coordinate[], vehicle: Truck, cargo: number) {
  const url = URL.createObjectURL(
    new Blob([truckGpx(coordinates, vehicle, cargo)], { type: 'application/gpx+xml' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'wayfinder-truck-route.gpx'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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
  if (trip.eligible !== undefined && typeof trip.eligible !== 'boolean') return false
  if (trip.profile !== undefined && !['truck', 'weather_demo'].includes(trip.profile)) return false
  if (trip.profile === 'truck') {
    if (!trip.vehicle || !trip.coordinates || trip.vehicle.non_hazardous !== true) return false
    const fields: TruckInputs = { ...EMPTY_TRUCK, non_hazardous: true }
    for (const field of TRUCK_FIELDS) {
      const value = trip.vehicle[field.key]
      if (typeof value !== 'number') return false
      fields[field.key] = String(value)
    }
    if (!parseTruck(fields, trip.load)) return false
  }
  if (trip.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: trip.timezone }).format()
    } catch {
      return false
    }
  }
  return (
    (trip.coordinates === undefined ||
      (Array.isArray(trip.coordinates) &&
        trip.coordinates.length >= 2 &&
        trip.coordinates.length <= 100000 &&
        trip.coordinates.every(validCoordinate))) &&
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
      trip.profile === data.routing_profile &&
      JSON.stringify(trip.vehicle) === JSON.stringify(data.vehicle) &&
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
      profile: data.routing_profile,
      vehicle: data.vehicle,
      coordinates: data.routing_profile === 'truck' ? route.coordinates : undefined,
      eligible: route.summary?.eligible ?? false,
    },
    ...previous,
  ]
}
