import type { Analysis, Checkpoint, Route } from './types'
export type Language = 'en'
export const copy = {
  en: {
    planner: 'Route planner',
    how: 'How risk is calculated',
    language: 'Language',
    eyebrow: 'WEATHER IS PART OF THE JOURNEY',
    title: 'Know the weather before the road.',
    intro: 'Tell us your trip. Compare roads and the weather you will meet along the way.',
    step1: '1. Your trip',
    step2: '2. Compare routes',
    step3: 'WEATHER ALONG YOUR ROAD',
    liveMode: 'My real trip',
    demoMode: 'Guided example',
    demoBanner: 'You are exploring an example with simulated weather.',
    demoDescription:
      'Roads are real; weather is generated to exercise the rules. Change the cargo or departure and see what happens.',
    startLive: 'Plan my trip',
    origin: 'Origin',
    destination: 'Destination',
    swap: 'Swap locations',
    departure: 'Departure date and time',
    localTime: 'Your device time',
    cargo: 'Cargo weight',
    cargoHelp: 'Cargo only, excluding the vehicle tare weight.',
    sampling: 'Check weather every…',
    samplingHelp: 'These are weather lookup points on the road, not truck stops.',
    detail: 'More detail',
    balanced: 'Balanced',
    fewer: 'Fewer requests',
    analyze: 'Compare routes',
    simulate: 'Update example',
    analyzing: 'Finding routes and forecasts…',
    loadUpdating: 'Updating cargo risk…',
    loadUpdated: 'Cargo changes reuse the same forecast, without new provider calls.',
    waitHelp: 'A new trip can take a few seconds. We keep your current results while you wait.',
    demoRoute: 'The example travels Chicago → Detroit. Try different departures and cargo weights.',
    cargoError: 'Enter a cargo weight between 0 and 200,000 lb.',
    cityHint: 'Search for a city and choose it from the list.',
    changed: 'Trip inputs changed. Compare again to update the routes and weather.',
    showingPrevious: 'Showing the last analyzed trip',
    route: 'Route',
    recommended: 'Recommended',
    alternative: 'Alternative',
    blocked: 'No Travel',
    incomplete: 'Incomplete weather',
    exposure: 'Estimated exposure',
    severe: 'Severe',
    high: 'High',
    average: 'Average risk',
    distance: 'Distance',
    driving: 'Driving',
    coverage: 'Forecast coverage',
    comparisonPoint: 'Detour via a comparison waypoint',
    why: 'Why we recommend this route',
    none: 'We cannot recommend a route with the current data.',
    noneHelp: 'Routes with No Travel or incomplete weather are excluded from recommendation.',
    arrival: 'Weather during your trip',
    forecast: 'Explore next 48 hours',
    arrivalHelp:
      'The road shows estimated weather risk when you reach each segment. Select a point for its forecast and arrival time.',
    forecastHelp:
      'The whole area shows a single forecast hour. Exploring this map does not change your departure or recommendation.',
    weather: 'Risk',
    wind: 'Wind',
    rain: 'Rain',
    snow: 'Snow',
    risk: 'Risk',
    roadLegend: 'Road risk at arrival',
    regionLegend: 'Area forecast',
    unknown: 'Unknown',
    lower: 'Lower',
    higher: 'Higher',
    smooth: 'Relative intensity · smoothed overlay',
    forecastTime: 'Forecast time',
    reference: 'Reference',
    clickMap: 'Select a point or weather label to see the forecast and applied rule.',
    points: 'View weather points',
    close: 'Close',
    arrivalTime: 'Estimated arrival',
    atMile: 'At mile',
    ruleApplied: 'Why this risk applies',
    pointDetail: 'Weather as you pass this point',
    pointHelp: 'This forecast is for your arrival time, independent of the exploratory map hour.',
    nextPoint: 'Next point',
    previousPoint: 'Previous point',
    tableHelp: 'Each row is a weather lookup on the road. Times use the origin time zone.',
    mile: 'Mile',
    noStops: 'Driving times do not include breaks.',
    source: 'Data',
    carProfile:
      'Current routes use a car profile. Truck height, gross weight and legal access are not checked.',
    dataWarning: 'Some forecasts are missing. Unknown conditions are not considered safe.',
    mapUnavailable: 'The map could not load. Route cards and the weather table remain available.',
    mapLoading: 'Preparing the map…',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit all routes',
    perspective: 'Perspective view',
    overlay: 'Show weather overlay',
    play: 'Play forecast',
    pause: 'Pause forecast',
    methodTitle: 'From forecasts to a recommendation',
    rulesTitle: 'Assessment risk rules',
    rulesIntro:
      'The most severe condition determines the point risk. Cargo can increase the wind risk.',
    boundaries:
      'Shared rain and snow boundaries belong to the higher category, except the explicit No Travel limits. This is a documented assumption.',
    loadRules: 'Additional cargo rules',
    wind55: 'Wind ≥55 mph: No Travel for any load.',
    wind45: 'Wind 45–<55 mph and cargo >30,000 lb: No Travel.',
    wind35: 'Wind 35–<45 mph and cargo >40,000 lb: Severe.',
    exactLoads: 'Exactly 30,000 or 40,000 lb does not activate its respective strict override.',
    rankTitle: 'How a route is chosen',
    rankText:
      'First exclude routes with No Travel or incomplete weather. Then compare, in order: Severe miles, High miles, distance-weighted average risk and driving time.',
    approximation:
      'Exposure is estimated: each interval takes the higher risk of its endpoints. It is not the exact extent of a storm.',
    noTravelMiles: 'No Travel',
    adjustedCargo: 'Risk includes the cargo rule.',
    graphTitle: 'Weather along your journey',
    graphHelp: 'Position follows road miles; each point uses its own arrival time.',
    loadingEmpty: 'Preparing your trip options.',
    retry: 'Try again',
    errorNetwork: 'We could not complete the request. Check your connection and try again.',
    errorExpired: 'The saved forecast expired. Compare your trip again to refresh it.',
    cancel: 'Cancel request',
    viewResults: 'View results',
    more: 'Details and providers',
    criteria: 'Priority: fewer Severe miles → fewer High miles → lower average → shorter time.',
  },
}
export const riskNames = {
  en: ['Low', 'Moderate', 'High', 'Severe', 'No Travel'],
}
export const fmt = (value: number | null | undefined, _lang: Language, digits = 0) =>
  value == null
    ? '—'
    : value.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
