import { Button, CircularProgress, TextField } from '@mui/material'
import { ArrowDownUp, ArrowRight, ChevronDown, X } from 'lucide-react'
import type { Language } from '../i18n'
import type { Location } from '../types'
import LocationField from './LocationField'
import { TRUCK_FIELDS, type TruckInputs } from '../truck'
type Props = {
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
  retrySeconds: number
  truck: TruckInputs
  truckValid: boolean
  truckAvailable: boolean | null
  onTruck: (value: TruckInputs) => void
  onOrigin: (value: Location | null) => void
  onDestination: (value: Location | null) => void
  onDeparture: (value: string) => void
  onLoad: (value: string) => void
  onSpacing: (value: number) => void
  onSubmit: () => void
  onExample: () => void
  onLive: () => void
  onCancel: () => void
  onClose: () => void
}
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
  retrySeconds,
  truck,
  truckValid,
  truckAvailable,
  onTruck,
  onOrigin,
  onDestination,
  onDeparture,
  onLoad,
  onSpacing,
  onSubmit,
  onExample,
  onLive,
  onCancel,
  onClose,
}: Props) {
  const busy = loading || reassessing
  const valid =
    !!origin &&
    !!destination &&
    loadValid &&
    !!departure &&
    (mode === 'demo' || (truckValid && truckAvailable === true))
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return (
    <aside className="planning-panel">
      <form
        id="trip-form"
        onSubmit={(event) => {
          event.preventDefault()
          const profile = event.currentTarget.querySelector<HTMLDetailsElement>('.truck-options')
          if (profile && truckValid) profile.open = false
          onSubmit()
        }}
      >
        <div className="panel-title">
          <div>
            <h1>Plan your trip</h1>
            <p>Truck routes, compared by weather risk.</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Hide trip planner"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="location-fields">
          <div className="location-connector" aria-hidden="true">
            <span>A</span>
            <i />
            <span>B</span>
          </div>
          <div className="location-inputs">
            <LocationField
              label="Origin"
              lang={lang}
              value={origin}
              onChange={onOrigin}
              disabled={loading}
            />
            <LocationField
              label="Destination"
              lang={lang}
              value={destination}
              onChange={onDestination}
              disabled={loading}
            />
          </div>
        </div>
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
          Swap
        </button>
        <TextField
          className="departure-field"
          label="Departure"
          type="datetime-local"
          size="small"
          fullWidth
          required
          value={departure}
          disabled={loading}
          onChange={(event) => onDeparture(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <p className="field-note">Local time · {zone}</p>
        <TextField
          id="cargo-input"
          label="Cargo weight"
          type="number"
          size="small"
          fullWidth
          value={load}
          disabled={loading}
          required
          error={!loadValid}
          onChange={(event) => onLoad(event.target.value)}
          helperText={
            loadValid
              ? 'Used for weather rules; added to empty weight for routing.'
              : 'Enter a value from 0 to 200,000 lb.'
          }
          slotProps={{
            htmlInput: { min: 0, max: 200000, step: 1 },
            input: { endAdornment: <span className="input-unit">lb</span> },
          }}
        />
        <details className="trip-options truck-options">
          <summary>
            Truck profile{' '}
            <span>
              {truckValid ? 'Ready' : 'Required'} <ChevronDown size={14} />
            </span>
          </summary>
          <p>
            Use the actual loaded dimensions, including the trailer. Feet use decimals: 13 ft 6 in =
            13.5 ft.
          </p>
          <div className="truck-fields">
            {TRUCK_FIELDS.map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                type="number"
                size="small"
                value={truck[field.key]}
                disabled={loading}
                onChange={(event) => onTruck({ ...truck, [field.key]: event.target.value })}
                slotProps={{
                  htmlInput: { min: field.min, max: field.max, step: field.step },
                  input: { endAdornment: <span className="input-unit">{field.unit}</span> },
                }}
              />
            ))}
          </div>
          <p className="truck-gross">
            Gross weight:{' '}
            {truck.empty_weight_lb.trim() && loadValid
              ? `${(Number(truck.empty_weight_lb) + Number(load)).toLocaleString('en-US')} lb`
              : 'Enter empty weight + cargo'}
          </p>
          <p>
            Maximum loaded axle weight is the heaviest axle, not gross weight divided by axle count.
            Enter it again after changing cargo.
          </p>
          <label className="truck-confirm">
            <input
              type="checkbox"
              checked={truck.non_hazardous}
              disabled={loading}
              onChange={(event) => onTruck({ ...truck, non_hazardous: event.target.checked })}
            />{' '}
            Non-hazardous cargo only
          </label>
          {!truckValid && (
            <p>Complete all measurements and check that axle weights match the loaded truck.</p>
          )}
        </details>
        {truckAvailable === false && (
          <p className="truck-provider-status" role="status">
            Truck routing is not connected yet. You can explore the weather example below.
          </p>
        )}
        <details className="trip-options">
          <summary>
            Weather sampling{' '}
            <span>
              Every {spacing} mi <ChevronDown size={14} />
            </span>
          </summary>
          <p>Check the forecast at arrival along the road, every:</p>
          <div className="spacing-options" aria-label="Weather sampling interval">
            {[10, 25, 50].map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={value === spacing}
                className={value === spacing ? 'active' : ''}
                disabled={loading}
                onClick={() => onSpacing(value)}
              >
                {value} mi
              </button>
            ))}
          </div>
          <p>More points give a finer estimate. These are weather checks, not stops.</p>
        </details>
        <Button
          type="submit"
          variant="contained"
          fullWidth
          className="analyze-button"
          disabled={busy || !valid || (mode === 'live' && retrySeconds > 0)}
          endIcon={busy ? <CircularProgress size={16} color="inherit" /> : <ArrowRight size={17} />}
        >
          {loading
            ? 'Comparing routes...'
            : reassessing
              ? 'Updating risk...'
              : mode === 'live' && retrySeconds > 0
                ? `Available in ${retrySeconds}s`
                : mode === 'demo'
                  ? 'Update example'
                  : 'Compare truck routes'}
        </Button>
        {loading ? (
          <button type="button" className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
        ) : mode === 'demo' ? (
          <div className="example-status">
            <span>Example · simulated weather</span>
            <button
              className="text-button"
              type="button"
              onClick={onLive}
              disabled={busy || !valid || retrySeconds > 0}
            >
              Use live weather
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="example-button"
            onClick={onExample}
            disabled={busy || !loadValid || !departure}
          >
            Try a Chicago → Detroit example
          </button>
        )}
      </form>
    </aside>
  )
}
