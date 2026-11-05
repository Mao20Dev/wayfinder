import { Bookmark, Navigation, ExternalLink, Trash2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material'
import { fmt, timeAt } from '../i18n'
import { googleMapsUrl, routeDirections, type SavedTrip } from '../maps'
import type { Analysis, Route } from '../types'

export function TripActions({
  data,
  route,
  busy,
  onSave,
}: {
  data: Analysis
  route: Route
  busy: boolean
  onSave: () => void
}) {
  const ready = route.summary.eligible && !busy
  return (
    <section className="trip-actions" aria-label="Trip actions">
      <span className="planned-departure">
        Planned: {timeAt(data.departure_epoch, data.origin.timezone, 'en', true)} ·{' '}
        {data.origin.timezone}
      </span>
      <div className="trip-action-buttons">
        {ready ? (
          <a
            className="start-trip"
            href={googleMapsUrl(routeDirections(route), data.mode === 'live')}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation size={16} /> Open in Google Maps <ExternalLink size={13} />
          </a>
        ) : (
          <button className="start-trip" disabled>
            <Navigation size={16} /> Open in Google Maps
          </button>
        )}
        <button className="save-trip" onClick={onSave} disabled={busy}>
          <Bookmark size={16} />
          Save route
        </button>
      </div>
      <p>Maps may change the route; truck settings are not transferred.</p>
    </section>
  )
}

export function SavedTripsDialog({
  open,
  trips,
  onClose,
  onRemove,
}: {
  open: boolean
  trips: SavedTrip[]
  onClose: () => void
  onRemove: (id: string) => void
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle className="dialog-title">
        Saved routes
        <IconButton aria-label="Close saved routes" onClick={onClose}>
          <X size={19} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <p className="saved-intro">
          Saved on this device. Recheck weather before leaving. Maps may change the route and does
          not receive truck settings.
        </p>
        {!trips.length && <p className="saved-empty">Save a route after comparing your trip.</p>}
        {trips.map((trip) => (
          <article className="saved-trip" key={trip.id}>
            <div>
              <h3>
                {trip.originName.split(',')[0]} → {trip.destinationName.split(',')[0]}
              </h3>
              <p>
                {trip.routeName} · {fmt(trip.load, 'en')} lb
              </p>
              <p>
                {trip.profile === 'truck'
                  ? trip.vehicleSource === 'example'
                    ? 'Example truck route · adjust before driving'
                    : 'Truck planning route'
                  : trip.profile === 'weather_demo'
                    ? 'Weather example · not for navigation'
                    : 'Legacy car route · compare again for a truck'}
              </p>
              <p>
                Planned {timeAt(trip.departure, trip.timezone ?? 'UTC', 'en', true)} ·{' '}
                {trip.timezone ?? 'UTC'}
              </p>
              <a
                href={googleMapsUrl(
                  trip.directions,
                  trip.profile === 'truck' && trip.eligible === true,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Google Maps <ExternalLink size={13} />
              </a>
            </div>
            <button
              className="icon-button"
              aria-label={`Remove saved ${trip.routeName}`}
              onClick={() => onRemove(trip.id)}
            >
              <Trash2 size={16} />
            </button>
          </article>
        ))}
      </DialogContent>
    </Dialog>
  )
}
