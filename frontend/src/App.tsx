import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Alert, Slider } from '@mui/material'
import {
  Bookmark,
  Check,
  ChevronDown,
  Info,
  ListFilter,
  Navigation,
  Pause,
  Play,
  Route as RouteIcon,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { ApiError, localDateTime, request } from './api'
import { copy, fmt, riskNames, routeNumber, timeAt, type Language } from './i18n'
import type { Analysis, Checkpoint, Configuration, Layer, Location, MapView, Trip } from './types'
import { RISK_COLORS } from './types'
import TripForm from './components/TripForm'
import RouteComparison, { RecommendationBanner } from './components/RouteComparison'
import JourneyDetails from './components/JourneyDetails'
import DetailsDialog from './components/DetailsDialog'
import useMapLayout from './useMapLayout'
import { FORECAST_SCALES } from './forecastField'
import DeparturePlanner from './components/DeparturePlanner'
import { TripActions, SavedTripsDialog } from './components/TripActions'
import { readSavedTrips, saveTrip, writeSavedTrips } from './maps'
import { exampleTruck, parseTruck } from './truck'
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
  const [truckSource, setTruckSource] = useState<'example' | 'custom'>('example')
  const [truckBrand, setTruckBrand] = useState('')
  const [customTruck, setCustomTruck] = useState(() => exampleTruck(28000))
  const [truckAvailable, setTruckAvailable] = useState<boolean | null>(null)
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
  const [departureUpdating, setDepartureUpdating] = useState(false)
  const [savedTrips, setSavedTrips] = useState(readSavedTrips)
  const [savedOpen, setSavedOpen] = useState(false)
  const [error, setError] = useState('')
  const [retryUntil, setRetryUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [lastBase, setLastBase] = useState('')
  const [dialog, setDialog] = useState<'method' | 'points' | null>(null)
  const [plannerOpen, setPlannerOpen] = useState(true)
  const [routesOpen, setRoutesOpen] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<'trip' | 'routes' | null>('trip')
  const followRecommendation = useRef(true)
  const activeRequest = useRef<AbortController | null>(null)
  const throttledMessage = useRef('')
  const latest = useRef({ lang, selected, point })
  latest.current = { lang, selected, point }
  const t = copy[lang]
  const loadNumber = Number(load)
  const truck = truckSource === 'example' ? exampleTruck(loadNumber) : customTruck
  const vehicle = parseTruck(truck, loadNumber)
  const vehicleSignature = JSON.stringify([truck, loadNumber, truckSource, truckBrand])
  const truckSignature = mode === 'live' ? vehicleSignature : null
  const baseSignature = JSON.stringify([
    mode,
    origin,
    destination,
    departure,
    spacing,
    truckSignature,
  ])
  const loadValid =
    load.trim() !== '' && Number.isFinite(loadNumber) && loadNumber >= 0 && loadNumber <= 200000
  const dirty = !!data && baseSignature !== lastBase
  const selectedRoute = data?.routes.find((route) => route.id === selected)
  const retrySeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000))
  const visibleData = !dirty && !loading ? data : null
  const layout = useMapLayout(
    plannerOpen,
    routesOpen && (!!visibleData || loading),
    mobilePanel,
    mapView === 'forecast' && !!visibleData,
  )
  const zone = data?.origin.timezone ?? 'UTC'
  useEffect(() => {
    document.documentElement.lang = 'en'
    document.title = 'Wayfinder - Weather-aware routing'
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    request<Configuration>('/api/config/', { signal: controller.signal })
      .then((config) => setTruckAvailable(config.truck_routing_available))
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not check truck routing. Reload to try again.')
      })
    return () => controller.abort()
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
    else if (error instanceof ApiError && [400, 409, 502, 503].includes(error.status))
      setError(error.message)
    else setError(current.errorNetwork)
  }
  async function analyze(nextMode = mode) {
    if (
      (nextMode !== 'demo' && (!origin || !destination || !vehicle || !truckAvailable)) ||
      !loadValid ||
      !Number.isFinite(new Date(departure).getTime())
    )
      return
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setLoading(true)
    setPoint(null)
    setMapView('arrival')
    setRoutesOpen(true)
    if (layout.compact) setMobilePanel('routes')
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
    const signature = JSON.stringify([
      nextMode,
      tripOrigin,
      tripDestination,
      departure,
      spacing,
      nextMode === 'live' ? vehicleSignature : null,
    ])
    const trip: Trip = {
      mode: nextMode,
      origin: tripOrigin,
      destination: tripDestination,
      departure: new Date(departure).toISOString(),
      load_lb: loadNumber,
      spacing_miles: spacing,
      ...(nextMode === 'live' && vehicle ? { vehicle } : {}),
      ...(nextMode === 'live' ? { vehicle_source: truckSource, vehicle_brand: truckBrand } : {}),
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
    if (
      !data ||
      data.mode === 'live' ||
      loading ||
      departureUpdating ||
      lastBase !== baseSignature ||
      !loadValid ||
      data.load_lb === loadNumber
    )
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
  }, [
    data?.analysis_id,
    data?.load_lb,
    lastBase,
    baseSignature,
    loadNumber,
    loadValid,
    loading,
    departureUpdating,
  ])
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
    if (layout.compact) setMobilePanel(null)
  }
  function editLocation(setter: (value: Location | null) => void, value: Location | null) {
    setter(value)
    setMode('live')
  }
  async function changeDeparture(offset: number) {
    if (!data || dirty || loading || reassessing || departureUpdating || !loadValid) return
    const controller = new AbortController()
    activeRequest.current?.abort()
    activeRequest.current = controller
    setDepartureUpdating(true)
    setError('')
    setPlaying(false)
    try {
      const result = await request<Analysis>('/api/departure/', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          analysis_id: data.analysis_id,
          offset_hours: offset,
          load_lb: loadNumber,
        }),
      })
      if (controller.signal.aborted) return
      const nextDeparture = localDateTime(new Date(result.departure_epoch * 1000))
      setDeparture(nextDeparture)
      setData(result)
      setLastBase(
        JSON.stringify([mode, origin, destination, nextDeparture, spacing, truckSignature]),
      )
      setSelected(result.recommendation.route_id ?? result.routes[0].id)
      setPoint(null)
      followRecommendation.current = false
    } catch (error) {
      if (!controller.signal.aborted) showError(error)
    } finally {
      if (!controller.signal.aborted) setDepartureUpdating(false)
    }
  }
  function saveSelectedTrip() {
    if (!data || !selectedRoute || dirty || !loadValid || loadNumber !== data.load_lb) return
    try {
      const next = saveTrip(data, selectedRoute, savedTrips)
      writeSavedTrips(next)
      setSavedTrips(next)
      setSavedOpen(true)
    } catch (error) {
      setError(
        error instanceof Error && error.message.includes('10 saved')
          ? error.message
          : 'This browser could not save the route. You can still open it in Google Maps.',
      )
    }
  }
  function removeSavedTrip(id: string) {
    const next = savedTrips.filter((trip) => trip.id !== id)
    try {
      writeSavedTrips(next)
      setSavedTrips(next)
    } catch {
      setError('This browser could not update saved routes.')
    }
  }
  function togglePlanner() {
    if (layout.compact) {
      setPlannerOpen(true)
      setMobilePanel((value) => (value === 'trip' ? null : 'trip'))
    } else setPlannerOpen((value) => !value)
  }
  function toggleRoutes() {
    if (layout.compact) {
      setRoutesOpen(true)
      setMobilePanel((value) => (value === 'routes' ? null : 'routes'))
    } else setRoutesOpen((value) => !value)
  }
  function hidePanel(kind: 'trip' | 'routes') {
    if (layout.compact) setMobilePanel(null)
    else if (kind === 'trip') setPlannerOpen(false)
    else setRoutesOpen(false)
  }
  const isBest =
    visibleData &&
    (visibleData.recommendation.route_id === selected ||
      visibleData.recommendation.tied_route_ids.includes(selected))
  const jointBest = (visibleData?.recommendation.tied_route_ids.length ?? 0) > 1
  return (
    <main
      id="main"
      ref={layout.frame}
      className={`app map-workspace ${loading ? 'is-searching' : ''}`}
      data-sheet-open={layout.compact && (layout.plannerVisible || layout.routesVisible)}
      style={layout.style}
    >
      <div
        className={`map-stage ${mapView === 'arrival' ? 'arrival-view' : 'forecast-view'}`}
        aria-label="Route weather map"
      >
        <Suspense fallback={<div className="map-loading">{t.mapLoading}</div>}>
          <RouteMap
            data={visibleData}
            origin={origin}
            destination={destination}
            loading={loading}
            padding={layout.padding}
            selected={selected}
            hour={hour}
            layer={layer}
            heatVisible={!!visibleData && mapView === 'forecast'}
            view={mapView}
            lang={lang}
            focusedPoint={point}
            onSelect={selectRoute}
            onCheckpoint={selectPoint}
          />
        </Suspense>
      </div>
      <header className="topbar">
        <a href="#main" className="wordmark glass">
          <span className="brand-mark">
            <Navigation size={19} fill="currentColor" />
          </span>
          wayfinder<span className="wordmark-dot">.</span>
        </a>
        <nav className="workspace-actions glass" aria-label="Map panels">
          <button onClick={togglePlanner} aria-pressed={layout.plannerVisible}>
            <SlidersHorizontal size={16} />
            <span>Trip</span>
          </button>
          {(visibleData || loading) && (
            <button onClick={toggleRoutes} aria-pressed={layout.routesVisible}>
              <ListFilter size={16} />
              <span>Routes{visibleData ? ` · ${visibleData.routes.length}` : ''}</span>
            </button>
          )}
          <button
            className="saved-button"
            aria-label="Saved routes"
            onClick={() => setSavedOpen(true)}
          >
            <Bookmark size={16} />
            <span>Saved{savedTrips.length ? ` · ${savedTrips.length}` : ''}</span>
          </button>
          <button
            className="help-button"
            aria-label="Risk rules"
            onClick={() => setDialog('method')}
          >
            <Info size={16} />
            <span>Risk rules</span>
          </button>
        </nav>
      </header>
      {layout.plannerVisible && (
        <div ref={layout.planner} className="form-column floating-panel">
          <TripForm
            lang={lang}
            origin={origin}
            destination={destination}
            departure={departure}
            load={load}
            spacing={spacing}
            mode={mode}
            loading={loading || departureUpdating}
            reassessing={reassessing}
            loadValid={loadValid}
            retrySeconds={retrySeconds}
            truck={truck}
            truckSource={truckSource}
            truckBrand={truckBrand}
            onTruckSource={(value) => {
              if (value === 'custom' && truckSource === 'example') setCustomTruck(truck)
              setTruckSource(value)
            }}
            onTruckBrand={setTruckBrand}
            truckValid={!!vehicle}
            truckAvailable={truckAvailable}
            onTruck={(value) => {
              setCustomTruck(value)
              setTruckSource('custom')
            }}
            onOrigin={(value) => editLocation(setOrigin, value)}
            onDestination={(value) => editLocation(setDestination, value)}
            onDeparture={setDeparture}
            onLoad={(value) => {
              setLoad(value)
              if (mode === 'live' && truckSource === 'custom' && value !== load)
                setCustomTruck((current) => ({ ...current, max_axle_weight_lb: '' }))
            }}
            onSpacing={setSpacing}
            onSubmit={() => void analyze()}
            onExample={() => void analyze('demo')}
            onLive={() => void analyze('live')}
            onClose={() => hidePanel('trip')}
            onCancel={() => {
              activeRequest.current?.abort()
              setLoading(false)
            }}
          />
        </div>
      )}
      <div className="map-context" aria-busy={loading || reassessing || departureUpdating}>
        {visibleData && (
          <>
            <div className="selected-route-chip glass">
              <RouteIcon size={17} />
              <strong>Route {routeNumber(visibleData, selected)}</strong>
              <span>Selected</span>
              {isBest && (
                <span className="best-chip">
                  <Check size={12} />
                  {jointBest ? 'Joint best' : 'Best route'}
                </span>
              )}
            </div>
            <div className="map-toolbar glass">
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
                  onClick={() => {
                    setMapView('forecast')
                    setPoint(null)
                    if (layout.compact) setMobilePanel(null)
                  }}
                >
                  48-hour forecast
                </button>
              </div>
              <button className="text-button" onClick={() => setDialog('points')}>
                Weather details <ChevronDown size={14} />
              </button>
            </div>
          </>
        )}
        {loading && (
          <div className="search-status glass" role="status">
            <span className="search-orbit" aria-hidden="true" />
            <div>
              <strong>Finding your best route</strong>
              <span>Comparing roads and weather at arrival</span>
            </div>
          </div>
        )}
        {(reassessing || departureUpdating) && (
          <div className="updating-status glass" role="status">
            {departureUpdating ? 'Applying departure time...' : 'Updating risk for your cargo...'}
          </div>
        )}
        {dirty && !loading && (
          <div className="stale-note glass" role="status">
            Trip changed. Compare routes to update the map.
          </div>
        )}
        {error && (
          <Alert className="map-alert" severity="warning" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
      </div>
      {layout.routesVisible && (
        <div
          ref={layout.routes}
          className="results-column floating-panel"
          aria-busy={loading || reassessing || departureUpdating}
        >
          <div className="results-heading">
            <div>
              <h2>
                {loading ? 'Comparing routes' : `${visibleData?.routes.length ?? 0} route options`}
              </h2>
              <p>
                {loading
                  ? 'Using your departure and cargo'
                  : `${visibleData?.origin.name.split(',')[0]} → ${visibleData?.destination.name.split(',')[0]}`}
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Hide routes"
              onClick={() => hidePanel('routes')}
            >
              <X size={18} />
            </button>
          </div>
          <div className="results-scroll">
            {loading ? (
              <div className="route-skeletons" aria-label="Routes are loading">
                {[0, 1, 2].map((value) => (
                  <div className="route-skeleton" key={value}>
                    <i />
                    <i />
                    <i />
                  </div>
                ))}
                <button
                  className="cancel-button"
                  onClick={() => {
                    activeRequest.current?.abort()
                    setLoading(false)
                  }}
                >
                  Cancel search
                </button>
              </div>
            ) : (
              visibleData && (
                <>
                  <RecommendationBanner data={visibleData} lang={lang} />
                  {selectedRoute && (
                    <DeparturePlanner
                      data={visibleData}
                      route={selectedRoute}
                      busy={loading || reassessing || departureUpdating || dirty || !loadValid}
                      onApply={(offset) => void changeDeparture(offset)}
                    />
                  )}
                  <RouteComparison
                    data={visibleData}
                    selected={selected}
                    lang={lang}
                    onSelect={selectRoute}
                  />
                  <div className="route-panel-footer">
                    <span className={`data-badge ${visibleData.mode === 'live' ? 'live' : ''}`}>
                      <i />
                      {visibleData.mode === 'live' ? 'Live forecast' : 'Simulated weather'}
                    </span>
                    <details className="data-details">
                      <summary>Trip &amp; data sources</summary>
                      <p>
                        {timeAt(visibleData.departure_epoch, zone, lang, true)} ·{' '}
                        {fmt(visibleData.load_lb, lang)} lb cargo · weather every{' '}
                        {visibleData.spacing_miles} mi.
                      </p>
                      <p>
                        {visibleData.routing_provider} · {visibleData.weather_provider}. {t.noStops}
                      </p>
                      {visibleData.vehicle && (
                        <p>
                          {visibleData.vehicle_source === 'example' ? 'Example assumptions. ' : ''}
                          {visibleData.vehicle_brand
                            ? `${visibleData.vehicle_brand} (brand label). `
                            : ''}
                          Truck: {visibleData.vehicle.height_ft} ft high ·{' '}
                          {visibleData.vehicle.width_ft} ft wide · {visibleData.vehicle.length_ft}{' '}
                          ft long · {fmt(visibleData.gross_weight_lb, lang)} lb gross ·{' '}
                          {visibleData.vehicle.axles} axles ·{' '}
                          {fmt(visibleData.vehicle.max_axle_weight_lb, lang)} lb heaviest axle.
                        </p>
                      )}
                      {visibleData.notices.map((notice) => (
                        <p key={notice}>{notice}</p>
                      ))}
                    </details>
                  </div>
                </>
              )
            )}
          </div>
          {visibleData && selectedRoute && (
            <TripActions
              data={visibleData}
              route={selectedRoute}
              busy={
                loading ||
                reassessing ||
                departureUpdating ||
                dirty ||
                !loadValid ||
                loadNumber !== visibleData.load_lb
              }
              onSave={saveSelectedTrip}
            />
          )}
        </div>
      )}
      {visibleData && (
        <>
          {mapView === 'forecast' && (
            <div className="forecast-dock" ref={layout.dock}>
              <div className="forecast-layers glass" aria-label="Forecast layer">
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
              <div className="timeline glass">
                <div className="timeline-heading">
                  <strong>
                    {timeAt(visibleData.forecast_reference_epoch + hour * 3600, zone, lang, true)}
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
                <div className="forecast-scale" aria-label={`${layer} forecast scale`}>
                  <span>
                    {layer === 'risk'
                      ? 'Weather risk'
                      : `${layer[0].toUpperCase()}${layer.slice(1)} (${FORECAST_SCALES[layer].unit})`}
                  </span>
                  <i />
                  <div>
                    {FORECAST_SCALES[layer].labels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                </div>
                <div className="forecast-caption">
                  <span>Area forecast only · trip unchanged</span>
                  <span>Spatial estimate · select an area for sample values</span>
                </div>
              </div>
            </div>
          )}
          <div className="map-footer glass">
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
              <p className="forecast-help">Area weather at one common hour</p>
            )}
            {selectedRoute && (
              <span className="arrival-summary">
                Arrive {timeAt(data!.departure_epoch + selectedRoute.duration_seconds, zone, lang)}{' '}
                · {zone}
              </span>
            )}
          </div>
        </>
      )}
      {visibleData && selectedRoute && point && mapView === 'arrival' && (
        <JourneyDetails
          data={visibleData}
          route={selectedRoute}
          point={point}
          lang={lang}
          onPoint={selectPoint}
          onClose={() => setPoint(null)}
        />
      )}
      <div className="map-credits">
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Weather by Open-Meteo
        </a>
        <span>
          {visibleData?.routing_profile === 'truck'
            ? visibleData.vehicle_source === 'example'
              ? 'Example truck assumptions · adjust for your vehicle.'
              : 'Truck profile applied · check signs and local restrictions.'
            : visibleData?.mode === 'demo'
              ? 'Weather demo only · not a truck navigation route.'
              : 'Truck dimensions and weights required.'}
        </span>
      </div>
      <SavedTripsDialog
        open={savedOpen}
        trips={savedTrips}
        onClose={() => setSavedOpen(false)}
        onRemove={removeSavedTrip}
      />
      <DetailsDialog
        kind={dialog}
        data={data}
        route={selectedRoute}
        lang={lang}
        onClose={() => setDialog(null)}
        onPoint={selectPoint}
      />
    </main>
  )
}
