import { Bookmark, Download, ExternalLink, Trash2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material'
import { fmt, timeAt } from '../i18n'
import { downloadTruckGpx, googleMapsUrl, type SavedTrip } from '../maps'
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
  const exportable =
    data.routing_profile === 'truck' && !!data.vehicle && route.summary.eligible && !busy
  return (
    <section className="trip-actions" aria-label="Trip actions">
      <span className="planned-departure">
        Planned: {timeAt(data.departure_epoch, data.origin.timezone, 'en', true)} ·{' '}
        {data.origin.timezone}
      </span>
      <div className="trip-action-buttons">
        <button
          className="start-trip"
          disabled={!exportable}
          onClick={() => {
            if (data.vehicle)
              downloadTruckGpx(
                route.coordinates,
                data.vehicle,
                data.load_lb,
                data.vehicle_source ?? 'custom',
                data.vehicle_brand,
              )
          }}
        >
          <Download size={16} />{' '}
          {data.vehicle_source === 'example' ? 'Export example GPX' : 'Export GPX'}
        </button>
        <button className="save-trip" onClick={onSave} disabled={busy}>
          <Bookmark size={16} />
          Save route
        </button>
      </div>
      <p>
        {data.mode === 'demo'
          ? 'Weather example only. Truck access is not checked; navigation export is disabled.'
          : data.vehicle_source === 'example'
            ? 'Example truck for testing. Adjust the dimensions and axle weight for your vehicle before driving.'
            : 'Planning track only. Use a truck navigator with the same vehicle profile; GPX does not enforce restrictions. Google Maps does not support this truck profile.'}
      </p>
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
          Saved on this device. Recheck weather and truck access before driving. Google Maps
          previews use car directions.
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
              {trip.profile === 'truck' &&
                trip.vehicle &&
                trip.coordinates &&
                trip.eligible === true && (
                  <button
                    className="text-button"
                    onClick={() =>
                      downloadTruckGpx(
                        trip.coordinates!,
                        trip.vehicle!,
                        trip.load,
                        trip.vehicleSource ?? 'custom',
                        trip.vehicleBrand,
                      )
                    }
                  >
                    {trip.vehicleSource === 'example' ? 'Export example GPX' : 'Export GPX'}{' '}
                    <Download size={13} />
                  </button>
                )}
              <details>
                <summary>Car directions preview</summary>
                <p>
                  This preview drops truck restrictions and may use different roads. Do not use it
                  as truck navigation.
                </p>
                <a href={googleMapsUrl(trip.directions)} target="_blank" rel="noopener noreferrer">
                  Preview in Google Maps <ExternalLink size={13} />
                </a>
              </details>
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
