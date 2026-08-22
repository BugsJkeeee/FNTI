import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { canSetPrivateTag, isPrivateTagName } from '@/lib/tags'
import { buildDateContext, getBusinessToday } from '@/lib/date-context'
import { TECHNICAL_TEMPLATE, FINANCIAL_TEMPLATE, isStageClosed } from '@/lib/project-checklist-templates'

const PROJECT_STATUS_VALUES = ['active', 'terminating', 'terminated'] as const

export async function POST(req: NextRequest) {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { text } = await req.json()
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Нужен текст команды' }, { status: 400 })
  }

  const supabase = await createClient()
  const [{ data: tasks }, { data: allTags }, { data: projectsRaw }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, text, description, author_id, assignee_id, assignee:employees!tasks_assignee_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('tags').select('id, name'),
    supabase
      .from('projects')
      .select(
        'id, number, code, executor_short, wave, status, stages:project_stages(id, stage_number, checklist_items:project_checklist_items(template_key, done))'
      )
      .order('number', { ascending: true }),
  ])

  const taskList = (tasks ?? []) as unknown as {
    id: string
    text: string
    description: string | null
    author_id: string | null
    assignee_id: string | null
    assignee: { name: string } | null
  }[]

  const tagList = allTags ?? []

  type ProjectStageRow = { id: string; stage_number: number; checklist_items: { template_key: string | null; done: boolean }[] }
  type ProjectRow = {
    id: string
    number: number
    code: string
    executor_short: string
    wave: number
    status: 'active' | 'terminating' | 'terminated'
    stages: ProjectStageRow[]
  }
  const projectList = (projectsRaw ?? []) as unknown as ProjectRow[]

  // Текущий этап = первый не закрытый (оба финальных шага не отмечены); если все закрыты — последний.
  function currentStageOf(p: ProjectRow): ProjectStageRow | null {
    const sorted = [...p.stages].sort((a, b) => a.stage_number - b.stage_number)
    return sorted.find((s) => !isStageClosed(s.checklist_items)) ?? sorted[sorted.length - 1] ?? null
  }

  const taskContext = taskList
    .map((t) => `- id: ${t.id}, текст: "${t.text}", исполнитель: ${t.assignee?.name ?? '—'}`)
    .join('\n')

  const tagContext = tagList.map((t) => `- ${t.name}`).join('\n')

  const projectStatusLabel: Record<ProjectRow['status'], string> = {
    active: 'Действующий',
    terminating: 'Прекращаем',
    terminated: 'Прекращён',
  }
  const projectContext = projectList
    .map((p) => {
      const stage = currentStageOf(p)
      return `- id: ${p.id}, №${p.number}, шифр: "${p.code}", исполнитель: ${p.executor_short || '—'}, волна: ${p.wave}, статус: ${projectStatusLabel[p.status]}, текущий этап: ${stage?.stage_number ?? '—'}`
    })
    .join('\n')

  const checklistTemplateContext = [
    ...TECHNICAL_TEMPLATE.map((s) => `- ${s.template_key} (техническая приёмка): "${s.title}"`),
    ...FINANCIAL_TEMPLATE.map((s) => `- ${s.template_key} (финансовая приёмка): "${s.title}"`),
  ].join('\n')

  const today = getBusinessToday()
  const todayStr = today.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const dateContext = buildDateContext(today)

  const prompt = `Ты — ассистент в системе управления задачами и проектами команды. Автор (${employee.name}) даёт команду в свободной форме. Команда может быть про ЗАДАЧУ (обычное поручение сотруднику) или про ПРОЕКТ НИОКР (грантовый проект с этапами и чек-листом приёмки) — это два разных домена данных, определи, какой из них имеется в виду, по смыслу и упомянутым сущностям (шифр/номер проекта, слова "этап", "чек-лист", "требование о возврате" почти всегда означают домен "project").

Сегодня: ${todayStr}.

${dateContext}

=== Домен ЗАДАЧИ ===

Список существующих задач:
${taskContext || '(задач нет)'}

Список существующих тегов:
${tagContext || '(тегов нет)'}

=== Домен ПРОЕКТЫ ===

Список проектов (сопоставляй по шифру даже с опечатками/другим регистром — "иерархия"→"Иерархия", "гсу"→"ГСУ-500", "хит"→"ХИТ-ВА"; по номеру проекта, если назван числом; по исполнителю — для интентов, где нужен ОДИН проект (все, кроме "summary"), только если исполнитель однозначно называет ровно один проект, иначе project_id: null и объясни в reason, что нужно уточнить по шифру/номеру; для интента "summary" правило про исполнителя другое — см. пункт 10):
${projectContext || '(проектов нет)'}

Шаги чек-листа приёмки (одинаковый список для всех проектов; template_key бери ТОЛЬКО из этого списка, дословно):
${checklistTemplateContext}

Команда автора: "${text}"

Задачи:

1. Определи domain: "task" — про задачу сотрудника; "project" — про проект НИОКР; "unclear" — не похоже ни на то, ни на другое.

--- Если domain = "task" (интент = "comment" | "description" | "deadline" | "priority" | "status" | "add_tag" | "remove_tag" | "unclear"): ---
2. Определи, к какой именно задаче из списка это относится — по смыслу, а не только по точному совпадению слов. Если можешь уверенно определить ровно одну — верни её id в task_id. Если нет (нет подходящей, либо несколько одинаково подходящих) — task_id: null и коротко объясни в reason.
3. intent = "comment": извлеки текст комментария — то, что нужно написать, без служебных фраз вроде "напиши комментарий в задаче про X, что", только суть сообщения, от первого лица → task_comment_text.
4. intent = "description": извлеки текст, который нужно добавить в описание задачи, без служебных фраз, только суть, связным текстом без ошибок → task_description_text.
5. intent = "deadline": переведи новый срок в дату YYYY-MM-DD (используй таблицы дат-ориентиров выше) → task_new_deadline.
6. intent = "priority": сопоставь с одним из ТОЧНО трёх значений: "срочно", "обычный", "низкий" → task_new_priority.
7. intent = "status": сопоставь с одним из ТОЧНО трёх значений: "новая", "в работе", "выполнена". Примеры: "готово", "сделано", "закрой" → выполнена; "взял в работу", "начал делать" → в работе; "верни в новые" → новая → task_new_status.
8. intent = "add_tag"/"remove_tag": сопоставь упомянутый тег с одним из существующих (без учёта регистра), верни его название дословно из списка в task_tag_name. Если подходящего тега нет — task_tag_name: null, никогда не придумывай новый.

--- Если domain = "project" (project_intent = "comment" | "checklist_done" | "checklist_comment" | "checklist_date" | "claim_execution_date" | "status" | "summary" | "unclear"): ---
2. Определи project_id по правилам сопоставления выше. Если не удалось однозначно — project_id: null, объясни в reason.
3. Если в тексте явно назван номер этапа ("на втором этапе", "в этапе 1") — верни его в project_stage_number. Если не назван — оставь project_stage_number: null (сервер сам возьмёт текущий этап проекта, он указан в списке выше).
4. project_intent = "comment": это про раздел "Мнение Фонда НТИ" — общий комментарий по проекту, не про конкретный шаг чек-листа. Извлеки текст → project_comment_text.
5. project_intent = "checklist_done": отметить шаг чек-листа выполненным или снять отметку.
   - Триггеры "выполнено" (project_checklist_done = true): "отметь", "поставь галочку", "выполнено", "готово", "сделано", "закрыли", "прошли", "получили".
   - Триггеры "снять" (project_checklist_done = false): "сними", "отмени", "верни", "ещё не", "не готово", "не выполнено".
   - Определи template_key ТОЛЬКО из списка шагов чек-листа выше, дословно. ВАЖНО: некоторые формулировки могут совпасть по смыслу И с техническим, И с финансовым шагом (например "заключение получено" — это может быть и tech_6 "Получено и проверено заключение эксперта", и fin_6 "Заключение получено (на внутренней проверке)"). Если пользователь явно не указал "техническая"/"финансовая"/"тех"/"фин" приёмка и формулировка неоднозначна между треками — НЕ угадывай, верни project_intent: "unclear" и объясни в reason, что нужно уточнить трек.
   - ИСКЛЮЧЕНИЕ: если в формулировке явно упомянуто слово "требование" (в любом падеже) — это НИКОГДА не про шаг fin_10, а про конкретную запись требования о возврате: используй интент "claim_execution_date" (пункт 8), а не "checklist_done" с template_key "fin_10", даже если по смыслу фраза похожа на "Исполнено требование о возврате".
6. project_intent = "checklist_comment": добавить/заменить комментарий у конкретного шага чек-листа (не общий комментарий по проекту — для этого есть "comment"). Определи template_key так же, как в пункте 5. Текст комментария → project_comment_text.
7. project_intent = "checklist_date": проставить/изменить целевую дату конкретного шага чек-листа. Определи template_key так же, как в пункте 5. Дату переведи в YYYY-MM-DD (используй таблицы дат-ориентиров выше) → project_target_date.
8. project_intent = "claim_execution_date": речь про конкретное ТРЕБОВАНИЕ о возврате (фраза со словом "требование" в любой форме: "исполнили требование", "закрыли требование о возврате", "вернули деньги по требованию", "оплатили требование о возврате", "требование исполнено"). Это ВСЕГДА этот интент, а не "checklist_done" — см. исключение в пункте 5. Тебе НЕ нужно определять, какое именно требование (если их несколько на этапе) — это сделает сервер. Только дата исполнения → project_claim_execution_date (используй таблицы дат-ориентиров выше; если дата явно не названа — сегодняшняя).
9. project_intent = "status": смена статуса проекта. Сопоставь с ТОЧНО одним из трёх: "active" (триггеры: "возобновили", "снова активный", "продолжаем"), "terminating" (триггеры: "прекращаем", "останавливаем", "сворачиваем" — процесс ещё идёт), "terminated" (триггеры: "прекращён", "полностью закрыт", "завершили", "закрыт") → project_new_status.
10. project_intent = "summary": просьба дать сводку/статус/что происходит по проекту(-ам) или по исполнителю (триггеры: "сводка по", "статус проекта", "что там с", "как дела у", "расскажи про проект"). Всегда верни массив id в project_ids (даже если он один), а project_id оставь null.
   - Несколько проектов по шифру/номеру явно перечислены (например "сводка по проектам Удар и Доцент") — верни id обоих.
   - Назван ТОЛЬКО исполнитель, без конкретного шифра/номера (например "сводка по МАИ", "как дела у ЦАГИ") — это НЕ ошибка неоднозначности, а намеренный запрос сводки по ВСЕМ проектам этого исполнителя: найди в списке все проекты, где поле "исполнитель" совпадает (без учёта регистра, по вхождению подстроки), и верни id их всех.
   - Если что-то из названного не удалось определить (ни как шифр/номер, ни как исполнитель) — верни то, что определилось, и объясни в reason, что именно не нашлось.

Верни ТОЛЬКО валидный JSON без markdown-разметки, строго в таком формате (поля домена, который не используется, ставь null):
{
  "domain": "task" | "project" | "unclear",
  "intent": "comment" | "description" | "deadline" | "priority" | "status" | "add_tag" | "remove_tag" | "unclear" | null,
  "task_id": "id задачи из списка выше или null",
  "task_comment_text": "текст или null",
  "task_description_text": "текст или null",
  "task_new_deadline": "YYYY-MM-DD или null",
  "task_new_priority": "срочно" | "обычный" | "низкий" | null,
  "task_new_status": "новая" | "в работе" | "выполнена" | null,
  "task_tag_name": "название тега из списка выше или null",
  "project_intent": "comment" | "checklist_done" | "checklist_comment" | "checklist_date" | "claim_execution_date" | "status" | "summary" | "unclear" | null,
  "project_id": "id проекта из списка выше или null",
  "project_ids": ["id1", "id2", "..."] или null — заполняется ТОЛЬКО для project_intent "summary",
  "project_stage_number": число или null,
  "project_template_key": "template_key из списка шагов выше или null",
  "project_checklist_done": true | false | null,
  "project_comment_text": "текст или null",
  "project_target_date": "YYYY-MM-DD или null",
  "project_claim_execution_date": "YYYY-MM-DD или null",
  "project_new_status": "active" | "terminating" | "terminated" | null,
  "reason": "если что-то null из-за неоднозначности или domain unclear — короткое объяснение на русском, иначе пустая строка"
}`

  const candidateModels = [
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'openrouter/free',
  ]

  async function callOpenRouter(model: string, signal: AbortSignal) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Team Task Manager',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        // Схема ответа выросла (домены "задача" + "проект" в одном JSON, 17 полей), а для сводки
        // по исполнителю модель перебирает вслух весь список из полусотни проектов — reasoning-модели
        // (Nemotron) иногда упирались в лимит токенов на самих рассуждениях раньше, чем доходили до
        // JSON (finish_reason: "length", content: null). Увеличенный запас снижает этот риск.
        max_tokens: 4000,
      }),
    })

    if (!res.ok) throw new Error(`${model}: HTTP ${res.status}`)

    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content ?? '').trim()
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    return JSON.parse(cleaned)
  }

  try {
    const controller = new AbortController()
    const parsed = await Promise.any(candidateModels.map((model) => callOpenRouter(model, controller.signal)))
    controller.abort()

    if (parsed.domain === 'project' && parsed.project_intent === 'summary') {
      return await handleProjectSummary(supabase, projectList, parsed.project_ids ?? [], parsed.reason ?? '')
    }

    if (parsed.domain === 'project') {
      return await handleProjectIntent(supabase, employee.id, projectList, currentStageOf, parsed)
    }

    return await handleTaskIntent(supabase, employee.id, taskList, tagList, parsed, text)
  } catch (err) {
    if (err instanceof AggregateError) {
      console.error('AI command error: all models failed', err.errors.map((e) => String(e)))
    } else {
      console.error('AI command error:', err)
    }
    return NextResponse.json({ error: 'Не удалось получить ответ от ИИ. Попробуй ещё раз.' }, { status: 500 })
  }
}

