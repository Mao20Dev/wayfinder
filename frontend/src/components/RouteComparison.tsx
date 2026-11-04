import { Check, Clock3, ShieldCheck, ShieldAlert } from 'lucide-react'
import { duration } from '../api'
import { fmt, recommendationText, routeNumber, slowestExtra, type Language } from '../i18n'
import type { Analysis } from '../types'
import { RISK_COLORS } from '../types'
export default function RouteComparison({
  data,
  selected,
  lang,
  onSelect,
}: {
  data: Analysis
  selected: string
  lang: Language
  onSelect: (id: string) => void
}) {
  return (
    <section className="comparison-section" aria-label="Compare routes">
      <div className="route-options">
        {data.routes.map((route, index) => {
          const active = selected === route.id
          const recommended =
            data.recommendation.tied_route_ids.includes(route.id) ||
            route.id === data.recommendation.route_id
          const summary = route.summary
          const extra = slowestExtra(route, data)
          return (
            <button
              key={route.id}
              className={`route-card ${active ? 'active' : ''} ${summary.status}`}
              aria-pressed={active}
              onClick={() => onSelect(route.id)}
              data-route-id={route.id}
            >
              <div className="route-card-top">
                <span className="route-name">Route {index + 1}</span>
                {summary.status !== 'ready' ? (
                  <span className={`status-tag ${summary.status}`}>
                    {summary.status === 'blocked' ? 'No Travel' : 'Incomplete'}
                  </span>
                ) : recommended ? (
                  <span className="recommended-tag">
                    <Check size={12} />
                    {data.recommendation.tied_route_ids.length > 1 ? 'Joint best' : 'Best route'}
                  </span>
                ) : (
                  <span className="alternative-tag">
                    {extra > 0.5 ? `+${fmt(extra, lang)} min` : 'Fastest'}
                  </span>
                )}
              </div>
              <div className="route-metrics">
                <strong>{duration(route.duration_seconds)}</strong>
                <span>{fmt(route.distance_miles, lang)} mi</span>
              </div>
              <div className="route-exposure">
                <span>{fmt(summary.miles_by_risk[3], lang, 1)} mi severe</span>
                <span>{fmt(summary.miles_by_risk[2], lang, 1)} mi high</span>
              </div>
              <div className="risk-strip" aria-label="Estimated miles by risk category">
                {summary.miles_by_risk.map(
                  (miles, risk) =>
                    miles > 0 && (
                      <span key={risk} style={{ flex: miles, background: RISK_COLORS[risk] }} />
                    ),
                )}
                {summary.unknown_miles > 0 && (
                  <span style={{ flex: summary.unknown_miles, background: '#84909b' }} />
                )}
              </div>
              <div className="route-secondary">
                <span>Avg risk {fmt(summary.average_risk, lang, 2)} / 4</span>
                {active && (
                  <span className="selected-tag">
                    <span />
                    Selected
                  </span>
                )}
                {summary.status === 'blocked' && (
                  <strong className="danger">
                    {fmt(summary.miles_by_risk[4], lang, 1)} mi No Travel
                  </strong>
                )}
                {summary.status === 'incomplete' && (
                  <strong>{fmt(summary.unknown_miles, lang, 1)} mi unknown</strong>
                )}
              </div>
              {route.via_comparison_point && (
                <span className="via-note">Via comparison waypoint</span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
export function RecommendationBanner({ data, lang }: { data: Analysis; lang: Language }) {
  const best = data.recommendation.route_id
  const extra = data.recommendation.decision.extra_minutes_vs_fastest ?? 0
  return (
    <div className={`recommendation-banner ${best ? '' : 'warning'}`} role="status">
      {best ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
      <div>
        <h2>
          {best
            ? `${data.recommendation.tied_route_ids.length > 1 ? 'Joint best' : 'Best route'} · Route ${routeNumber(data, best)}`
            : 'No eligible route'}
        </h2>
        <p>{recommendationText(data, lang)}</p>
        {best && extra >= 0.5 && (
          <span className="time-tradeoff">
            <Clock3 size={13} />
            {fmt(extra, lang)} min longer than the fastest eligible route.
          </span>
        )}
      </div>
    </div>
  )
}
