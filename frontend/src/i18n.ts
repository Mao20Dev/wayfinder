import type { Analysis, Checkpoint, Route } from './types'

export type Language = 'es' | 'en'
export const copy = {
  es: {
    planner: 'Planificador de rutas',
    how: 'Cómo calculamos el riesgo',
    language: 'Idioma',
    eyebrow: 'EL CLIMA TAMBIÉN ES PARTE DEL CAMINO',
    title: 'Elige una ruta con el clima a favor.',
    intro: 'Dinos tu viaje. Comparamos las carreteras y el tiempo que encontrarás al pasar.',
    step1: '1. Tu viaje',
    step2: '2. Compara las rutas',
    step3: 'EL CLIMA EN TU CAMINO',
    liveMode: 'Mi viaje real',
    demoMode: 'Ejemplo guiado',
    demoBanner: 'Estás explorando un ejemplo con clima simulado.',
    demoDescription:
      'Las carreteras son reales; el clima se generó para probar las reglas. Cambia la carga o la salida y observa el resultado.',
    startLive: 'Planificar mi viaje',
    origin: 'Origen',
    destination: 'Destino',
    swap: 'Intercambiar',
    departure: 'Fecha y hora de salida',
    localTime: 'Hora de tu equipo',
    cargo: 'Peso de la carga',
    cargoHelp: 'Sólo la carga, sin incluir el peso del vehículo.',
    sampling: 'Consultar el clima cada…',
    samplingHelp: 'Son puntos de consulta en la carretera, no paradas del camión.',
    detail: 'Más detalle',
    balanced: 'Equilibrado',
    fewer: 'Menos consultas',
    analyze: 'Comparar rutas',
    simulate: 'Actualizar ejemplo',
    analyzing: 'Buscando rutas y pronósticos…',
    loadUpdating: 'Actualizando el riesgo de la carga…',
    loadUpdated: 'El cambio de carga usa el mismo pronóstico, sin nuevas consultas.',
    waitHelp:
      'Un viaje nuevo puede tardar unos segundos. Conservamos tus resultados mientras tanto.',
    demoRoute: 'El ejemplo recorre Chicago → Detroit. Puedes probar distintas salidas y cargas.',
    cargoError: 'Introduce una carga entre 0 y 200.000 lb.',
    cityHint: 'Busca una ciudad y selecciónala en la lista.',
    changed: 'El viaje cambió. Compara de nuevo para actualizar las rutas y el clima.',
    showingPrevious: 'Mostrando el último viaje analizado',
    route: 'Ruta',
    recommended: 'Recomendada',
    alternative: 'Alternativa',
    blocked: 'No viajar',
    incomplete: 'Sin datos completos',
    exposure: 'Exposición estimada',
    severe: 'Severo',
    high: 'Alto',
    average: 'Riesgo promedio',
    distance: 'Distancia',
    driving: 'Conducción',
    coverage: 'Cobertura del pronóstico',
    comparisonPoint: 'Desvío por punto intermedio',
    why: 'Por qué recomendamos esta ruta',
    none: 'No podemos recomendar una ruta con los datos actuales.',
    noneHelp:
      'Las rutas con «No viajar» o datos meteorológicos incompletos quedan fuera de la recomendación.',
    arrival: 'Clima durante el viaje',
    forecast: 'Explorar próximas 48 h',
    arrivalHelp:
      'La carretera muestra el riesgo previsto cuando llegues a cada tramo. La zona usa la hora de paso del punto de consulta más cercano.',
    forecastHelp:
      'Toda la zona muestra la misma hora. Explorar este mapa no cambia tu salida ni la recomendación.',
    weather: 'Riesgo',
    wind: 'Viento',
    rain: 'Lluvia',
    snow: 'Nieve',
    risk: 'Riesgo',
    roadLegend: 'Riesgo de la carretera al pasar',
    regionLegend: 'Pronóstico de la zona',
    unknown: 'Sin datos',
    lower: 'Menor',
    higher: 'Mayor',
    smooth: 'Intensidad relativa · capa suavizada',
    forecastTime: 'Hora del pronóstico',
    reference: 'Hora base',
    clickMap: 'Toca un punto o una etiqueta para ver el clima y la regla aplicada.',
    points: 'Ver puntos de clima',
    close: 'Cerrar',
    arrivalTime: 'Llegada estimada',
    atMile: 'A la altura de',
    ruleApplied: 'Por qué tiene este riesgo',
    pointDetail: 'Clima al pasar por este punto',
    pointHelp:
      'Este pronóstico corresponde a tu hora de llegada, no a la hora del mapa exploratorio.',
    nextPoint: 'Siguiente punto',
    previousPoint: 'Punto anterior',
    tableHelp:
      'Cada fila es una consulta meteorológica sobre la ruta. Las horas se muestran en la zona del origen.',
    mile: 'Milla',
    noStops: 'Los tiempos de conducción no incluyen descansos.',
    source: 'Datos',
    carProfile:
      'Las rutas actuales usan un perfil de automóvil. No verifican altura, peso bruto ni acceso legal para camiones.',
    dataWarning: 'Faltan algunos pronósticos. Lo desconocido no se considera seguro.',
    mapUnavailable:
      'No se pudo cargar el mapa. Puedes seguir comparando rutas en las tarjetas y la tabla.',
    mapLoading: 'Preparando el mapa…',
    zoomIn: 'Acercar',
    zoomOut: 'Alejar',
    fit: 'Ver todas las rutas',
    perspective: 'Vista en perspectiva',
    overlay: 'Mostrar capa meteorológica',
    play: 'Reproducir pronóstico',
    pause: 'Pausar pronóstico',
    methodTitle: 'De los datos a una recomendación',
    rulesTitle: 'Reglas de riesgo del ejercicio',
    rulesIntro:
      'Se usa la condición más peligrosa del punto. La carga puede elevar el riesgo por viento.',
    boundaries:
      'En los extremos compartidos de lluvia y nieve elegimos la categoría superior, salvo los límites explícitos de «No viajar». Es un supuesto documentado.',
    loadRules: 'Reglas adicionales por carga',
    wind55: 'Viento ≥55 mph: no viajar con ninguna carga.',
    wind45: 'Viento de 45 a <55 mph y carga >30.000 lb: no viajar.',
    wind35: 'Viento de 35 a <45 mph y carga >40.000 lb: riesgo severo.',
    exactLoads: 'Exactamente 30.000 o 40.000 lb no activa su respectiva condición estricta.',
    rankTitle: 'Cómo se elige una ruta',
    rankText:
      'Primero se excluyen las rutas con No viajar o datos incompletos. Después se compara, en este orden: millas severas, millas altas, promedio ponderado por distancia y duración.',
    approximation:
      'La exposición es una estimación: cada tramo usa el mayor riesgo de sus dos extremos. No representa la extensión exacta de una tormenta.',
    noTravelMiles: 'No viajar',
    adjustedCargo: 'El riesgo incluye la regla de carga.',
    graphTitle: 'Clima a lo largo del viaje',
    graphHelp: 'La posición sigue las millas de carretera; cada punto usa su hora de llegada.',
    loadingEmpty: 'Estamos preparando las opciones de tu viaje.',
    retry: 'Volver a intentar',
    errorNetwork: 'No pudimos completar la consulta. Comprueba la conexión e inténtalo otra vez.',
    errorExpired: 'El pronóstico guardado venció. Compara el viaje de nuevo para actualizarlo.',
    cancel: 'Cancelar consulta',
    viewResults: 'Ver resultados',
    more: 'Detalles y proveedores',
    criteria:
      'Prioridad: menos millas severas → menos millas altas → menor promedio → menos tiempo.',
  },
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
      'The road shows the risk when you reach each segment. Nearby weather uses the arrival time of the closest weather checkpoint.',
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
  es: ['Bajo', 'Moderado', 'Alto', 'Severo', 'No viajar'],
  en: ['Low', 'Moderate', 'High', 'Severe', 'No Travel'],
}
export const fmt = (value: number | null | undefined, lang: Language, digits = 0) =>
  value == null
    ? '—'
    : value.toLocaleString(lang === 'es' ? 'es-CO' : 'en-US', {
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
  return lang === 'es' ? String(value).replace('.', ',') : String(value)
}
export const timeAt = (epoch: number, zone: string, lang: Language, date = false) =>
  new Intl.DateTimeFormat(lang === 'es' ? 'es-CO' : 'en-US', {
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
  if (decision.criterion === 'tie')
    return lang === 'es'
      ? 'Las rutas destacadas empatan en los cuatro criterios. Puedes elegir cualquiera de ellas.'
      : 'The highlighted routes tie on all four criteria. You can choose either.'
  if (decision.criterion === 'only_eligible')
    return lang === 'es'
      ? `La ruta ${n} es la única con pronóstico completo y sin tramos de «No viajar».`
      : `Route ${n} is the only option with complete weather and no No Travel segments.`
  const value =
    advantage > 0 && advantage < 0.01
      ? '<0.01'
      : fmt(advantage, lang, decision.criterion === 'average_risk' ? 2 : 1)
  const descriptions: Record<string, string> =
    lang === 'es'
      ? {
          severe_miles: `${value} millas menos de riesgo severo`,
          high_miles: `${value} millas menos de riesgo alto`,
          average_risk: `un riesgo promedio ${value} menor, al empatar en millas severas y altas`,
          duration_seconds: `un tiempo menor de conducción, al empatar en los tres criterios de riesgo`,
        }
      : {
          severe_miles: `${value} fewer Severe miles`,
          high_miles: `${value} fewer High miles`,
          average_risk: `an average risk ${value} lower, after tying on Severe and High miles`,
          duration_seconds: `a shorter drive after tying on all three risk criteria`,
        }
  return lang === 'es'
    ? `Frente a la siguiente opción elegible, la ruta ${other}, ofrece ${descriptions[decision.criterion]}.`
    : `Compared with the next eligible option, Route ${other}, it has ${descriptions[decision.criterion]}.`
}

export function pointExplanation(cp: Checkpoint, load: number, lang: Language) {
  const w = cp.weather
  const es = lang === 'es'
  if (cp.cargo_rule === 'wind_55')
    return es
      ? `Viento de ${weatherNumber(w.wind_mph, 'wind', lang)} mph: desde 55 mph se indica no viajar con ninguna carga.`
      : `${weatherNumber(w.wind_mph, 'wind', lang)} mph wind: 55+ mph means No Travel for any load.`
  if (cp.cargo_rule === 'wind_45_load_30000')
    return es
      ? `Viento de ${weatherNumber(w.wind_mph, 'wind', lang)} mph con ${fmt(load, lang)} lb de carga. Supera 30.000 lb en el rango de 45–<55 mph: no viajar.`
      : `${weatherNumber(w.wind_mph, 'wind', lang)} mph wind with ${fmt(load, lang)} lb cargo. Above 30,000 lb at 45–<55 mph means No Travel.`
  if (cp.cargo_rule === 'wind_35_load_40000' && cp.risk === 3)
    return es
      ? `La carga supera 40.000 lb con viento de 35–<45 mph. La regla eleva el riesgo de alto a severo.`
      : 'Cargo exceeds 40,000 lb with 35–<45 mph wind. The load rule raises High risk to Severe.'
  if (cp.risk === null)
    return es
      ? 'Faltan datos para evaluar este punto. No se considera seguro por defecto.'
      : 'Missing data prevents a full assessment. This point is not assumed safe.'
  const drivers = cp.drivers
    .map((key) =>
      key === 'wind'
        ? `${copy[lang].wind.toLowerCase()} ${weatherNumber(w.wind_mph, 'wind', lang)} mph`
        : key === 'rain'
          ? `${copy[lang].rain.toLowerCase()} ${weatherNumber(w.rain_in_hr, 'rain', lang)} in/h`
          : `${copy[lang].snow.toLowerCase()} ${weatherNumber(w.snow_in_hr, 'snow', lang)} in/h`,
    )
    .join(' · ')
  return es
    ? `La condición que determina el nivel ${riskNames.es[cp.risk].toLowerCase()} es: ${drivers}.`
    : `The condition determining ${riskNames.en[cp.risk]} risk is: ${drivers}.`
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

export function initialLanguage(): Language {
  try {
    return localStorage.getItem('wayfinder-language') === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

export function slowestExtra(route: Route, data: Analysis) {
  return (route.duration_seconds - Math.min(...data.routes.map((r) => r.duration_seconds))) / 60
}
