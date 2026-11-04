import { Button, CircularProgress, TextField } from '@mui/material'
import { ArrowDownUp, ArrowRight, Check, FlaskConical, Truck } from 'lucide-react'
import { copy, type Language } from '../i18n'
import type { Location } from '../types'
import LocationField from './LocationField'

export default function TripForm({
  lang,
  origin,
  destination,
  departure,
  load,
  spacing,
  mode,
  loading,
  reassessing,
  loadValid,
  dirty,
  retrySeconds,
  onOrigin,
  onDestination,
  onDeparture,
  onLoad,
  onSpacing,
  onMode,
  onSubmit,
  onCancel,
}: {
  lang: Language
  origin: Location | null
  destination: Location | null
  departure: string
  load: string
  spacing: number
  mode: 'live' | 'demo'
  loading: boolean
  reassessing: boolean
  loadValid: boolean
  dirty: boolean
  retrySeconds: number
  onOrigin: (value: Location | null) => void
  onDestination: (value: Location | null) => void
  onDeparture: (value: string) => void
  onLoad: (value: string) => void
  onSpacing: (value: number) => void
  onMode: (value: 'live' | 'demo') => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const t = copy[lang]
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return (
    <aside className="planning-panel">
      <form
        id="trip-form"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <div className="panel-title">
          <span className="step-number">1</span>
          <div>
            <h2>{lang === 'es' ? '¿Cuál es tu viaje?' : 'Where are you headed?'}</h2>
            <p>{t.cityHint}</p>
          </div>
        </div>
        <div className="mode-switch" aria-label={lang === 'es' ? 'Tipo de viaje' : 'Trip mode'}>
          <button
            type="button"
            aria-pressed={mode === 'live'}
            className={mode === 'live' ? 'active' : ''}
            onClick={() => onMode('live')}
            disabled={loading}
          >
            <span className="live-dot" />
            {t.liveMode}
          </button>
          <button
            type="button"
            aria-pressed={mode === 'demo'}
            className={mode === 'demo' ? 'active' : ''}
            onClick={() => onMode('demo')}
            disabled={loading}
          >
            <FlaskConical size={14} />
            {t.demoMode}
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
              label={t.origin}
              lang={lang}
              value={origin}
              onChange={onOrigin}
              disabled={loading || mode === 'demo'}
            />
            <LocationField
              label={t.destination}
              lang={lang}
              value={destination}
              onChange={onDestination}
              disabled={loading || mode === 'demo'}
            />
          </div>
        </div>
        {mode === 'live' && (
          <button
            className="swap-button"
            type="button"
            disabled={loading}
            onClick={() => {
              onOrigin(destination)
              onDestination(origin)
            }}
          >
            <ArrowDownUp size={13} />
            {t.swap}
          </button>
        )}
        {mode === 'demo' && <p className="field-note demo-form-note">{t.demoRoute}</p>}
        <TextField
          className="departure-field"
          label={t.departure}
          type="datetime-local"
          size="small"
          fullWidth
          required
          value={departure}
          disabled={loading}
          onChange={(e) => onDeparture(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <p className="field-note">
          {t.localTime} · {zone}
        </p>
        <label className="cargo-label" htmlFor="cargo-input">
          <Truck size={16} />
          {t.cargo}
        </label>
        <TextField
          id="cargo-input"
          type="number"
          size="small"
          fullWidth
          value={load}
          disabled={loading}
          required
          error={!loadValid}
          onChange={(e) => onLoad(e.target.value)}
          helperText={!loadValid ? t.cargoError : undefined}
          slotProps={{
            htmlInput: { min: 0, max: 200000, step: 1, 'aria-label': t.cargo },
            input: { endAdornment: <span className="input-unit">lb</span> },
          }}
        />
        <p className="field-note">{t.cargoHelp}</p>
        <div className="sampling-label">{t.sampling}</div>
        <div className="spacing-options">
          {[10, 25, 50].map((value, index) => (
            <button
              key={value}
              type="button"
              aria-pressed={spacing === value}
              className={spacing === value ? 'active' : ''}
              onClick={() => onSpacing(value)}
              disabled={loading}
            >
              <span>
                <strong>{value}</strong> mi {spacing === value && <Check size={12} />}
              </span>
              <small>{[t.detail, t.balanced, t.fewer][index]}</small>
            </button>
          ))}
        </div>
        <p className="sampling-help">{t.samplingHelp}</p>
        <Button
          variant="contained"
          type="submit"
          fullWidth
          className="analyze-button"
          disabled={
            loading ||
            reassessing ||
            !origin ||
            !destination ||
            !loadValid ||
            !departure ||
            (mode === 'live' && retrySeconds > 0)
          }
          endIcon={
            loading || reassessing ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <ArrowRight size={17} />
            )
          }
        >
          {loading
            ? t.analyzing
            : reassessing
              ? t.loadUpdating
              : mode === 'live' && retrySeconds > 0
                ? `${lang === 'es' ? 'Disponible en' : 'Available in'} ${retrySeconds}s`
                : mode === 'demo'
                  ? t.simulate
                  : t.analyze}
        </Button>
        {loading ? (
          <button type="button" className="cancel-button" onClick={onCancel}>
            {t.cancel}
          </button>
        ) : (
          <p className={`form-footnote ${dirty ? 'changed-note' : ''}`}>
            {dirty ? t.changed : reassessing ? t.loadUpdating : t.loadUpdated}
          </p>
        )}
      </form>
    </aside>
  )
}
