import { ChevronDown, Clock3 } from 'lucide-react'
import { fmt, timeAt } from '../i18n'
import type { Analysis, Route } from '../types'

export default function DeparturePlanner({
  data,
  route,
  busy,
  onApply,
}: {
  data: Analysis
  route: Route
  busy: boolean
  onApply: (offset: number) => void
}) {
  const window = data.departure_window
  const options = window?.routes[route.id]
  if (!window || !options) return null
  const best = options.candidates.find(
    (candidate) => candidate.offset_hours === options.best_offset_hours,
  )
  const current = window.current_offset_hours
  const alreadyBest = options.tied_offsets.includes(current)
  const zone = data.origin.timezone
  const changedTime = best && !alreadyBest
  const severeDifference = best ? route.summary.miles_by_risk[3] - best.summary.miles_by_risk[3] : 0
  const highDifference = best ? route.summary.miles_by_risk[2] - best.summary.miles_by_risk[2] : 0
  const reason = alreadyBest
    ? 'Your selected departure is already a best option.'
    : !route.summary.eligible
      ? 'A departure with complete weather and no No Travel segments.'
      : severeDifference > 0
        ? `${fmt(severeDifference, 'en', 1)} fewer severe miles than your selected departure.`
        : highDifference > 0
          ? `Equal severe exposure; ${fmt(highDifference, 'en', 1)} fewer high-risk miles.`
          : best && best.summary.average_risk !== route.summary.average_risk
            ? `Equal severe and high exposure; average risk ${fmt(best.summary.average_risk, 'en', 2)} instead of ${fmt(route.summary.average_risk, 'en', 2)}.`
            : 'Same weather risk; the earliest available departure is shown.'
  return (
    <section className="departure-planner" aria-label="Best departure time">
      <details className="departure-details">
        <summary className="departure-summary">
          <span className="departure-title">
            <Clock3 size={16} />
            <span>Best time to leave</span>
            <ChevronDown size={14} />
          </span>
          <strong className="best-departure">
            {best
              ? timeAt(alreadyBest ? data.departure_epoch : best.departure_epoch, zone, 'en', true)
              : 'No eligible departure'}
          </strong>
          <span className="departure-zone">
            {zone}
            {alreadyBest ? ' · Your departure is a best option' : ''}
          </span>
        </summary>
        <p className="departure-context">
          {route.id.replace('route-', 'Route ')} · 25 hourly departures
          <br />
          {timeAt(window.base_epoch, zone, 'en', true)} →{' '}
          {timeAt(window.end_epoch, zone, 'en', true)}
        </p>
        {best ? (
          <>
            <p className="departure-reason">{reason}</p>
            {options.tied_offsets.length > 1 && (
              <p className="departure-tie">
                {options.tied_offsets.length} times share the lowest weather risk.
                {!alreadyBest ? ' Earliest shown.' : ''}
              </p>
            )}
          </>
        ) : (
          <p className="departure-reason">
            No eligible departure in this window. Try another route or departure date.
          </p>
        )}
        <details className="departure-options">
          <summary>Compare hourly departures</summary>
          <p>
            Weather outlook on the current roads, with fixed driving times.{' '}
            {data.mode === 'live'
              ? 'Applying a time requests new truck routes and checks access again. Breaks are not included.'
              : 'Demo only; truck access is not checked.'}
          </p>
          <div className="departure-table-wrap">
            <table className="departure-table">
              <thead>
                <tr>
                  <th>Leave</th>
                  <th>Severe mi</th>
                  <th>High mi</th>
                  <th>Avg /4</th>
                </tr>
              </thead>
              <tbody>
                {options.candidates.map((candidate) => (
                  <tr
                    key={candidate.offset_hours}
                    className={candidate.offset_hours === current ? 'current' : ''}
                  >
                    <td>
                      <button
                        disabled={
                          busy ||
                          !candidate.available ||
                          !candidate.summary.eligible ||
                          candidate.offset_hours === current
                        }
                        onClick={() => onApply(candidate.offset_hours)}
                      >
                        {timeAt(candidate.departure_epoch, zone, 'en')}{' '}
                        {candidate.offset_hours === options.best_offset_hours ? '· Best' : ''}
                      </button>
                    </td>
                    <td>
                      {candidate.summary.eligible
                        ? fmt(candidate.summary.miles_by_risk[3], 'en', 1)
                        : candidate.summary.status === 'blocked'
                          ? 'No Travel'
                          : 'Unknown'}
                    </td>
                    <td>{fmt(candidate.summary.miles_by_risk[2], 'en', 1)}</td>
                    <td>{fmt(candidate.summary.average_risk, 'en', 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </details>
      {changedTime && (
        <button
          className="use-departure"
          disabled={busy}
          onClick={() => onApply(best!.offset_hours)}
        >
          Use this departure
        </button>
      )}
    </section>
  )
}
