'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Project } from '@/types'
import { currentStageOf, trackStatus } from '@/lib/project-status'

const STATUS_LABEL: Record<Project['status'], string> = {
  active: 'Действующий',
  terminated: 'Прекращён',
}

function latestComment(project: Project) {
  const comments = [...(project.comments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return comments[0] ?? null
}

function AddProjectForm({ onCreated }: { onCreated: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [number, setNumber] = useState('')
  const [wave, setWave] = useState('1')
  const [code, setCode] = useState('')
  const [topic, setTopic] = useState('')
  const [executorShort, setExecutorShort] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function collapse() {
    setExpanded(false)
    setNumber('')
    setCode('')
    setTopic('')
    setExecutorShort('')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!number.trim() || !code.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: Number(number),
          wave: Number(wave),
          code,
          topic,
          executor_short: executorShort,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Не удалось создать проект')
        return
      }
      collapse()
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-ink-soft transition hover:border-teal hover:text-teal"
      >
        <span className="text-base font-semibold text-teal">+</span> Добавить проект
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Номер проекта</label>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            type="number"
            required
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Волна</label>
          <select
            value={wave}
            onChange={(e) => setWave(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Шифр</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Исполнитель (кратко)</label>
          <input
            value={executorShort}
            onChange={(e) => setExecutorShort(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">Тема НИОКР</label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
        />
      </div>

      {error && <p className="rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Создаю…' : 'Создать проект'}
        </button>
        <button type="button" onClick={collapse} className="rounded-lg px-2 py-2 text-sm text-ink-soft transition hover:text-ink">
          Отмена
        </button>
      </div>
    </form>
  )
}

function ProjectRow({ project, displayNumber }: { project: Project; displayNumber: number }) {
  const stage = currentStageOf(project)
  const tech = trackStatus(stage, 'technical')
  const fin = trackStatus(stage, 'financial')
  const comment = latestComment(project)
  const stages = project.stages ?? []
  const dormant = stages.length > 0 && tech.planned && fin.planned

  return (
    <div className="flex items-center gap-3">
      <div className="w-6 shrink-0 text-right font-mono text-xs text-ink-soft">{displayNumber}</div>
      <Link
        href={`/projects/${project.id}`}
        className={`relative grid flex-1 grid-cols-1 items-center gap-3 rounded-2xl border p-4 transition sm:grid-cols-4 ${
          dormant ? 'border-line bg-paper opacity-70 hover:border-ink-soft' : 'border-line bg-white hover:border-teal'
        }`}
      >
        {project.has_unread_comment && (
          <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-urgent ring-2 ring-paper" />
        )}
        <div>
          <div className="flex items-center gap-1.5">
            <div className="font-mono text-[11px] text-ink-soft">ID {project.number}</div>
            <span
              className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                project.status === 'terminated' ? 'bg-urgent-soft text-urgent' : 'bg-teal-soft text-teal'
              }`}
            >
              {STATUS_LABEL[project.status]}
            </span>
          </div>
          <div className="mt-0.5 text-sm font-semibold text-ink">{project.code}</div>
          <div className="mt-0.5 text-xs text-ink-soft">Исполнитель: {project.executor_short || '—'}</div>
        </div>
        <div>
          <div className="text-[11px] text-ink-soft">Техническая приёмка</div>
          <div className={`mt-0.5 text-sm ${tech.overdue ? 'font-medium text-overdue' : tech.planned ? 'text-ink-soft' : 'text-ink'}`}>
            {stages.length ? (tech.planned ? tech.text : `Этап ${stage?.stage_number} · ${tech.text}`) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-ink-soft">Финансовая приёмка</div>
          <div className={`mt-0.5 text-sm ${fin.overdue ? 'font-medium text-overdue' : fin.planned ? 'text-ink-soft' : 'text-ink'}`}>
            {stages.length ? (fin.planned ? fin.text : `Этап ${stage?.stage_number} · ${fin.text}`) : '—'}
          </div>
        </div>
        <div className="border-t border-line pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
          <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            <span>Мнение Фонда НТИ</span>
            {!!project.comment_count && (
              <span className="flex items-center gap-1 font-mono">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                  <path d="M2 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-4 3.5V14H4a2 2 0 0 1-2-2V4Z" />
                </svg>
                {project.comment_count}
              </span>
            )}
          </div>
          <div className="mt-0.5 line-clamp-2 text-sm text-ink">
            {comment ? `«${comment.text}» — ${comment.author?.name ?? '—'}` : <span className="text-ink-soft">нет комментариев</span>}
          </div>
        </div>
      </Link>
    </div>
  )
}

export default function ProjectList({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState(initialProjects)
  const [query, setQuery] = useState('')
  const [waveFilter, setWaveFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  async function refresh() {
    const res = await fetch('/api/projects')
    if (res.ok) setProjects(await res.json())
  }

  const waves = useMemo(() => [...new Set(projects.map((p) => p.wave))].sort((a, b) => a - b), [projects])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((p) => {
      if (waveFilter && String(p.wave) !== waveFilter) return false
      if (statusFilter && p.status !== statusFilter) return false
      if (!q) return true
      return (
        String(p.number).includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.topic.toLowerCase().includes(q) ||
        p.executor_short.toLowerCase().includes(q) ||
        p.executor_full.toLowerCase().includes(q)
      )
    })
  }, [projects, query, waveFilter, statusFilter])

  const byWave = useMemo(() => {
    const map = new Map<number, Project[]>()
    filtered.forEach((p) => {
      const list = map.get(p.wave) ?? []
      list.push(p)
      map.set(p.wave, list)
    })
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [filtered])

  // Сквозная нумерация 1..N в порядке, полученном от сервера (wave, display_order, number) —
  // считается по полному списку, чтобы номера не съезжали при включённом фильтре.
  const displayNumbers = useMemo(() => {
    const map = new Map<string, number>()
    projects.forEach((p, i) => map.set(p.id, i + 1))
    return map
  }, [projects])

  return (
    <div className="space-y-8">
      <AddProjectForm onCreated={refresh} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по ID, шифру, теме, исполнителю…"
          className="min-w-[240px] flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-teal"
        />
        <Link
          href="/api/projects/export"
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink-soft transition hover:border-teal hover:text-teal"
        >
          Экспорт в Excel
        </Link>
        <select
          value={waveFilter}
          onChange={(e) => setWaveFilter(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-teal"
        >
          <option value="">Все волны</option>
          {waves.map((w) => (
            <option key={w} value={w}>{w} волна</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-teal"
        >
          <option value="">Любой статус</option>
          <option value="active">Действующие</option>
          <option value="terminated">Прекращённые</option>
        </select>
      </div>

      {byWave.map(([wave, waveProjects]) => (
        <section key={wave}>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">{wave} волна</h2>
          <div className="space-y-3">
            {waveProjects.map((p) => (
              <ProjectRow key={p.id} project={p} displayNumber={displayNumbers.get(p.id) ?? 0} />
            ))}
          </div>
        </section>
      ))}

      {projects.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">Проектов пока нет.</p>
      )}
      {projects.length > 0 && filtered.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">Ничего не найдено по этому фильтру.</p>
      )}
    </div>
  )
}
