export const RID_TEXT_FIELDS = [
  'kind',
  'title',
  'application_number',
  'document_number',
  'action_status',
  'egisu_created_number',
  'egisu_protection_number',
  'egisu_usage_number',
] as const

export const RID_DATE_FIELDS = ['application_date', 'egisu_created_date', 'egisu_protection_date', 'egisu_usage_date'] as const

// Белый список полей РИД из тела запроса: текст — обрезанная строка, дата — YYYY-MM-DD или null.
// partial=true — только присланные поля (PATCH), иначе все (POST).
export function pickRidFields(body: Record<string, unknown>, partial = false) {
  const out: Record<string, string | null> = {}
  for (const f of RID_TEXT_FIELDS) {
    if (partial && !(f in body)) continue
    out[f] = String(body[f] ?? '').trim()
  }
  for (const f of RID_DATE_FIELDS) {
    if (partial && !(f in body)) continue
    const v = String(body[f] ?? '').trim()
    out[f] = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
  }
  return out
}
