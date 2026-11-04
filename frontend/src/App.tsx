import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Alert, LinearProgress, Slider } from '@mui/material'
import { ChevronDown, CloudRain, Info, Navigation, Pause, Play } from 'lucide-react'
import { ApiError, localDateTime, request } from './api'
import { copy, fmt, riskNames, routeNumber, timeAt, type Language } from './i18n'
import type { Analysis, Checkpoint, Layer, Location, MapView, Trip } from './types'
import { RISK_COLORS } from './types'
import TripForm from './components/TripForm'
import RouteComparison, { RecommendationBanner } from './components/RouteComparison'
import JourneyDetails from './components/JourneyDetails'
import DetailsDialog from './components/DetailsDialog'
const RouteMap = lazy(() => import('./components/RouteMap'))
const CHICAGO: Location = {
  name: 'Chicago, Illinois, United States',
  latitude: 41.8781,
  longitude: -87.6298,
  timezone: 'America/Chicago',
}
const DETROIT: Location = {
  name: 'Detroit, Michigan, United States',
  latitude: 42.3314,
  longitude: -83.0458,
  timezone: 'America/Detroit',
}
export default function App() {
  const lang: Language = 'en'
  const [origin, setOrigin] = useState<Location | null>(CHICAGO)
  const [destination, setDestination] = useState<Location | null>(DETROIT)
  const [departure, setDeparture] = useState(localDateTime)
  const [load, setLoad] = useState('28000')
  const [spacing, setSpacing] = useState(25)
  const [mode, setMode] = useState<'live' | 'demo'>('live')
  const [data, setData] = useState<Analysis | null>(null)
  const [selected, setSelected] = useState('route-1')
  const [point, setPoint] = useState<Checkpoint | null>(null)
  const [mapView, setMapView] = useState<MapView>('arrival')
  const [hour, setHour] = useState(0)
  const [layer, setLayer] = useState<Layer>('risk')
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reassessing, setReassessing] = useState(false)
  const [error, setError] = useState('')
  const [retryUntil, setRetryUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [lastBase, setLastBase] = useState('')
  const [dialog, setDialog] = useState<'method' | 'points' | null>(null)
  const followRecommendation = useRef(true)
  const activeRequest = useRef<AbortController | null>(null)
  const throttledMessage = useRef('')
  const latest = useRef({ lang, selected, point })
  latest.current = { lang, selected, point }
  const t = copy[lang]
  const baseSignature = JSON.stringify([mode, origin, destination, departure, spacing])
  const loadNumber = Number(load)
  const loadValid =
    load.trim() !== '' && Number.isFinite(loadNumber) && loadNumber >= 0 && loadNumber <= 200000
  const dirty = !!data && baseSignature !== lastBase
  const selectedRoute = data?.routes.find((route) => route.id === selected)
  const retrySeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000))
  const zone = data?.origin.timezone ?? 'UTC'
  useEffect(() => {
    document.documentElement.lang = 'en'
    document.title = 'Wayfinder - Weather-aware routing'
  }, [])
  function showError(error: unknown) {
    const current = copy[latest.current.lang]
    if (error instanceof ApiError && error.retryAfter > 0) {
      setRetryUntil(Date.now() + error.retryAfter * 1000)
      setNow(Date.now())
      const message = `You can check live weather again in ${error.retryAfter} seconds. Your current results are kept.`
      throttledMessage.current = message
      setError(message)
    } else if (error instanceof ApiError && error.status === 410) setError(current.errorExpired)
    else if (error instanceof ApiError && error.status === 400) setError(error.message)
    else setError(current.errorNetwork)
  }
  async function analyze(nextMode = mode) {
    if (
      (nextMode !== 'demo' && (!origin || !destination)) ||
      !loadValid ||
      !Number.isFinite(new Date(departure).getTime())
    )
      return
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setLoading(true)
    setReassessing(false)
    setError('')
    setPlaying(false)
    const tripOrigin = nextMode === 'demo' ? CHICAGO : origin!
    const tripDestination = nextMode === 'demo' ? DETROIT : destination!
    if (nextMode === 'demo') {
      setOrigin(CHICAGO)
      setDestination(DETROIT)
    }
    setMode(nextMode)
    const signature = JSON.stringify([nextMode, tripOrigin, tripDestination, departure, spacing])
    const trip: Trip = {
      mode: nextMode,
      origin: tripOrigin,
      destination: tripDestination,
      departure: new Date(departure).toISOString(),
      load_lb: loadNumber,
      spacing_miles: spacing,
    }
    try {
      const result = await request<Analysis>('/api/analyze/', {
        method: 'POST',
        body: JSON.stringify(trip),
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      setData(result)
      setLastBase(signature)
      setSelected(result.recommendation.route_id ?? result.routes[0].id)
      followRecommendation.current = true
      setPoint(null)
      setHour(0)
      setMapView('arrival')
    } catch (error) {
      if (!controller.signal.aborted) showError(error)
    } finally {
      if (activeRequest.current === controller) setLoading(false)
    }
  }
  useEffect(() => {
    if (!data || loading || lastBase !== baseSignature || !loadValid || data.load_lb === loadNumber)
      return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setReassessing(true)
      setError('')
      request<Analysis>('/api/reassess/', {
        method: 'POST',
        body: JSON.stringify({ analysis_id: data.analysis_id, load_lb: loadNumber }),
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return
          setData(result)
          if (followRecommendation.current)
            setSelected(result.recommendation.route_id ?? latest.current.selected)
          const nextSelected = followRecommendation.current
            ? (result.recommendation.route_id ?? latest.current.selected)
            : latest.current.selected
          setPoint((previous) =>
            previous
              ? (result.routes
                  .find((route) => route.id === nextSelected)
                  ?.checkpoints.find((cp) => cp.id === previous.id) ?? null)
              : null,
          )
        })
        .catch((error) => {
          if (!controller.signal.aborted) showError(error)
        })
        .finally(() => {
          if (!controller.signal.aborted) setReassessing(false)
        })
    }, 450)
    return () => {
      clearTimeout(timer)
      controller.abort()
      setReassessing(false)
    }
    // Data identity is deliberately excluded: only cargo and trip identity trigger reassessment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.analysis_id, data?.load_lb, lastBase, baseSignature, loadNumber, loadValid, loading])
  useEffect(() => {
    if (!playing || mapView !== 'forecast') return
    const timer = setInterval(() => setHour((value) => (value < 48 ? value + 1 : 0)), 800)
    return () => clearInterval(timer)
  }, [playing, mapView])
  useEffect(() => {
    if (retryUntil <= Date.now()) return
    const timer = setInterval(() => {
      const instant = Date.now()
      setNow(instant)
      if (instant >= retryUntil) {
        clearInterval(timer)
        setRetryUntil(0)
        setError((current) => (current === throttledMessage.current ? '' : current))
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [retryUntil])
  function selectRoute(id: string) {
    followRecommendation.current = false
    setSelected(id)
    setPoint(null)
  }
  function selectPoint(cp: Checkpoint) {
    followRecommendation.current = false
    setPoint(cp)
    setMapView('arrival')
    setPlaying(false)
  }
  function editLocation(setter: (value: Location | null) => void, value: Location | null) {
    setter(value)
    setMode('live')
  }
  return (
    <div className="app">
      <header className="topbar">
        <a href="#main" className="wordmark">
          <span className="brand-mark">
            <Navigation size={19} fill="currentColor" />
          </span>
          wayfinder<span className="wordmark-dot">.</span>
        </a>
        <span className="breadcrumb">Weather-aware routing</span>
        <button className="help-button" onClick={() => setDialog('method')}>
          <Info size={16} /> Risk rules
        </button>
      </header>
      <main id="main" className="workspace">
        <div className="planner-layout">
          <div className="form-column">
            <TripForm
              lang={lang}
              origin={origin}
              destination={destination}
              departure={departure}
              load={load}
              spacing={spacing}
              mode={mode}
              loading={loading}
              reassessing={reassessing}
              loadValid={loadValid}
              retrySeconds={retrySeconds}
              onOrigin={(value) => editLocation(setOrigin, value)}
              onDestination={(value) => editLocation(setDestination, value)}
              onDeparture={setDeparture}
              onLoad={setLoad}
              onSpacing={setSpacing}
              onSubmit={() => void analyze()}
              onExample={() => void analyze('demo')}
              onLive={() => void analyze('live')}
              onCancel={() => {
                activeRequest.current?.abort()
                setLoading(false)
              }}
            />
          </div>
          <div className="results-column" aria-busy={loading || reassessing}>
            {error && (
              <Alert severity="warning" onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            {dirty && !reassessing && (
              <div className="stale-note" role="status">
                Trip changed. Compare routes to update these results.
              </div>
            )}
            {(loading || reassessing) && (
              <div className="analysis-progress" role="status">
                <span>{reassessing ? t.loadUpdating : t.analyzing}</span>
                <LinearProgress />
              </div>
            )}
            {data && <RecommendationBanner data={data} lang={lang} />}
            {data && (
              <RouteComparison data={data} selected={selected} lang={lang} onSelect={selectRoute} />
            )}
            <section className="map-panel" aria-label="Route weather map">
              <div className="map-topline">
                <div>
                  <h2>
                    {data
                      ? `${data.origin.name.split(',')[0]} → ${data.destination.name.split(',')[0]}`
                      : 'Weather along your route'}
                  </h2>
                  <span className="map-subtitle">
                    {data
                      ? `${t.route} ${routeNumber(data, selected)} · ${mapView === 'arrival' ? 'Forecast at your arrival time' : 'Hourly area forecast'}`
                      : 'Compare routes to see the weather ahead.'}
                  </span>
                </div>
                {data && (
                  <span className={`data-badge ${data.mode === 'live' ? 'live' : ''}`}>
                    <i />
                    {data.mode === 'live' ? 'Live forecast' : 'Simulated weather'}
                  </span>
                )}
              </div>
              {data && (
                <div className="map-toolbar">
                  <div className="map-view-switch" aria-label="Weather view">
                    <button
                      aria-pressed={mapView === 'arrival'}
                      className={mapView === 'arrival' ? 'active' : ''}
                      onClick={() => {
                        setMapView('arrival')
                        setPlaying(false)
                      }}
                    >
                      Along the route
                    </button>
                    <button
                      aria-pressed={mapView === 'forecast'}
                      className={mapView === 'forecast' ? 'active' : ''}
                      onClick={() => setMapView('forecast')}
                    >
                      48-hour forecast
                    </button>
                  </div>
                  <button className="text-button" onClick={() => setDialog('points')}>
                    Weather details <ChevronDown size={14} />
                  </button>
                </div>
              )}
              <div
                className={`map-stage ${mapView === 'arrival' ? 'arrival-view' : 'forecast-view'}`}
              >
                <Suspense fallback={<div className="map-loading">{t.mapLoading}</div>}>
                  <RouteMap
                    data={data}
                    selected={selected}
                    hour={hour}
                    layer={layer}
                    heatVisible={!!data && mapView === 'forecast'}
                    view={mapView}
                    lang={lang}
                    focusedPoint={point}
                    onSelect={selectRoute}
                    onCheckpoint={selectPoint}
                  />
                </Suspense>
                {!data && (
                  <div className="map-empty glass">
                    <CloudRain size={25} />
                    <h2>Find the better route for your load.</h2>
                    <p>Enter your trip to compare driving time and weather risk.</p>
                  </div>
                )}
                {data && mapView === 'forecast' && (
                  <>
                    <div className="map-top-overlay">
                      <div className="map-layer-selector glass" aria-label="Forecast layer">
                        {(['risk', 'wind', 'rain', 'snow'] as Layer[]).map((value) => (
                          <button
                            key={value}
                            className={value === layer ? 'active' : ''}
                            aria-pressed={value === layer}
                            onClick={() => setLayer(value)}
                          >
                            {value === 'risk' ? 'Risk' : t[value]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="timeline glass">
                      <div className="timeline-heading">
                        <strong>
                          {timeAt(data.forecast_reference_epoch + hour * 3600, zone, lang, true)}
                        </strong>
                        <span>
                          +{hour}h · {zone}
                        </span>
                      </div>
                      <div className="timeline-controls">
                        <button
                          className="play-button"
                          aria-label={playing ? t.pause : t.play}
                          onClick={() => setPlaying((value) => !value)}
                        >
                          {playing ? (
                            <Pause size={15} fill="currentColor" />
                          ) : (
                            <Play size={15} fill="currentColor" />
                          )}
                        </button>
                        <div className="slider-wrap">
                          <Slider
                            value={hour}
                            min={0}
                            max={48}
                            step={1}
                            onChange={(_, value) => {
                              setHour(value as number)
                              setPlaying(false)
                            }}
                            aria-label="Forecast hour"
                            getAriaValueText={(value) => `+${value} h`}
                          />
                          <div className="timeline-ticks">
                            {[0, 12, 24, 36, 48].map((value) => (
                              <span key={value}>+{value}h</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="timeline-note">
                        Area forecast only. Your trip and recommendation stay the same.
                      </p>
                    </div>
                    <div className="heat-legend glass">
                      <span>
                        {layer === 'risk'
                          ? 'Risk'
                          : `${t[layer]} ${layer === 'wind' ? '(mph)' : '(in/h)'}`}{' '}
                        · relative intensity
                      </span>
                      <span>Lower</span>
                      <i />
                      <span>Higher</span>
                    </div>
                  </>
                )}
                {data && selectedRoute && point && mapView === 'arrival' && (
                  <JourneyDetails
                    data={data}
                    route={selectedRoute}
                    point={point}
                    lang={lang}
                    onPoint={selectPoint}
                    onClose={() => setPoint(null)}
                  />
                )}
              </div>
              {data && (
                <div className="map-footer">
                  {mapView === 'arrival' ? (
                    <div className="risk-legend" aria-label="Road risk at arrival">
                      {riskNames[lang].map((name, risk) => (
                        <span key={name}>
                          <i style={{ background: RISK_COLORS[risk] }} />
                          {name}
                        </span>
                      ))}
                      {selectedRoute && !selectedRoute.summary.complete && (
                        <span>
                          <i style={{ background: '#84909b' }} />
                          Unknown
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="forecast-help">
                      The same hour across the corridor. Select an area for exact values.
                    </p>
                  )}
                  {selectedRoute && (
                    <span className="arrival-summary">
                      Arrive{' '}
                      {timeAt(data.departure_epoch + selectedRoute.duration_seconds, zone, lang)} ·{' '}
                      {zone}
                    </span>
                  )}
                </div>
              )}
            </section>
            {data?.routes.some((route) => !route.summary.complete) && (
              <Alert severity="warning">{t.dataWarning}</Alert>
            )}
            <div className="results-footnote">
              {data && (
                <details className="data-details">
                  <summary>Trip &amp; data sources</summary>
                  <p>
                    {timeAt(data.departure_epoch, zone, lang, true)} · {fmt(data.load_lb, lang)} lb
                    cargo · weather every {data.spacing_miles} mi.
                  </p>
                  <p>
                    {data.routing_provider} · {data.weather_provider}. {t.noStops}
                  </p>
                  {data.notices.map((notice) => (
                    <p key={notice}>{notice}</p>
                  ))}
                </details>
              )}
              <p className="routing-limit">
                {data?.routing_provider.toLowerCase().includes('tomtom')
                  ? 'Driving time excludes breaks.'
                  : 'Car-profile routes. Truck clearance and legal access are not verified.'}
              </p>
            </div>
          </div>
        </div>
        <footer className="page-footer">
          <span>
            Weather by{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>{' '}
            · OpenStreetMap / OSRM · OpenFreeMap
          </span>
        </footer>
      </main>
      <DetailsDialog
        kind={dialog}
        data={data}
        route={selectedRoute}
        lang={lang}
        onClose={() => setDialog(null)}
        onPoint={selectPoint}
      />
    </div>
  )
}
