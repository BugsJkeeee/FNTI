function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default function HighlightMatch({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim()
  if (!trimmed) return <>{text}</>

  const parts = text.split(new RegExp(`(${escapeRegExp(trimmed)})`, 'gi'))
  if (parts.length === 1) return <>{text}</>

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-teal-soft text-inherit">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}