export function weatherNumber(
  value: number | null,
  kind: string,
  lang: Language,
  precision?: number,
) {
  if (value === null) return '—'
  const thresholds =
    (
      { wind: [25, 35, 45, 55], rain: [0.1, 0.25, 0.5, 1], snow: [0.5, 1, 2, 3] } as Record<
        string,
        number[]
      >
    )[kind] ?? []
  // Extra decimals near a boundary prevent e.g. 34.96 mph looking like 35 mph
  // while the correctly calculated risk still belongs to the lower band.
  for (let digits = precision ?? (kind === 'wind' ? 1 : 2); digits <= 10; digits++) {
    const rounded = Number(value.toFixed(digits))
    if (
      thresholds.every((boundary) => Math.sign(rounded - boundary) === Math.sign(value - boundary))
    )
      return fmt(value, lang, digits)
  }
  return String(value)
}
export const timeAt = (epoch: number, zone: string, _lang: Language, date = false) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
    ...(date ? { day: 'numeric', month: 'short' } : {}),
  }).format(epoch * 1000)
export const routeNumber = (data: Analysis, id: string) =>
  data.routes.findIndex((route) => route.id === id) + 1
export function recommendationText(data: Analysis, lang: Language) {
  const decision = data.recommendation.decision
  const t = copy[lang]
  const n = data.recommendation.route_id ? routeNumber(data, data.recommendation.route_id) : 0
  const other = decision.comparison_route_id ? routeNumber(data, decision.comparison_route_id) : 0
  const advantage = decision.advantage ?? 0
  if (!n) return t.noneHelp
  if (decision.criterion === 'tie') return 'The recommended routes tie on risk and driving time.'
  if (decision.criterion === 'only_eligible')
    return `Route ${n} is the only option with complete weather and no No Travel segments.`
  const value =
    advantage > 0 && advantage < 0.01
      ? '<0.01'
      : fmt(advantage, lang, decision.criterion === 'average_risk' ? 2 : 1)
  const descriptions: Record<string, string> = {
    severe_miles: `${value} fewer Severe miles`,
    high_miles: `${value} fewer High miles`,
    average_risk: `Average risk is ${value} lower, with equal Severe and High exposure`,
    duration_seconds: `A shorter drive, with equal weather risk`,
  }
  return decision.criterion === 'severe_miles' || decision.criterion === 'high_miles'
    ? `${descriptions[decision.criterion]} than Route ${other}.`
    : `Compared with Route ${other}: ${descriptions[decision.criterion]}.`
}
export function pointExplanation(cp: Checkpoint, load: number, lang: Language) {
  const w = cp.weather
  if (cp.cargo_rule === 'wind_55')
    return `${weatherNumber(w.wind_mph, 'wind', lang)} mph wind: 55+ mph means No Travel for any load.`
  if (cp.cargo_rule === 'wind_45_load_30000')
    return `${weatherNumber(w.wind_mph, 'wind', lang)} mph wind with ${fmt(load, lang)} lb cargo. Above 30,000 lb at 45–<55 mph means No Travel.`
  if (cp.cargo_rule === 'wind_35_load_40000' && cp.risk === 3)
    return 'Cargo exceeds 40,000 lb with 35–<45 mph wind. The load rule raises High risk to Severe.'
  if (cp.risk === null)
    return 'Missing data prevents a full assessment. This point is not assumed safe.'
  const drivers = cp.drivers
    .map((key) =>
      key === 'wind'
        ? `${copy[lang].wind.toLowerCase()} ${weatherNumber(w.wind_mph, 'wind', lang)} mph`
        : key === 'rain'
          ? `${copy[lang].rain.toLowerCase()} ${weatherNumber(w.rain_in_hr, 'rain', lang)} in/h`
          : `${copy[lang].snow.toLowerCase()} ${weatherNumber(w.snow_in_hr, 'snow', lang)} in/h`,
    )
    .join(' · ')
  return `The condition determining ${riskNames.en[cp.risk]} risk is: ${drivers}.`
}
export function dominantWeather(cp: Checkpoint) {
  if (cp.drivers.includes('wind') && (cp.risk ?? 0) >= 1)
    return { kind: 'wind', value: cp.weather.wind_mph, unit: 'mph' }
  if (cp.weather.snow_in_hr != null && cp.weather.snow_in_hr > 0)
    return { kind: 'snow', value: cp.weather.snow_in_hr, unit: 'in/h' }
  if (cp.weather.rain_in_hr != null && cp.weather.rain_in_hr > 0)
    return { kind: 'rain', value: cp.weather.rain_in_hr, unit: 'in/h' }
  return { kind: 'wind', value: cp.weather.wind_mph, unit: 'mph' }
}
export function slowestExtra(route: Route, data: Analysis) {
  return (route.duration_seconds - Math.min(...data.routes.map((r) => r.duration_seconds))) / 60
}
