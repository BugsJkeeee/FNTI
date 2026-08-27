import { FolderIcon, WaveIcon, BanknoteIcon, AlertTriangleIcon } from './icons'
import { formatRubRounded } from './constants'
import type { PortfolioRisk } from '@/lib/project-risk'

export default function KpiCards({
  totalProjects,
  byWave,
  totalBudget,
  risk,
  onRiskClick,
}: {
  totalProjects: number
  byWave: Record<number, number>
  totalBudget: number
  risk: PortfolioRisk
  onRiskClick: () => void
}) {
  const waveEntries = Object.entries(byWave).sort((a, b) => Number(a[0]) - Number(b[0]))
  const waveColors = ['text-teal', 'text-done', 'text-normal']

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
      <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white p-3">
        <FolderIcon className="h-5 w-5 shrink-0 text-teal" />
        <div>
          <p className="font-display text-lg font-semibold text-ink">{totalProjects}</p>
          <p className="text-[11px] text-ink-soft">проектов в портфеле</p>
        </div>
      </div>
      {waveEntries.map(([wave, count], i) => (
        <div key={wave} className="flex items-center gap-2.5 rounded-xl border border-line bg-white p-3">
          <WaveIcon className={`h-5 w-5 shrink-0 ${waveColors[i % waveColors.length]}`} />
          <div>
            <p className="font-display text-lg font-semibold text-ink">{count}</p>
            <p className="text-[11px] text-ink-soft">{wave} волна</p>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white p-3">
        <BanknoteIcon className="h-5 w-5 shrink-0 text-done" />
        <div>
          <p className="font-display text-sm font-semibold text-ink">{formatRubRounded(totalBudget)}</p>
          <p className="text-[11px] text-ink-soft">договорной бюджет</p>
        </div>
      </div>
      <button
        onClick={onRiskClick}
        className="flex items-center gap-2.5 rounded-xl border border-urgent/40 bg-urgent-soft p-3 text-left transition hover:border-urgent"
      >
        <AlertTriangleIcon className="h-5 w-5 shrink-0 text-urgent" />
        <div>
          <p className="font-display text-sm font-semibold text-urgent">{formatRubRounded(risk.totalAtRiskAmount)}</p>
          <p className="text-[11px] text-urgent">
            под риском · {risk.atRiskProjectsCount} проектов · {risk.atRiskStagesCount} этапов
          </p>
        </div>
      </button>
    </div>
  )
}
