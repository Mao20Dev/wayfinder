import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Slider,
  TextField,
  Tooltip,
} from '@mui/material'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDownUp,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  CloudRain,
  FlaskConical,
  Info,
  Leaf,
  Map,
  MapPin,
  Navigation,
  Pause,
  Play,
  Route as RouteIcon,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Wind,
  X,
} from 'lucide-react'
import RouteMap from './components/RouteMap'
import LocationField from './components/LocationField'
import { clock, duration, localDateTime, request } from './api'
import {
  RISK_COLORS,
  RISK_LABELS,
  ROUTE_COLORS,
  type Analysis,
  type Checkpoint,
  type Layer,
  type Location,
  type Trip,
} from './types'

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
const spring = { type: 'spring' as const, bounce: 0, duration: 0.35 }
const number = (value: number | null | undefined, digits = 0) =>
  value == null
    ? '—'
    : value.toLocaleString('en-US', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      })

function RiskBadge({ risk }: { risk: number | null }) {
  return (
    <span
      className="risk-badge"
      style={
        { '--risk-color': risk === null ? '#7c8792' : RISK_COLORS[risk] } as React.CSSProperties
      }
    >
      <i />
      {risk === null ? 'Unknown' : RISK_LABELS[risk]}
    </span>
  )
}

export default function App() {
  const [origin, setOrigin] = useState<Location | null>(CHICAGO)
  const [destination, setDestination] = useState<Location | null>(DETROIT)
  const [departure, setDeparture] = useState(localDateTime())
  const [load, setLoad] = useState('28000')
  const [spacing, setSpacing] = useState(25)
  const [mode, setMode] = useState<'demo' | 'live'>('demo')
  const [data, setData] = useState<Analysis | null>(null)
  const [selected, setSelected] = useState('route-1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hour, setHour] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [layer, setLayer] = useState<Layer>('risk')
  const [heatVisible, setHeatVisible] = useState(true)
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null)
  const [dialog, setDialog] = useState<'about' | 'checkpoints' | null>(null)
  const [lastTrip, setLastTrip] = useState('')
  const initialized = useRef(false)
  const activeRequest = useRef<AbortController | null>(null)
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const route = data?.routes.find((r) => r.id === selected)
  const timeZone = data?.origin.timezone ?? 'UTC'
  const dirty =
    !!data && lastTrip !== JSON.stringify([mode, origin, destination, departure, load, spacing])
  const loadValid =
    load.trim() !== '' &&
    Number.isFinite(Number(load)) &&
    Number(load) >= 0 &&
    Number(load) <= 200000

  async function analyze(nextMode = mode, initial = false) {
    if (!origin || !destination || !loadValid || !departure) return
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setLoading(true)
    setError('')
    setPlaying(false)
    const trip: Trip = {
      mode: nextMode,
      origin,
      destination,
      departure: new Date(departure).toISOString(),
      load_lb: Number(load),
      spacing_miles: spacing,
    }
    try {
      const next = await request<Analysis>('/api/analyze/', {
        method: 'POST',
        body: JSON.stringify(trip),
        signal: controller.signal,
      })
      setData(next)
      setSelected(next.recommendation.route_id ?? next.routes[0].id)
      setHour(0)
      setCheckpoint(null)
      setLastTrip(JSON.stringify([nextMode, origin, destination, departure, load, spacing]))
      if (initial) setMode('demo')
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Could not analyze this trip.')
    } finally {
      if (activeRequest.current === controller) setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      void analyze('demo', true)
    }
    // Intentionally load exactly one demo. Input changes require an explicit run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!playing) return
    const interval = setInterval(() => setHour((h) => (h < 48 ? h + 1 : 0)), 650)
    return () => clearInterval(interval)
  }, [playing])

  function selectRoute(id: string) {
    setSelected(id)
    setCheckpoint(null)
  }
  function switchMode(next: 'live' | 'demo') {
    setMode(next)
    if (next === 'demo') {
      setOrigin(CHICAGO)
      setDestination(DETROIT)
    }
  }

  return (
    <div className="app">
      <aside className="rail" aria-label="Application navigation">
        <a className="brand-mark" href="#main" aria-label="Wayfinder planner">
          <Navigation size={25} fill="currentColor" />
        </a>
        <Tooltip title="Trip planner" placement="right">
          <a className="rail-button selected" href="#trip-form" aria-label="Trip planner">
            <Map size={21} />
          </a>
        </Tooltip>
        <Tooltip title="How it works" placement="right">
          <button
            className="rail-button"
            aria-label="How it works"
            onClick={() => setDialog('about')}
          >
            <SlidersHorizontal size={20} />
          </button>
        </Tooltip>
        <div className="rail-bottom">
          <Tooltip title="Method and assumptions" placement="right">
            <button
              className="rail-button"
              aria-label="Method and assumptions"
              onClick={() => setDialog('about')}
            >
              <Info size={20} />
            </button>
          </Tooltip>
          <span className="author-mark" title="Mauro Uribe">
            MU
          </span>
        </div>
      </aside>

      <div className="workspace" id="main">
        <header className="topbar">
          <a href="#main" className="wordmark">
            wayfinder<span className="wordmark-dot">.</span>
          </a>
          <span className="header-divider" />
          <span className="breadcrumb">
            Workspace <ChevronRight size={13} /> <strong>Route planner</strong>
          </span>
          <div className="header-right">
            <span className="assessment-label">Spotter assessment</span>
            <button className="help-button" onClick={() => setDialog('about')}>
              <Info size={15} />
              <span>How it works</span>
            </button>
          </div>
        </header>

        <main>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> A LITTLE FORESIGHT. A BETTER JOURNEY.
              </div>
              <h1>A clearer road ahead.</h1>
              <p>Find your way around the weather, before it finds you.</p>
            </div>
            <div className="heading-note">
              <ShieldCheck size={18} />
              <div>
                <strong>Weather-aware decisions</strong>
                <span>Three routes. One informed choice.</span>
              </div>
            </div>
          </section>

          <div className="planner-layout">
            <aside className="planning-panel">
              <form
                id="trip-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void analyze()
                }}
              >
                <div className="panel-title">
                  <div className="icon-square">
                    <RouteIcon size={19} />
                  </div>
                  <div>
                    <h2>Plan your journey</h2>
                    <p>The details make the difference.</p>
                  </div>
                </div>
                <div className="mode-switch" aria-label="Data mode">
                  <button
                    type="button"
                    className={mode === 'demo' ? 'active' : ''}
                    aria-pressed={mode === 'demo'}
                    disabled={loading}
                    onClick={() => switchMode('demo')}
                  >
                    <FlaskConical size={14} />
                    Demo scenario
                  </button>
                  <button
                    type="button"
                    className={mode === 'live' ? 'active' : ''}
                    aria-pressed={mode === 'live'}
                    disabled={loading}
                    onClick={() => switchMode('live')}
                  >
                    <span className="live-dot" />
                    Live weather
                  </button>
                </div>
                <div className="location-fields">
                  <div className="location-connector">
                    <span>A</span>
                    <i />
                    <span>B</span>
                  </div>
                  <div className="location-inputs">
                    <LocationField
                      label="Origin"
                      value={origin}
                      onChange={setOrigin}
                      disabled={mode === 'demo' || loading}
                    />
                    <LocationField
                      label="Destination"
                      value={destination}
                      onChange={setDestination}
                      disabled={mode === 'demo' || loading}
                    />
                  </div>
                </div>
                {mode === 'live' && (
                  <button
                    type="button"
                    className="swap-button"
                    disabled={loading}
                    onClick={() => {
                      setOrigin(destination)
                      setDestination(origin)
                    }}
                  >
                    <ArrowDownUp size={13} /> Swap locations
                  </button>
                )}
                <TextField
                  className="departure-field"
                  label="Departure"
                  type="datetime-local"
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                  disabled={loading || mode === 'demo'}
                  size="small"
                  fullWidth
                  required
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <p className="field-note">
                  {mode === 'demo'
                    ? 'Demo starts at the forecast reference hour.'
                    : `Your local time · ${browserZone}`}
                </p>
                <div className="cargo-label">
                  <Truck size={15} />
                  <span>Load weight</span>
                  <Tooltip title="Cargo weight only. Vehicle tare weight is not included.">
                    <Info size={13} />
                  </Tooltip>
                </div>
                <TextField
                  value={load}
                  onChange={(e) => setLoad(e.target.value)}
                  disabled={loading}
                  size="small"
                  fullWidth
                  required
                  type="number"
                  error={!loadValid}
                  helperText={!loadValid ? 'Enter a cargo weight from 0 to 200,000 lb.' : undefined}
                  slotProps={{
                    htmlInput: {
                      min: 0,
                      max: 200000,
                      step: 1,
                      'aria-label': 'Cargo weight in pounds',
                    },
                    input: { endAdornment: <span className="input-unit">lb</span> },
                  }}
                />
                <div className="sampling-label">
                  <span>Weather checkpoints</span>
                  <Tooltip title="Sample along each route at the truck’s estimated arrival time.">
                    <Info size={13} />
                  </Tooltip>
                </div>
                <div className="spacing-options">
                  {[10, 25, 50].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={spacing === value}
                      className={spacing === value ? 'active' : ''}
                      disabled={loading}
                      onClick={() => setSpacing(value)}
                    >
                      {value} <span>mi</span>
                      {spacing === value && <Check size={13} />}
                    </button>
                  ))}
                </div>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  className="analyze-button"
                  disabled={loading || !origin || !destination || !loadValid || !departure}
                  endIcon={
                    loading ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <ArrowRight size={17} />
                    )
                  }
                >
                  {loading
                    ? 'Analyzing your journey…'
                    : mode === 'demo'
                      ? 'Explore demo routes'
                      : 'Find safer routes'}
                </Button>
                <p className="form-footnote">
                  {loading
                    ? 'Fetching routes and hourly forecasts. Live trips can take up to a minute.'
                    : mode === 'demo'
                      ? 'Recorded routes · synthetic weather · no API key needed'
                      : 'Real routes and forecasts · no API key needed with OSRM'}
                </p>
              </form>

              <div className="routes-section">
                <div className="routes-heading">
                  <h2>Your route options</h2>
                  <span>{data?.routes.length ?? '—'} routes</span>
                </div>
                {dirty && (
                  <div className="stale-note">Inputs changed. Analyze again to update results.</div>
                )}
                {error && (
                  <Alert
                    severity="error"
                    className="request-error"
                    action={
                      <button aria-label="Dismiss error" onClick={() => setError('')}>
                        <X size={15} />
                      </button>
                    }
                  >
                    {error}
                  </Alert>
                )}
                {data && (
                  <div className="route-options">
                    {data.routes.map((r, i) => {
                      const recommended = r.id === data.recommendation.route_id
                      const active = r.id === selected
                      const severe = r.summary.miles_by_risk[3]
                      const high = r.summary.miles_by_risk[2]
                      return (
                        <motion.button
                          layout
                          transition={spring}
                          key={r.id}
                          className={`route-card ${active ? 'active' : ''}`}
                          aria-pressed={active}
                          onClick={() => selectRoute(r.id)}
                          style={{ '--route-color': ROUTE_COLORS[i % 3] } as React.CSSProperties}
                        >
                          {active && (
                            <motion.div
                              layoutId="route-highlight"
                              className="route-highlight"
                              transition={spring}
                            />
                          )}
                          <div className="route-card-top">
                            <span className="route-name">
                              <span className="route-number">0{i + 1}</span>Route {i + 1}
                            </span>
                            {recommended ? (
                              <span className="recommended-tag">
                                <Sparkles size={11} />
                                Recommended
                              </span>
                            ) : (
                              <span className={`status-tag ${r.summary.status}`}>
                                {r.summary.status === 'ready'
                                  ? 'Alternative'
                                  : r.summary.status === 'blocked'
                                    ? 'No Travel'
                                    : 'Incomplete'}
                              </span>
                            )}
                          </div>
                          <div className="route-metrics">
                            <strong>{duration(r.duration_seconds)}</strong>
                            <span className="metric-divider" />
                            <span>
                              {number(r.distance_miles)} <small>mi</small>
                            </span>
                            <ChevronRight size={16} />
                          </div>
                          <div className="risk-strip" aria-label="Distance by risk">
                            {r.summary.miles_by_risk.map(
                              (miles, level) =>
                                miles > 0 && (
                                  <span
                                    key={level}
                                    style={{
                                      width: `${(miles / r.distance_miles) * 100}%`,
                                      background: RISK_COLORS[level],
                                    }}
                                  />
                                ),
                            )}
                            {r.summary.unknown_miles > 0 && (
                              <span
                                style={{ flex: r.summary.unknown_miles, background: '#9ca6af' }}
                              />
                            )}
                          </div>
                          <div className="route-exposure">
                            <span>{number(severe, 1)} mi severe</span>
                            <i /> <span>{number(high, 1)} mi high</span>
                          </div>
                          {r.via_comparison_point && (
                            <span className="via-note">Via an API comparison waypoint</span>
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                )}
                {!data && (
                  <div className="empty-routes">
                    <RouteIcon size={24} />
                    <p>
                      {loading
                        ? 'Preparing your first three routes…'
                        : 'Your route comparison will appear here.'}
                    </p>
                  </div>
                )}
                <div className="priority-note">
                  <ShieldCheck size={16} />
                  <p>
                    Safety comes first.
                    <br />
                    <span>Severe exposure → high exposure → average risk → travel time.</span>
                  </p>
                </div>
              </div>
            </aside>

            <section className="map-panel" aria-label="Route comparison map">
              <div className="map-topline">
                <div>
                  <span className="section-kicker">THE BIG PICTURE</span>
                  <h2>
                    {data
                      ? `${data.origin.name.split(',')[0]} to ${data.destination.name.split(',')[0]}`
                      : 'Your journey, in view'}
                  </h2>
                </div>
                <span className={`data-badge ${data?.mode === 'live' ? 'live' : ''}`}>
                  <span />
                  {data?.mode === 'live' ? 'Live forecast' : 'Simulated weather'}
                </span>
              </div>
              <div className="map-stage">
                <RouteMap
                  data={data}
                  selected={selected}
                  hour={hour}
                  layer={layer}
                  heatVisible={heatVisible}
                  onSelect={selectRoute}
                  onCheckpoint={setCheckpoint}
                />
                <div className="map-top-overlay">
                  <div className="map-layer-selector glass">
                    {(['risk', 'wind', 'rain', 'snow'] as Layer[]).map((value) => (
                      <button
                        key={value}
                        className={layer === value ? 'active' : ''}
                        aria-pressed={layer === value}
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
                        {value === 'risk'
                          ? 'Weather risk'
                          : value.charAt(0).toUpperCase() + value.slice(1)}
                      </button>
                    ))}
                  </div>
                  <Tooltip title={heatVisible ? 'Hide weather overlay' : 'Show weather overlay'}>
                    <button
                      className={`layer-toggle glass ${heatVisible ? 'active' : ''}`}
                      aria-label="Toggle weather overlay"
                      aria-pressed={heatVisible}
                      onClick={() => setHeatVisible(!heatVisible)}
                    >
                      <CloudRain size={18} />
                    </button>
                  </Tooltip>
                </div>
                <AnimatePresence>
                  {checkpoint && (
                    <motion.div
                      className="checkpoint-detail glass"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={spring}
                    >
                      <div className="checkpoint-top">
                        <div>
                          <span className="section-kicker">ARRIVAL CONDITIONS</span>
                          <strong>Mile {number(checkpoint.mile, 1)}</strong>
                        </div>
                        <IconButton
                          size="small"
                          aria-label="Close checkpoint details"
                          onClick={() => setCheckpoint(null)}
                        >
                          <X size={16} />
                        </IconButton>
                      </div>
                      <RiskBadge risk={checkpoint.risk} />
                      <p>
                        <Clock3 size={13} />
                        {clock(checkpoint.eta_epoch, timeZone, true)} <span>{timeZone}</span>
                      </p>
                      <div className="checkpoint-weather">
                        <span>
                          <Wind size={17} />
                          <strong>{number(checkpoint.weather.wind_mph, 1)}</strong>
                          <small>mph wind</small>
                        </span>
                        <span>
                          <CloudRain size={17} />
                          <strong>{number(checkpoint.weather.rain_in_hr, 2)}</strong>
                          <small>in/h rain</small>
                        </span>
                        <span>
                          <span aria-hidden="true">❄</span>
                          <strong>{number(checkpoint.weather.snow_in_hr, 2)}</strong>
                          <small>in/h snow</small>
                        </span>
                      </div>
                      <small className="checkpoint-caption">
                        Arrival-time weather. The timeline changes the corridor overlay only.
                      </small>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="timeline glass">
                  <div className="timeline-heading">
                    <span>
                      <CloudRain size={15} />
                      <strong>Weather along the corridor</strong>
                    </span>
                    <span className="forecast-hour">
                      +{hour}h{' '}
                      <span>
                        ·{' '}
                        {data
                          ? clock(data.forecast_reference_epoch + hour * 3600, timeZone, true)
                          : '—'}
                      </span>
                    </span>
                  </div>
                  <div className="timeline-controls">
                    <button
                      className="play-button"
                      aria-label={playing ? 'Pause forecast' : 'Play forecast'}
                      disabled={!data || !heatVisible}
                      onClick={() => setPlaying(!playing)}
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
                        aria-label="Forecast hours from reference time"
                        getAriaValueText={(value) => `${value} hours from reference time`}
                      />
                      <div className="timeline-ticks">
                        {[0, 12, 24, 36, 48].map((h) => (
                          <span key={h}>{h === 0 ? 'Reference' : `+${h}h`}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="heat-legend">
                    <span>
                      Relative {layer === 'risk' ? 'weather intensity' : layer} · smoothed
                    </span>
                    <div />
                    <span>Lower</span>
                    <span>Higher</span>
                  </div>
                </div>
              </div>

              <div className="map-footer">
                <div className="risk-legend">
                  <span>Checkpoint risk</span>
                  {RISK_LABELS.map((label, i) => (
                    <span key={label}>
                      <i style={{ background: RISK_COLORS[i] }} />
                      {label}
                    </span>
                  ))}
                </div>
                <span className="map-hint">
                  <MapPin size={13} />
                  Select a point for arrival conditions
                </span>
              </div>

              <div className="journey-summary">
                <div className="summary-title">
                  <div className="icon-square">
                    <ShieldCheck size={19} />
                  </div>
                  <div>
                    <span className="section-kicker">
                      {route?.id === data?.recommendation.route_id
                        ? 'YOUR RECOMMENDED ROUTE'
                        : 'SELECTED ROUTE'}
                    </span>
                    <h2>
                      {route ? `Route ${data!.routes.indexOf(route) + 1}` : 'Ready when you are'}
                      {route && <RiskBadge risk={route.summary.max_risk} />}
                    </h2>
                  </div>
                  <Button
                    className="checkpoint-button"
                    size="small"
                    endIcon={<ChevronDown size={14} />}
                    disabled={!route}
                    onClick={() => setDialog('checkpoints')}
                  >
                    Checkpoints
                  </Button>
                </div>
                <div className="summary-stats">
                  <div>
                    <span>
                      <RouteIcon size={14} />
                      Distance
                    </span>
                    <strong>
                      {number(route?.distance_miles)} <small>mi</small>
                    </strong>
                  </div>
                  <div>
                    <span>
                      <Clock3 size={14} />
                      Drive time
                    </span>
                    <strong>{route ? duration(route.duration_seconds) : '—'}</strong>
                  </div>
                  <div>
                    <span>
                      <Wind size={14} />
                      Severe exposure
                    </span>
                    <strong>
                      {number(route?.summary.miles_by_risk[3], 1)} <small>mi</small>
                    </strong>
                  </div>
                  <div>
                    <span>
                      <CloudRain size={14} />
                      High exposure
                    </span>
                    <strong>
                      {number(route?.summary.miles_by_risk[2], 1)} <small>mi</small>
                    </strong>
                  </div>
                  <div>
                    <span>
                      <ShieldCheck size={14} />
                      Average risk
                    </span>
                    <strong>
                      {number(route?.summary.average_risk, 2)} <small>/ 4</small>
                    </strong>
                  </div>
                  <div>
                    <span>
                      <CheckCheck size={14} />
                      Weather coverage
                    </span>
                    <strong>
                      {route
                        ? `${Math.round((route.checkpoints.filter((c) => c.complete).length / route.checkpoints.length) * 100)}%`
                        : '—'}
                    </strong>
                  </div>
                </div>
                <div
                  className={`recommendation-explanation ${!data?.recommendation.route_id && data ? 'warning' : ''}`}
                >
                  <Leaf size={16} />
                  <p>
                    {data
                      ? data.recommendation.tied_route_ids.length > 1
                        ? `Routes ${data.recommendation.tied_route_ids.map((id) => id.replace('route-', '')).join(' and ')} tie on all four criteria.`
                        : data.recommendation.route_id
                          ? `Route ${data.routes.findIndex((r) => r.id === data.recommendation.route_id) + 1} wins by comparing severe miles, high miles, average risk, then time.`
                          : data.recommendation.reason
                      : 'Analyze a journey to compare weather exposure.'}
                  </p>
                </div>
              </div>
            </section>
          </div>

          {data && (
            <div className="data-notes">
              <Info size={15} />
              <div>
                {data.notices.map((notice) => (
                  <p key={notice}>{notice}</p>
                ))}
                <p>
                  Providers: {data.routing_provider} · {data.weather_provider}. Forecast reference:{' '}
                  {clock(data.forecast_reference_epoch, timeZone, true)} ({timeZone}). ETAs exclude
                  driving breaks.
                </p>
              </div>
              <button onClick={() => setDialog('about')}>
                Method <ArrowRight size={13} />
              </button>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <Navigation size={12} />
              Built with a little foresight.
            </span>
            <span>
              Weather data:{' '}
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                Open-Meteo
              </a>{' '}
              · Routes:{' '}
              <a href="https://project-osrm.org/" target="_blank" rel="noreferrer">
                OSRM
              </a>{' '}
              / TomTom · Map: OpenFreeMap & OpenStreetMap
            </span>
          </footer>
        </main>
      </div>

      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        maxWidth={dialog === 'checkpoints' ? 'md' : 'sm'}
        fullWidth
      >
        <DialogTitle className="dialog-title">
          {dialog === 'checkpoints'
            ? `Route ${data?.routes.findIndex((r) => r.id === selected)! + 1} · arrival checkpoints`
            : 'A little foresight, explained'}
          <IconButton aria-label="Close dialog" onClick={() => setDialog(null)}>
            <X size={19} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {dialog === 'about' ? (
            <div className="method-content">
              <p>
                Wayfinder compares weather exposure on road routes. It implements the rules supplied
                for the Spotter assessment; it is an assessment prototype.
              </p>
              <h3>How a journey is analyzed</h3>
              <ol>
                <li>
                  A routing API returns up to three distinct routes and cumulative driving times.
                </li>
                <li>We place checkpoints every 10, 25 or 50 miles, including both ends.</li>
                <li>Weather is sampled at the estimated arrival time at each checkpoint.</li>
                <li>The highest wind, rain or snow risk is used, with cargo overrides.</li>
                <li>
                  Complete routes without No Travel are ranked by severe miles, high miles,
                  distance-weighted average risk, then driving time.
                </li>
              </ol>
              <h3>Decisions made explicit</h3>
              <p>
                Wind uses continuous bands: below 25, 25–&lt;35, 35–&lt;45, 45–&lt;55, and 55+ mph.
                Rain boundaries 0.25 and 0.50, and snow boundaries 1 and 2, belong to the higher
                category. Exactly 1 in/h of rain and 3 in/h of snow remain Severe.
              </p>
              <p>
                Wind 45–&lt;55 mph with cargo above 30,000 lb is No Travel. Wind 35–&lt;45 mph above
                40,000 lb is Severe. Exactly 30,000 and 40,000 lb do not trigger those strict
                overrides.
              </p>
              <p>
                Each interval uses the higher risk of its two checkpoints. Average risk uses scores
                0–4, weighted by distance. Unknown data never becomes Low. Known No Travel still
                blocks a route if other variables are missing.
              </p>
              <h3>Two views of time</h3>
              <p>
                Checkpoint details show arrival-time weather. The 0–48h timeline shows a common
                forecast hour across the corridor; it does not change departure time or the
                recommendation. The blurred overlay shows relative intensity, while checkpoint
                labels show exact risk categories.
              </p>
              <h3>Data and limits</h3>
              <p>
                The demo uses recorded OSRM road routes and explicitly synthetic weather. Live mode
                uses Open-Meteo and OSRM, or TomTom when configured. OSRM uses a car profile and may
                use explicit comparison waypoints to obtain additional routes. It does not check
                truck dimensions or legal restrictions. Routing times do not include mandatory
                stops.
              </p>
              <p>
                Live departures are limited to the next four days, driving to 48 hours and weather
                sampling to 450 checkpoints per trip. Forecasts outside the returned horizon remain
                Unknown. Free providers may throttle requests or be unavailable.
              </p>
              <h3>Architecture</h3>
              <div className="architecture-inline">
                React + MapLibre → Django API
                <br />
                Django → Routing API + Open-Meteo
                <br />
                Django → risk rules → route recommendation
                <br />
                One server delivers the frontend and API.
              </div>
              <p>
                Detailed architecture, tests, assumptions and setup instructions are included in the
                repository documentation.
              </p>
            </div>
          ) : (
            <>
              <p className="table-caption">
                All times in {timeZone}. These are arrival conditions for the analyzed departure,
                independent of the corridor timeline.
              </p>
              <div className="checkpoint-table-wrap">
                <table className="checkpoint-table">
                  <thead>
                    <tr>
                      <th>Mile</th>
                      <th>Arrival</th>
                      <th>Wind mph</th>
                      <th>Rain in/h</th>
                      <th>Snow in/h</th>
                      <th>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {route?.checkpoints.map((cp) => (
                      <tr key={cp.id}>
                        <td>
                          <button
                            onClick={() => {
                              setCheckpoint(cp)
                              setDialog(null)
                            }}
                          >
                            {number(cp.mile, 1)} <ArrowRight size={12} />
                          </button>
                        </td>
                        <td>{clock(cp.eta_epoch, timeZone, true)}</td>
                        <td>{number(cp.weather.wind_mph, 1)}</td>
                        <td>{number(cp.weather.rain_in_hr, 2)}</td>
                        <td>{number(cp.weather.snow_in_hr, 2)}</td>
                        <td>
                          <RiskBadge risk={cp.risk} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
