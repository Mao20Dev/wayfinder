export type Location = { name: string; latitude: number; longitude: number; timezone: string }
export type Weather = {
  wind_mph: number | null
  rain_in_hr: number | null
  snow_in_hr: number | null
  weather_hour_epoch: number | null
}
export type Checkpoint = {
  id: string
  coordinates: [number, number]
  mile: number
  eta_epoch: number
  weather: Weather
  risk: number | null
  risk_label: string
  complete: boolean
  factors: Record<string, number | null>
}
export type Route = {
  id: string
  coordinates: [number, number][]
  distance_miles: number
  duration_seconds: number
  via_comparison_point: boolean
  checkpoints: Checkpoint[]
  summary: {
    miles_by_risk: number[]
    unknown_miles: number
    average_risk: number | null
    eligible: boolean
    complete: boolean
    status: 'ready' | 'blocked' | 'incomplete'
    max_risk: number | null
  }
}
export type CorridorCell = {
  id: number
  coordinates: [number, number]
  bounds: [number, number, number, number]
  hours: (Weather & { risk: number | null; complete: boolean })[]
}
export type Analysis = {
  mode: 'live' | 'demo'
  origin: Location
  destination: Location
  departure_epoch: number
  generated_epoch: number
  forecast_reference_epoch: number
  load_lb: number
  spacing_miles: number
  routes: Route[]
  corridor: CorridorCell[]
  routing_provider: string
  weather_provider: string
  recommendation: { route_id: string | null; tied_route_ids: string[]; reason: string }
  notices: string[]
}
export type Trip = {
  mode: 'live' | 'demo'
  origin: Location
  destination: Location
  departure: string
  load_lb: number
  spacing_miles: number
}
export type Layer = 'risk' | 'wind' | 'rain' | 'snow'
export const RISK_LABELS = ['Low', 'Moderate', 'High', 'Severe', 'No Travel']
export const RISK_COLORS = ['#28846c', '#d1a32e', '#e58d3c', '#d35b54', '#922f54']
export const ROUTE_COLORS = ['#1b7768', '#6680b0', '#aa83ac']
