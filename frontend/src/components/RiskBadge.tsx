import { RISK_COLORS } from '../types'
import { copy, riskNames, type Language } from '../i18n'

export default function RiskBadge({ risk, lang }: { risk: number | null; lang: Language }) {
  return (
    <span
      className="risk-badge"
      style={
        { '--risk-color': risk === null ? '#677482' : RISK_COLORS[risk] } as React.CSSProperties
      }
    >
      <i />
      {risk === null ? copy[lang].unknown : riskNames[lang][risk]}
    </span>
  )
}