type ProjectStageRow = { id: string; stage_number: number; checklist_items: { template_key: string | null; done: boolean }[] }
type ProjectRow = {
  id: string
  number: number
  code: string
  executor_short: string
  wave: number
  status: 'active' | 'terminating' | 'terminated'
  stages: ProjectStageRow[]
}

const PROJECT_STATUS_LABEL: Record<ProjectRow['status'], string> = {
  active: 'Действующий',
  terminating: 'Прекращаем',
  terminated: 'Прекращён',
}

const TRACK_LABEL_RU = { technical: 'тех. приёмка', financial: 'фин. приёмка' } as const

// Сводка по проекту — ВСЯ фактура (статус, шаги чек-листа, суммы) считается кодом, не ИИ:
// деньги и статусы нельзя доверять генеративной модели, ИИ только помог понять команду
// (какие проекты и что именно нужно). Ничего никуда не сохраняется — просто ответ в чат.
async function handleProjectSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectList: ProjectRow[],
  projectIds: string[],
  reason: string
) {
  const matchedBasic = projectList.filter((p) => projectIds.includes(p.id))
  if (matchedBasic.length === 0) {
    return NextResponse.json(
      { error: reason || 'Не удалось понять, по каким проектам нужна сводка. Уточни шифр или номер.' },
      { status: 422 }
    )
  }

  const { data: richProjectsRaw, error } = await supabase
    .from('projects')
    .select(
      'id, number, code, status, stages:project_stages(stage_number, checklist_items:project_checklist_items(track, template_key, step_order, title, target_date, done)), payments:project_payments(plan_year, obligation_amount, paid_amount, actually_paid), comments:project_comments(text, created_at, author:employees(name))'
    )
    .in('id', projectIds)
    .order('number', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type RichChecklistItem = { track: string; template_key: string | null; step_order: number; title: string; target_date: string | null; done: boolean }
  type RichProject = {
    id: string
    number: number
    code: string
    status: ProjectRow['status']
    stages: { stage_number: number; checklist_items: RichChecklistItem[] }[]
    payments: { plan_year: number | null; obligation_amount: number | null; paid_amount: number | null; actually_paid: boolean }[]
    comments: { text: string; created_at: string; author: { name: string } | null }[]
  }
  const richProjects = (richProjectsRaw ?? []) as unknown as RichProject[]

  const todayISO = new Date().toLocaleDateString('en-CA')
  const currentYear = new Date().getFullYear()

  function trackText(items: RichChecklistItem[], track: 'technical' | 'financial') {
    const trackItems = items.filter((i) => i.track === track).sort((a, b) => a.step_order - b.step_order)
    if (trackItems.length === 0) return '—'
    const next = trackItems.find((i) => !i.done)
    if (!next) return 'все шаги выполнены, действий не требуется'
    if (next.target_date && next.target_date > todayISO) {
      return `по плану, ближайший шаг «${next.title}» запланирован на ${new Date(next.target_date).toLocaleDateString('ru-RU')}`
    }
    const overdue = !!next.target_date && next.target_date < todayISO
    return `${overdue ? 'просрочен шаг' : 'ожидается шаг'} «${next.title}»${next.target_date ? ` (${new Date(next.target_date).toLocaleDateString('ru-RU')})` : ''}`
  }

  const summaries = (richProjects ?? []).map((p) => {
    const stages = [...(p.stages ?? [])].sort((a, b) => a.stage_number - b.stage_number)
    const stage = stages.find((s) => !isStageClosed(s.checklist_items)) ?? stages[stages.length - 1] ?? null

    const duePayments = (p.payments ?? []).filter((pay) => (pay.plan_year ?? 0) <= currentYear)
    const obligation = duePayments.reduce((acc, pay) => acc + (Number(pay.obligation_amount) || 0), 0)
    const paid = duePayments.reduce((acc, pay) => acc + (Number(pay.paid_amount) || 0), 0)
    const financeText =
      duePayments.length === 0
        ? 'нет данных по платежам'
        : Math.abs(obligation - paid) < 1
          ? `доведено полностью, ${paid.toLocaleString('ru-RU')} ₽ (план на ${currentYear} год)`
          : `доведено ${paid.toLocaleString('ru-RU')} из ${obligation.toLocaleString('ru-RU')} ₽ (план на ${currentYear} год), остаток ${(obligation - paid).toLocaleString('ru-RU')} ₽`

    const comments = [...(p.comments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3)
    const commentsText = comments.length ? comments.map((c) => `«${c.text}» — ${c.author?.name ?? '—'}`).join('; ') : 'мнений пока нет'

    const lines = [
      `№${p.number} «${p.code}» — ${PROJECT_STATUS_LABEL[p.status]}`,
      stage
        ? `Этап ${stage.stage_number}: ${TRACK_LABEL_RU.technical} — ${trackText(stage.checklist_items, 'technical')}; ${TRACK_LABEL_RU.financial} — ${trackText(stage.checklist_items, 'financial')}`
        : 'Этапов пока нет',
      `Финансирование: ${financeText}`,
      `Мнение Фонда НТИ: ${commentsText}`,
    ]

    return { project_id: p.id, project_code: p.code, text: lines.join('\n') }
  })

  return NextResponse.json({ type: 'project_summary', summaries, reason })
}

async function handleProjectIntent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string,
  projectList: ProjectRow[],
  currentStageOf: (p: ProjectRow) => ProjectStageRow | null,
  parsed: {
    project_intent?: string
    project_id?: string | null
    project_stage_number?: number | null
    project_template_key?: string | null
    project_checklist_done?: boolean | null
    project_comment_text?: string | null
    project_target_date?: string | null
    project_claim_execution_date?: string | null
    project_new_status?: string | null
    reason?: string
  }
) {
  const project = projectList.find((p) => p.id === parsed.project_id)
  if (!project) {
    return NextResponse.json(
      { error: parsed.reason || 'Не удалось понять, к какому проекту это относится. Уточни шифр или номер.' },
      { status: 422 }
    )
  }

  const stage = parsed.project_stage_number
    ? project.stages.find((s) => s.stage_number === parsed.project_stage_number)
    : currentStageOf(project)

  if (parsed.project_intent === 'comment') {
    if (!parsed.project_comment_text) {
      return NextResponse.json({ error: 'Не понял, что написать в комментарии.' }, { status: 422 })
    }
    const { data: comment, error } = await supabase
      .from('project_comments')
      .insert({ project_id: project.id, author_id: employeeId, text: parsed.project_comment_text })
      .select('*, author:employees(id, name)')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({
      type: 'project_comment_posted',
      project_id: project.id,
      project_code: project.code,
      comment_text: comment.text,
    })
  }

  if (!stage) {
    return NextResponse.json({ error: `У проекта «${project.code}» не нашлось подходящего этапа.` }, { status: 422 })
  }

  if (parsed.project_intent === 'checklist_done' || parsed.project_intent === 'checklist_comment' || parsed.project_intent === 'checklist_date') {
    if (!parsed.project_template_key) {
      return NextResponse.json(
        { error: parsed.reason || 'Не понял, к какому шагу чек-листа это относится. Уточни техническая или финансовая приёмка.' },
        { status: 422 }
      )
    }
    const { data: item, error: findErr } = await supabase
      .from('project_checklist_items')
      .select('*')
      .eq('stage_id', stage.id)
      .eq('template_key', parsed.project_template_key)
      .maybeSingle()
    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
    if (!item) {
      return NextResponse.json({ error: 'ИИ предложил несуществующий шаг чек-листа. Попробуй переформулировать.' }, { status: 422 })
    }

    const updates: Record<string, unknown> = {}
    let fieldLabel = ''
    let newValueLabel = ''

    if (parsed.project_intent === 'checklist_done') {
      const done = !!parsed.project_checklist_done
      updates.done = done
      updates.done_at = done ? new Date().toISOString() : null
      updates.done_by = done ? employeeId : null
      fieldLabel = 'отметка'
      newValueLabel = done ? 'выполнено' : 'снята отметка'
    } else if (parsed.project_intent === 'checklist_comment') {
      if (!parsed.project_comment_text) {
        return NextResponse.json({ error: 'Не понял, что написать в комментарии к шагу.' }, { status: 422 })
      }
      updates.comment = parsed.project_comment_text
      fieldLabel = 'комментарий к шагу'
      newValueLabel = parsed.project_comment_text
    } else {
      if (!parsed.project_target_date) {
        return NextResponse.json({ error: 'Не понял новую дату.' }, { status: 422 })
      }
      updates.target_date = parsed.project_target_date
      fieldLabel = 'дата шага'
      newValueLabel = new Date(parsed.project_target_date).toLocaleDateString('ru-RU')
    }

    const { error } = await supabase.from('project_checklist_items').update(updates).eq('id', item.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      type: 'project_updated',
      project_id: project.id,
      project_code: project.code,
      field: fieldLabel,
      step_title: item.title,
      new_value: newValueLabel,
    })
  }

  if (parsed.project_intent === 'claim_execution_date') {
    const executionDate = parsed.project_claim_execution_date || new Date().toISOString().slice(0, 10)
    const { data: openClaims, error: findErr } = await supabase
      .from('project_claims')
      .select('id, claim_number')
      .eq('stage_id', stage.id)
      .is('claim_execution_date', null)
    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })

    if (!openClaims || openClaims.length === 0) {
      return NextResponse.json(
        { error: `У проекта «${project.code}» на этапе ${stage.stage_number} нет требований о возврате без даты исполнения.` },
        { status: 422 }
      )
    }
    if (openClaims.length > 1) {
      return NextResponse.json(
        { error: `На этапе ${stage.stage_number} проекта «${project.code}» несколько незакрытых требований — уточни в разделе «Дополнительная информация» на странице проекта, какое именно.` },
        { status: 422 }
      )
    }

    const { error } = await supabase
      .from('project_claims')
      .update({ claim_execution_date: executionDate })
      .eq('id', openClaims[0].id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      type: 'project_updated',
      project_id: project.id,
      project_code: project.code,
      field: 'дата исполнения требования',
      step_title: `Требование № ${openClaims[0].claim_number || '—'}`,
      new_value: new Date(executionDate).toLocaleDateString('ru-RU'),
    })
  }

  if (parsed.project_intent === 'status') {
    const newStatus = parsed.project_new_status
    if (!newStatus || !PROJECT_STATUS_VALUES.includes(newStatus as (typeof PROJECT_STATUS_VALUES)[number])) {
      return NextResponse.json({ error: 'Не понял новый статус проекта.' }, { status: 422 })
    }
    const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', project.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const label: Record<string, string> = { active: 'Действующий', terminating: 'Прекращаем', terminated: 'Прекращён' }
    return NextResponse.json({
      type: 'project_updated',
      project_id: project.id,
      project_code: project.code,
      field: 'статус проекта',
      step_title: project.code,
      new_value: label[newStatus] ?? newStatus,
    })
  }

  return NextResponse.json({ error: parsed.reason || 'Не понял команду по проекту. Сформулируй точнее.' }, { status: 422 })
}

