import { Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material'
import { ArrowRight, X } from 'lucide-react'
import {
  weatherNumber,
  copy,
  fmt,
  pointExplanation,
  riskNames,
  timeAt,
  type Language,
} from '../i18n'
import type { Analysis, Checkpoint, Route } from '../types'
import RiskBadge from './RiskBadge'
export default function DetailsDialog({
  kind,
  data,
  route,
  lang,
  onClose,
  onPoint,
}: {
  kind: 'method' | 'points' | null
  data: Analysis | null
  route: Route | undefined
  lang: Language
  onClose: () => void
  onPoint: (point: Checkpoint) => void
}) {
  const t = copy[lang]
  return (
    <Dialog
      open={kind !== null}
      onClose={onClose}
      fullWidth
      maxWidth={kind === 'points' ? 'lg' : 'md'}
    >
      <DialogTitle className="dialog-title">
        {kind === 'points' ? t.points : t.methodTitle}
        <IconButton aria-label={t.close} onClick={onClose}>
          <X size={19} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {kind === 'points' && route && data ? (
          <>
            <p className="table-caption">
              {t.tableHelp} · {data.origin.timezone}
            </p>
            <div className="checkpoint-table-wrap">
              <table className="checkpoint-table">
                <thead>
                  <tr>
                    <th>{t.mile}</th>
                    <th>{t.arrivalTime}</th>
                    <th>{t.wind} mph</th>
                    <th>{t.rain} in/h</th>
                    <th>{t.snow} in/h</th>
                    <th>{t.risk}</th>
                    <th>{t.ruleApplied}</th>
                  </tr>
                </thead>
                <tbody>
                  {route.checkpoints.map((point) => (
                    <tr key={point.id} className={point.risk === 4 ? 'blocked-row' : ''}>
                      <td>
                        <button
                          onClick={() => {
                            onPoint(point)
                            onClose()
                          }}
                        >
                          {fmt(point.mile, lang, 1)}
                          <ArrowRight size={12} />
                        </button>
                      </td>
                      <td>{timeAt(point.eta_epoch, data.origin.timezone, lang, true)}</td>
                      <td>{weatherNumber(point.weather.wind_mph, 'wind', lang)}</td>
                      <td>{weatherNumber(point.weather.rain_in_hr, 'rain', lang)}</td>
                      <td>{weatherNumber(point.weather.snow_in_hr, 'snow', lang)}</td>
                      <td>
                        <RiskBadge risk={point.risk} lang={lang} />
                      </td>
                      <td className="rule-cell">{pointExplanation(point, data.load_lb, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="method-content">
            <p>
              {
                'Weather is sampled for the time the truck reaches each point. The trip map colors road segments using those conditions; the 48-hour explorer shows one common forecast hour across the area.'
              }
            </p>
            <h3>{t.rulesTitle}</h3>
            <p>{t.rulesIntro}</p>
            <div className="checkpoint-table-wrap">
              <table className="checkpoint-table rules-table">
                <thead>
                  <tr>
                    <th>{'Condition'}</th>
                    {riskNames[lang].map((name) => (
                      <th key={name}>{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    [`${t.wind} · mph`, '<25', '25–<35', '35–<45', '45–<55', '≥55'],
                    [`${t.rain} · in/h`, '<0.10', '0.10–<0.25', '0.25–<0.50', '0.50–1.00', '>1.00'],
                    [`${t.snow} · in/h`, '<0.5', '0.5–<1', '1–<2', '2–3', '>3'],
                  ].map((row) => (
                    <tr key={row[0]}>
                      {row.map((value, i) =>
                        i === 0 ? <th key={i}>{value}</th> : <td key={i}>{value}</td>,
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="method-note">{t.boundaries}</p>
            <h3>{t.loadRules}</h3>
            <ul>
              <li>{t.wind55}</li>
              <li>{t.wind45}</li>
              <li>{t.wind35}</li>
            </ul>
            <p>{t.exactLoads}</p>
            <h3>{t.rankTitle}</h3>
            <p>{t.rankText}</p>
            <p>{t.approximation}</p>
            <h3>{'What the two map views mean'}</h3>
            <p>
              <strong>{t.arrival}.</strong> {t.arrivalHelp}
            </p>
            <p>
              <strong>{t.forecast}.</strong> {t.forecastHelp}
            </p>
            <h3>{'Data and limits'}</h3>
            <p>{t.demoDescription}</p>
            <p>
              {t.carProfile} {t.noStops}
            </p>
            <p>
              {
                'Open-Meteo supplies live forecasts. Trip details identify the routing provider; comparison-waypoint detours are labeled on route cards.'
              }
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
