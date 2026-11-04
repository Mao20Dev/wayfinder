import { motion } from 'motion/react'
import { ArrowRight, Check, Clock3, ShieldAlert, Sparkles } from 'lucide-react'
import { duration } from '../api'
import { copy, fmt, recommendationText, routeNumber, slowestExtra, type Language } from '../i18n'
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
  const t = copy[lang]
  const best = data.recommendation.route_id
  return (
    <section className="comparison-section" aria-label={t.step2}>
      <div className="section-title">
        <h2>{t.step2}</h2>
        <span>{t.exposure}</span>
      </div>
      <div className="route-options">
        {data.routes.map((route, index) => {
          const recommended = route.id === best
          const active = selected === route.id
          const summary = route.summary
          const extraMinutes = slowestExtra(route, data)
          return (
            <motion.button
              key={route.id}
              layout
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className={`route-card ${active ? 'active' : ''} ${summary.status}`}
              aria-pressed={active}
              onClick={() => onSelect(route.id)}
              data-route-id={route.id}
            >
              {active && (
                <motion.span
                  layoutId="route-highlight"
                  className="route-highlight"
                  transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                />
              )}
              <div className="route-card-top">
                <span className="route-name">
                  <span className="route-number">{index + 1}</span>
                  {t.route} {index + 1}
                </span>
                {recommended ? (
                  <span className="recommended-tag">
                    <Sparkles size={12} />
                    {t.recommended}
                  </span>
                ) : summary.status !== 'ready' ? (
                  <span className={`status-tag ${summary.status}`}>
                    {summary.status === 'blocked' ? t.blocked : t.incomplete}
                  </span>
                ) : active ? (
                  <Check size={16} />
                ) : (
                  <ArrowRight size={15} />
                )}
              </div>
              <div className="route-metrics">
                <strong>{duration(route.duration_seconds)}</strong>
                <span>{fmt(route.distance_miles, lang)} mi</span>
              </div>
              <div className="risk-strip" aria-label={t.exposure}>
                {summary.miles_by_risk.map(
                  (miles, risk) =>
                    miles > 0 && (
                      <span key={risk} style={{ flex: miles, background: RISK_COLORS[risk] }} />
                    ),
                )}
                {summary.unknown_miles > 0 && (
                  <span style={{ flex: summary.unknown_miles, background: '#8b96a2' }} />
                )}
              </div>
              <div className="route-exposure">
                <span>
                  <i style={{ background: RISK_COLORS[3] }} />
                  {fmt(summary.miles_by_risk[3], lang, 1)} mi {t.severe.toLowerCase()}
                </span>
                <span>
                  <i style={{ background: RISK_COLORS[2] }} />
                  {fmt(summary.miles_by_risk[2], lang, 1)} mi {t.high.toLowerCase()}
                </span>
              </div>
              <div className="route-secondary">
                <span>
                  {t.average}: <strong>{fmt(summary.average_risk, lang, 2)}</strong> / 4
                </span>
                <span>
                  {extraMinutes > 0.5
                    ? `+${fmt(extraMinutes, lang)} min`
                    : lang === 'es'
                      ? 'Más rápida'
                      : 'Fastest'}
                </span>
              </div>
              {summary.status === 'blocked' && (
                <span className="via-note danger">
                  {fmt(summary.miles_by_risk[4], lang, 1)} mi · {t.blocked}
                </span>
              )}
              {route.via_comparison_point && <span className="via-note">{t.comparisonPoint}</span>}
            </motion.button>
          )
        })}
      </div>
      <p className="criteria-note">{t.criteria}</p>
    </section>
  )
}

export function RecommendationBanner({ data, lang }: { data: Analysis; lang: Language }) {
  const t = copy[lang]
  const best = data.recommendation.route_id
  const extra = data.recommendation.decision.extra_minutes_vs_fastest ?? 0
  return (
    <div className={`recommendation-banner ${best ? '' : 'warning'}`}>
      <div className="recommendation-icon">
        <ShieldAlert size={23} />
      </div>
      <div>
        <span className="eyebrow">{t.why}</span>
        <h2>
          {best ? `${t.route} ${routeNumber(data, best)} · ${t.recommended.toLowerCase()}` : t.none}
        </h2>
        <p>{recommendationText(data, lang)}</p>
        {best && extra >= 0.5 && (
          <span className="time-tradeoff">
            <Clock3 size={13} />
            {lang === 'es'
              ? `${fmt(extra, lang)} min adicionales frente a la opción elegible más rápida.`
              : `${fmt(extra, lang)} extra minutes versus the fastest eligible option.`}
          </span>
        )}
      </div>
    </div>
  )
}