async function handleTaskIntent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string,
  taskList: {
    id: string
    text: string
    description: string | null
    author_id: string | null
    assignee_id: string | null
    assignee: { name: string } | null
  }[],
  tagList: { id: string; name: string }[],
  parsed: {
    intent?: string
    task_id?: string | null
    task_comment_text?: string | null
    task_description_text?: string | null
    task_new_deadline?: string | null
    task_new_priority?: string | null
    task_new_status?: string | null
    task_tag_name?: string | null
    reason?: string
  },
  originalText: string
) {
  if (!parsed.task_id) {
    if (parsed.intent === 'comment') {
      return NextResponse.json({
        type: 'comment_needs_choice',
        reason: parsed.reason || 'Не понял, к какой задаче это относится.',
        suggested_text: parsed.task_comment_text || originalText,
        candidates: taskList.map((t) => ({ id: t.id, text: t.text })),
      })
    }
    return NextResponse.json(
      { error: parsed.reason || 'Не удалось понять, к какой задаче это относится. Сформулируй точнее.' },
      { status: 422 }
    )
  }

  const matchedTask = taskList.find((t) => t.id === parsed.task_id)
  if (!matchedTask) {
    return NextResponse.json({ error: 'ИИ предложил несуществующую задачу. Попробуй переформулировать команду.' }, { status: 422 })
  }

  if (parsed.intent === 'comment') {
    if (!parsed.task_comment_text) {
      return NextResponse.json({ error: 'Не понял, что написать в комментарии.' }, { status: 422 })
    }
    const { data: comment, error } = await supabase
      .from('task_comments')
      .insert({ task_id: parsed.task_id, author_id: employeeId, text: parsed.task_comment_text })
      .select('*, author:employees(id, name)')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('task_history').insert({
      task_id: parsed.task_id,
      changed_by: employeeId,
      change_description: 'Добавлен комментарий (через ИИ-команду)',
    })
    return NextResponse.json({ type: 'comment_posted', task_id: parsed.task_id, task_text: matchedTask.text, comment_text: comment.text })
  }

  if (parsed.intent === 'description') {
    const isAuthor = matchedTask.author_id === employeeId
    const isAssignee = matchedTask.assignee_id === employeeId
    if (!isAuthor && !isAssignee) {
      return NextResponse.json(
        { error: `Нет прав менять описание задачи «${matchedTask.text}» — редактировать может только автор или исполнитель.` },
        { status: 403 }
      )
    }
    if (!parsed.task_description_text) {
      return NextResponse.json({ error: 'Не понял, что добавить в описание.' }, { status: 422 })
    }
    const newDescription = matchedTask.description
      ? `${matchedTask.description}\n\n${parsed.task_description_text}`
      : parsed.task_description_text
    const { error } = await supabase.from('tasks').update({ description: newDescription }).eq('id', parsed.task_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('task_history').insert({
      task_id: parsed.task_id,
      changed_by: employeeId,
      change_description: 'Изменено через ИИ-команду: описание обновлено',
    })
    return NextResponse.json({
      type: 'task_updated',
      task_id: parsed.task_id,
      task_text: matchedTask.text,
      field: 'description',
      new_value: parsed.task_description_text,
    })
  }

  if (parsed.intent === 'deadline' || parsed.intent === 'priority') {
    const isAuthor = matchedTask.author_id === employeeId
    const isAssignee = matchedTask.assignee_id === employeeId
    if (!isAuthor && !isAssignee) {
      return NextResponse.json(
        { error: `Нет прав менять задачу «${matchedTask.text}» — редактировать может только автор или исполнитель.` },
        { status: 403 }
      )
    }
    const field = parsed.intent === 'deadline' ? 'deadline' : 'priority'
    const newValue = parsed.intent === 'deadline' ? parsed.task_new_deadline : parsed.task_new_priority
    if (!newValue) {
      return NextResponse.json({ error: 'Не понял новое значение срока/приоритета.' }, { status: 422 })
    }
    const { error } = await supabase.from('tasks').update({ [field]: newValue }).eq('id', parsed.task_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('task_history').insert({
      task_id: parsed.task_id,
      changed_by: employeeId,
      change_description: `Изменено через ИИ-команду: ${field === 'deadline' ? 'срок' : 'приоритет'} → ${newValue}`,
    })
    return NextResponse.json({ type: 'task_updated', task_id: parsed.task_id, task_text: matchedTask.text, field, new_value: newValue })
  }

  if (parsed.intent === 'status') {
    const isAssignee = matchedTask.assignee_id === employeeId
    if (!isAssignee) {
      return NextResponse.json({ error: `Менять статус может только исполнитель задачи «${matchedTask.text}».` }, { status: 403 })
    }
    if (!parsed.task_new_status || !['новая', 'в работе', 'выполнена'].includes(parsed.task_new_status)) {
      return NextResponse.json({ error: 'Не понял новый статус.' }, { status: 422 })
    }
    const { error } = await supabase.from('tasks').update({ status: parsed.task_new_status }).eq('id', parsed.task_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('task_history').insert({
      task_id: parsed.task_id,
      changed_by: employeeId,
      change_description: `Изменено через ИИ-команду: статус → ${parsed.task_new_status}`,
    })
    return NextResponse.json({
      type: 'task_updated',
      task_id: parsed.task_id,
      task_text: matchedTask.text,
      field: 'status',
      new_value: parsed.task_new_status,
    })
  }

  if (parsed.intent === 'add_tag' || parsed.intent === 'remove_tag') {
    if (!parsed.task_tag_name) {
      return NextResponse.json(
        { error: 'Не нашёл такой тег среди существующих. Создать новый можно на странице «Глоссарий».' },
        { status: 422 }
      )
    }
    const tag = tagList.find((t) => t.name.toLowerCase() === String(parsed.task_tag_name).toLowerCase())
    if (!tag) {
      return NextResponse.json({ error: 'ИИ предложил несуществующий тег. Попробуй переформулировать команду.' }, { status: 422 })
    }
    if (isPrivateTagName(tag.name) && !canSetPrivateTag(matchedTask.author_id, matchedTask.assignee_id, employeeId)) {
      return NextResponse.json(
        { error: `Тег «${tag.name}» можно ставить/убирать только на задаче, где ты одновременно и автор, и исполнитель.` },
        { status: 403 }
      )
    }

    if (parsed.intent === 'add_tag') {
      const { error } = await supabase
        .from('task_tags')
        .upsert({ task_id: parsed.task_id, tag_id: tag.id }, { onConflict: 'task_id,tag_id', ignoreDuplicates: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from('task_tags').delete().eq('task_id', parsed.task_id).eq('tag_id', tag.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('task_history').insert({
      task_id: parsed.task_id,
      changed_by: employeeId,
      change_description: `Изменено через ИИ-команду: тег «${tag.name}» ${parsed.intent === 'add_tag' ? 'добавлен' : 'убран'}`,
    })

    return NextResponse.json({
      type: 'task_updated',
      task_id: parsed.task_id,
      task_text: matchedTask.text,
      field: parsed.intent === 'add_tag' ? 'tag_added' : 'tag_removed',
      new_value: tag.name,
    })
  }

  return NextResponse.json({ error: 'Не понял команду. Уточни, что нужно сделать.' }, { status: 422 })
}
