import Link from 'next/link'

interface ActivityItem {
  id: string
  task_id: string
  change_description: string
  changed_at: string
  changed_by_name: string | null
  task_text: string | null
}

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-soft">Пока ничего не происходило.</p>
  }

  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id} className="py-2.5">
          <Link href={`/tasks/${item.task_id}`} className="block hover:text-teal">
            <p className="text-sm text-ink">
              <span className="font-medium">{item.changed_by_name ?? 'Кто-то'}</span>
              {' — '}
              {item.change_description.toLowerCase()}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-ink-soft">
              {item.task_text} · {new Date(item.changed_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
