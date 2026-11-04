import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Alert, Button, LinearProgress, Slider } from '@mui/material'
import {
  ArrowRight,
  CheckCheck,
  ChevronDown,
  Clock3,
  CloudRain,
  FlaskConical,
  Info,
  Navigation,
  Pause,
  Play,
  ShieldCheck,
  Wind,
} from 'lucide-react'
import { ApiError, duration, localDateTime, request } from './api'
import { copy, fmt, initialLanguage, riskNames, routeNumber, timeAt, type Language } from './i18n'
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
  const [lang, setLang] = useState<Language>(initialLanguage)
  const [origin, setOrigin] = useState<Location | null>(CHICAGO)
  const [destination, setDestination] = useState<Location | null>(DETROIT)
  const [departure, setDeparture] = useState(localDateTime)
  const [load, setLoad] = useState('28000')
  const [spacing, setSpacing] = useState(25)
  const [mode, setMode] = useState<'live' | 'demo'>('demo')
  const [data, setData] = useState<Analysis | null>(null)
  const [selected, setSelected] = useState('route-1')
  const [point, setPoint] = useState<Checkpoint | null>(null)
  const [mapView, setMapView] = useState<MapView>('arrival')
  const [hour, setHour] = useState(0)
  const [layer, setLayer] = useState<Layer>('risk')
  const [heatVisible, setHeatVisible] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reassessing, setReassessing] = useState(false)
  const [error, setError] = useState('')
  const [retryUntil, setRetryUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [lastBase, setLastBase] = useState('')
  const [dialog, setDialog] = useState<'method' | 'points' | null>(null)
  const initialized = useRef(false)
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
  const dirty = !!data && (baseSignature !== lastBase || !loadValid || loadNumber !== data.load_lb)
  const selectedRoute = data?.routes.find((route) => route.id === selected)
  const retrySeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000))
  const zone = data?.origin.timezone ?? 'UTC'

  useEffect(() => {
    document.documentElement.lang = lang
    document.title =
      lang === 'es' ? 'Wayfinder · Clima en tu ruta' : 'Wayfinder · Weather along your route'
    try {
      localStorage.setItem('wayfinder-language', lang)
    } catch {
      /* Storage is optional. */
    }
  }, [lang])

  function showError(error: unknown) {
    const current = copy[latest.current.lang]
    if (error instanceof ApiError && error.retryAfter > 0) {
      setRetryUntil(Date.now() + error.retryAfter * 1000)
      setNow(Date.now())
      const message =
        latest.current.lang === 'es'
          ? `Puedes volver a consultar clima real en ${error.retryAfter} segundos. Tus resultados actuales se conservan.`
          : `You can check live weather again in ${error.retryAfter} seconds. Your current results are kept.`
      throttledMessage.current = message
      setError(message)
    } else if (error instanceof ApiError && error.status === 410) setError(current.errorExpired)
    else if (error instanceof ApiError && error.status === 400) setError(error.message)
    else setError(current.errorNetwork)
  }

  async function analyze(nextMode = mode) {
    if (!origin || !destination || !loadValid || !Number.isFinite(new Date(departure).getTime()))
      return
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setLoading(true)
    setReassessing(false)
    setError('')
    setPlaying(false)
    const signature = JSON.stringify([nextMode, origin, destination, departure, spacing])
    const trip: Trip = {
      mode: nextMode,
      origin,
      destination,
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
    if (!initialized.current) {
      initialized.current = true
      void analyze('demo')
    }
    // Only the initial example is automatic; journey changes need an explicit run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  function switchMode(value: 'live' | 'demo') {
    setMode(value)
    setError('')
    if (value === 'demo') {
      setOrigin(CHICAGO)
      setDestination(DETROIT)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <a href="#main" className="wordmark">
          <span className="brand-mark">
            <Navigation size={20} fill="currentColor" />
          </span>
          wayfinder<span className="wordmark-dot">.</span>
        </a>
        <span className="header-divider" />
        <span className="breadcrumb">{t.planner}</span>
        <div className="header-right">
          <button className="help-button" onClick={() => setDialog('method')}>
            <Info size={16} />
            <span>{t.how}</span>
          </button>
          <div className="language-switch" aria-label={t.language}>
            {(['es', 'en'] as Language[]).map((value) => (
              <button
                key={value}
                className={lang === value ? 'active' : ''}
                aria-pressed={lang === value}
                onClick={() => setLang(value)}
              >
                {value.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main id="main" className="workspace">
        <section className="page-heading">
          <div>
            <span className="eyebrow">
              <i />
              {t.eyebrow}
            </span>
            <h1>{t.title}</h1>
            <p>{t.intro}</p>
          </div>
          <span className="assessment-label">
            Spotter · {lang === 'es' ? 'Prueba técnica' : 'Assessment'}
          </span>
        </section>
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
              dirty={dirty}
              retrySeconds={retrySeconds}
              onOrigin={setOrigin}
              onDestination={setDestination}
              onDeparture={setDeparture}
              onLoad={setLoad}
              onSpacing={setSpacing}
              onMode={switchMode}
              onSubmit={() => void analyze()}
              onCancel={() => {
                activeRequest.current?.abort()
                setLoading(false)
              }}
            />
            <div className="provider-note">
              <ShieldCheck size={17} />
              <p>{t.carProfile}</p>
            </div>
            <button className="method-link" onClick={() => setDialog('method')}>
              <Info size={15} />
              {t.how}
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="results-column" aria-busy={loading || reassessing}>
            {data?.mode === 'demo' && (
              <div className="demo-banner">
                <FlaskConical size={21} />
                <div>
                  <strong>{t.demoBanner}</strong>
                  <p>{t.demoDescription}</p>
                </div>
                {mode === 'demo' && (
                  <button onClick={() => switchMode('live')} disabled={loading}>
                    {t.startLive}
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
            {error && (
              <Alert severity="warning" onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            {dirty && !reassessing && (
              <div className="stale-note">
                <Info size={15} />
                <span>
                  {t.showingPrevious}. {t.changed}
                </span>
              </div>
            )}
            {(loading || reassessing) && (
              <div className="analysis-progress" role="status">
                <span>{reassessing ? t.loadUpdating : t.analyzing}</span>
                <LinearProgress />
                <small>{reassessing ? t.loadUpdated : t.waitHelp}</small>
              </div>
            )}
            {data ? (
              <RecommendationBanner data={data} lang={lang} />
            ) : (
              <div className="empty-state">
                <CloudRain size={28} />
                <h2>{t.loadingEmpty}</h2>
                {!loading && <Button onClick={() => void analyze()}>{t.retry}</Button>}
              </div>
            )}
            <section className="map-panel" aria-label={t.step3}>
              <div className="map-topline">
                <div>
                  <span className="section-kicker">{t.step3}</span>
                  <h2>
                    {data
                      ? `${data.origin.name.split(',')[0]} → ${data.destination.name.split(',')[0]}`
                      : t.planner}
                  </h2>
                </div>
                {data && (
                  <span className={`data-badge ${data.mode === 'live' ? 'live' : ''}`}>
                    <i />
                    {data.mode === 'live'
                      ? 'Open-Meteo'
                      : lang === 'es'
                        ? 'Clima simulado'
                        : 'Simulated weather'}
                  </span>
                )}
              </div>
              {data && (
                <div className="map-route-picker" aria-label={t.step2}>
                  {data.routes.map((option, index) => (
                    <button
                      key={option.id}
                      aria-pressed={option.id === selected}
                      className={option.id === selected ? 'active' : ''}
                      onClick={() => selectRoute(option.id)}
                    >
                      {t.route} {index + 1}
                      <span>{duration(option.duration_seconds)}</span>
                      {option.id === data.recommendation.route_id && <ShieldCheck size={13} />}
                    </button>
                  ))}
                </div>
              )}
              <div
                className="map-view-switch"
                aria-label={lang === 'es' ? 'Vista del clima' : 'Weather view'}
              >
                <button
                  aria-pressed={mapView === 'arrival'}
                  className={mapView === 'arrival' ? 'active' : ''}
                  onClick={() => {
                    setMapView('arrival')
                    setPlaying(false)
                  }}
                >
                  <Navigation size={16} />
                  {t.arrival}
                </button>
                <button
                  aria-pressed={mapView === 'forecast'}
                  className={mapView === 'forecast' ? 'active' : ''}
                  onClick={() => setMapView('forecast')}
                >
                  <Clock3 size={16} />
                  {t.forecast}
                </button>
              </div>
              <p className="map-explanation">
                {mapView === 'arrival' ? t.arrivalHelp : t.forecastHelp}
              </p>
              <div
                className={`map-stage ${mapView === 'arrival' ? 'arrival-view' : 'forecast-view'}`}
              >
                <Suspense fallback={<div className="map-loading">{t.mapLoading}</div>}>
                  <RouteMap
                    data={data}
                    selected={selected}
                    hour={hour}
                    layer={layer}
                    heatVisible={heatVisible}
                    view={mapView}
                    lang={lang}
                    focusedPoint={point}
                    onSelect={selectRoute}
                    onCheckpoint={selectPoint}
                  />
                </Suspense>
                <div className="map-top-overlay">
                  <div className="map-layer-selector glass">
                    {(['risk', 'wind', 'rain', 'snow'] as Layer[]).map((value) => (
                      <button
                        key={value}
                        className={value === layer ? 'active' : ''}
                        aria-pressed={value === layer}
                        onClick={() => {
                          setLayer(value)
                          setHeatVisible(true)
                        }}
                      >
                        {value === 'risk' ? (
                          <CloudRain size={14} />
                        ) : value === 'wind' ? (
                          <Wind size={14} />
                        ) : null}
                        {value === 'risk' ? t.weather : t[value]}
                      </button>
                    ))}
                  </div>
                  <button
                    className={`layer-toggle glass ${heatVisible ? 'active' : ''}`}
                    aria-label={t.overlay}
                    aria-pressed={heatVisible}
                    onClick={() => setHeatVisible((value) => !value)}
                  >
                    <CloudRain size={18} />
                  </button>
                </div>
                {mapView === 'arrival' ? (
                  <div className="arrival-map-caption glass">
                    <span className="live-dot" />
                    <strong>
                      {data ? `${t.route} ${routeNumber(data, selected)}` : t.arrival}
                    </strong>
                    <span>{t.roadLegend}</span>
                  </div>
                ) : (
                  <div className="timeline glass">
                    <div className="timeline-heading">
                      <strong>{t.forecastTime}</strong>
                      <span className="forecast-hour">
                        +{hour}h{' '}
                        <span>
                          ·{' '}
                          {data
                            ? timeAt(data.forecast_reference_epoch + hour * 3600, zone, lang, true)
                            : '—'}
                        </span>
                      </span>
                    </div>
                    <div className="timeline-controls">
                      <button
                        className="play-button"
                        aria-label={playing ? t.pause : t.play}
                        disabled={!data}
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
                          disabled={!data}
                          onChange={(_, value) => {
                            setHour(value as number)
                            setPlaying(false)
                          }}
                          aria-label={t.forecast}
                          getAriaValueText={(value) => `+${value} h`}
                        />
                        <div className="timeline-ticks">
                          {[0, 12, 24, 36, 48].map((value) => (
                            <span key={value}>{value === 0 ? t.reference : `+${value}h`}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="timeline-note">{t.forecastHelp}</p>
                  </div>
                )}
                <div
                  className={`heat-legend glass ${mapView === 'forecast' ? 'above-timeline' : ''}`}
                >
                  <span>{t.smooth}</span>
                  <span>{t.lower}</span>
                  <i />
                  <span>{t.higher}</span>
                </div>
              </div>
              <div className="map-footer">
                <div className="risk-legend">
                  <strong>{mapView === 'arrival' ? t.roadLegend : t.regionLegend}</strong>
                  {mapView === 'arrival' ? (
                    riskNames[lang].map((name, risk) => (
                      <span key={name}>
                        <i style={{ background: RISK_COLORS[risk] }} />
                        {name}
                      </span>
                    ))
                  ) : (
                    <span>
                      {t[layer]} ·{' '}
                      {layer === 'wind'
                        ? '0–55+ mph'
                        : layer === 'rain'
                          ? '0–1+ in/h'
                          : layer === 'snow'
                            ? '0–3+ in/h'
                            : t.smooth}
                    </span>
                  )}
                  {mapView === 'arrival' && (
                    <span>
                      <i style={{ background: '#84909b' }} />
                      {t.unknown}
                    </span>
                  )}
                </div>
                <p>{t.clickMap}</p>
              </div>
              {data && selectedRoute && (
                <>
                  <div className="selected-route-heading">
                    <h3>
                      {t.route} {routeNumber(data, selected)}
                    </h3>
                    <span>
                      <Clock3 size={14} />
                      {duration(selectedRoute.duration_seconds)} ·{' '}
                      {fmt(selectedRoute.distance_miles, lang)} mi
                    </span>
                    <Button
                      size="small"
                      endIcon={<ChevronDown size={14} />}
                      onClick={() => setDialog('points')}
                    >
                      {t.points}
                    </Button>
                  </div>
                  <JourneyDetails
                    data={data}
                    route={selectedRoute}
                    point={point}
                    lang={lang}
                    onPoint={selectPoint}
                    onClose={() => setPoint(null)}
                  />
                </>
              )}
            </section>
            {data && (
              <RouteComparison data={data} selected={selected} lang={lang} onSelect={selectRoute} />
            )}
            {data && selectedRoute && (
              <div className="trip-footer">
                <span>
                  <Clock3 size={14} />
                  {t.arrivalTime}:{' '}
                  {timeAt(data.departure_epoch + selectedRoute.duration_seconds, zone, lang, true)}{' '}
                  · {zone}
                </span>
                <span>
                  <CheckCheck size={14} />
                  {t.coverage}:{' '}
                  {Math.round(
                    (selectedRoute.checkpoints.filter((cp) => cp.complete).length /
                      selectedRoute.checkpoints.length) *
                      100,
                  )}
                  %
                </span>
              </div>
            )}
            {data?.routes.some((route) => !route.summary.complete) && (
              <Alert severity="warning">{t.dataWarning}</Alert>
            )}
            {data && (
              <details className="data-details">
                <summary>{t.more}</summary>
                <p>
                  {t.source}: {data.routing_provider} · {data.weather_provider}. {t.noStops}
                </p>
                <p>
                  {lang === 'es' ? 'Salida analizada' : 'Analyzed departure'}:{' '}
                  {timeAt(data.departure_epoch, zone, lang, true)} · {fmt(data.load_lb, lang)} lb ·{' '}
                  {data.spacing_miles} mi.
                </p>
                {data.notices.map((notice) => (
                  <p key={notice}>{notice}</p>
                ))}
              </details>
            )}
          </div>
        </div>
        <footer className="page-footer">
          <span>
            Wayfinder ·{' '}
            {lang === 'es' ? 'Prueba técnica de Mauro Uribe' : 'Mauro Uribe’s assessment'}
          </span>
          <span>
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
