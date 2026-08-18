import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { isPrivateTagName } from '@/lib/tags'
import { buildDateContext, getBusinessToday } from '@/lib/date-context'

export async function POST(req: NextRequest) {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { text, assigneeHint, deadlineText, importanceText } = await req.json()
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Нужен текст задачи' }, { status: 400 })
  }

  const supabase = await createClient()
  const [{ data: employees }, { data: activeTasks }, { data: glossaryEntries }, { data: allTags }] = await Promise.all([
    supabase.from('employees').select('id, name, specialization'),
    supabase.from('tasks').select('assignee_id').in('status', ['новая', 'в работе']),
    supabase.from('glossary_entries').select('text').order('created_at', { ascending: true }),
    supabase.from('tags').select('id, name'),
  ])

  const suggestableTags = (allTags ?? []).filter((t) => !isPrivateTagName(t.name))

  const glossaryContext = (glossaryEntries ?? []).map((g) => `- ${g.text}`).join('\n')
  const tagContext = suggestableTags.map((t) => `- ${t.name}`).join('\n')

  const workload = new Map<string, number>()
  activeTasks?.forEach((t) => {
    if (t.assignee_id) workload.set(t.assignee_id, (workload.get(t.assignee_id) ?? 0) + 1)
  })

  const teamContext = (employees ?? [])
    .map((e) => `- id: ${e.id}, имя: ${e.name}, специализация: ${e.specialization ?? 'не указана'}, активных задач сейчас: ${workload.get(e.id) ?? 0}`)
    .join('\n')

  const today = getBusinessToday()
  const todayStr = today.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const todayISO = today.toLocaleDateString('en-CA')
  const dateContext = buildDateContext(today)

  const prompt = `Ты — ассистент в системе управления задачами команды. Автор (id: ${employee.id}, имя: ${employee.name}) вводит задачу. Твоя работа — привести данные в структурированный вид.

Сегодня: ${todayStr}.

${dateContext}

Участники команды:
${teamContext || '(список пуст)'}

Глоссарий проекта (термины, клиенты, сокращения команды — учитывай при понимании текста задачи):
${glossaryContext || '(пусто)'}

Уже существующие теги в системе:
${tagContext || '(тегов пока нет)'}

Текст задачи от автора: "${text}"
Кого автор указал исполнителем (может быть пусто — тогда задача для самого автора): "${assigneeHint || ''}"
Срок, как назвал автор (в свободной форме, может быть пусто — тогда сегодня): "${deadlineText || ''}"
Важность, как назвал автор (в свободной форме, может быть пусто — тогда обычная): "${importanceText || ''}"

Задачи:
1. Определи исполнителя: если в тексте явно назван человек — сопоставь его с id из списка, даже если имя дано в уменьшительной/разговорной форме (например, "Саша" = "Александр", "Женя" = "Евгений"/"Евгения", "Настя" = "Анастасия", "Дима" = "Дмитрий", "Катя" = "Екатерина" и т.п. — сопоставляй по смыслу, а не только по точному совпадению строки). Если исполнитель нигде не указан явно — считай, что задача для самого автора: assignee_id = "${employee.id}".
2. Если срок явно указан (в тексте или отдельно) — переведи его в конкретную дату YYYY-MM-DD. Срок может быть сформулирован сложно и не буквально: "через две недели", "в последнюю субботу сентября", "в следующий четверг", "к концу месяца" и т.п. — используй таблицы дат-ориентиров выше, чтобы не ошибиться в вычислении. Если срок нигде не указан — deadline = "${todayISO}" (сегодня).
3. Сопоставь названную важность с одним из ТОЧНО трёх уровней: "срочно", "обычный", "низкий". Примеры соответствий: "горит", "прямо сейчас", "asap" → срочно; "как обычно", "в течение недели" → обычный; "неважная задача", "не к спеху", "как будет время" → низкий. Если важность нигде не указана — priority = "обычный".
4. Составь edited_text — чистое описание того, что нужно сделать, в виде краткого поручения (например: "Сделать таблицу договоров"). Убери из него имя/обращение к исполнителю, упоминание срока и слова про срочность/важность — эта информация уже уходит в отдельные поля assignee_id/deadline/priority и не должна дублироваться в тексте. Если в исходном тексте были опечатки или рваная формулировка — заодно поправь её, не меняя смысл и не добавляя ничего от себя.
5. Если в тексте автора помимо сути поручения есть дополнительные детали, контекст, причины, ссылки, уточнения — вынеси их отдельно в description: связный текст без ошибок в грамматике и пунктуации, только на основе того, что реально сказал автор, ничего не додумывай. Если весь текст уже целиком уместился в edited_text и добавить нечего — description: null.
6. Если текст задачи явно перекликается по смыслу/ключевым словам с одним или несколькими тегами из списка "уже существующие теги" — добавь их названия в tags. Если ни один тег явно не подходит — верни пустой массив. Никогда не придумывай новые названия тегов, выбирай ТОЛЬКО из списка выше, дословно.

Верни ТОЛЬКО валидный JSON без markdown-разметки и пояснений вокруг, строго в таком формате:
{
  "edited_text": "финальный текст задачи",
  "description": "связный текст с деталями или null",
  "assignee_id": "id исполнителя из списка выше",
  "deadline": "YYYY-MM-DD",
  "priority": "срочно" | "обычный" | "низкий",
  "tags": ["название тега из списка выше", "..."],
  "explanation": "одно короткое предложение на русском — кратко обоснуй выбор исполнителя, срока и приоритета"
}`

  // Гонка нескольких бесплатных моделей одновременно: у бесплатного тира OpenRouter
  // непредсказуемые очереди, и заранее не угадать, какая модель сейчас свободна.
  // Берём первый успешный валидный ответ, остальные запросы отменяем.
  const candidateModels = [
    'openai/gpt-oss-20b:free',
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
        temperature: 0.3,
        max_tokens: 700,
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

    const parsed = await Promise.any(
      candidateModels.map((model) => callOpenRouter(model, controller.signal))
    )
    controller.abort()

    const assigneeId = parsed.assignee_id || employee.id
    const assignee = employees?.find((e) => e.id === assigneeId)

    // Защита от "галлюцинации" — оставляем только теги, которые реально существуют, и переводим в id.
    const tagNames: string[] = Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown) => typeof t === 'string') : []
    const tagIds = tagNames
      .map((name) => suggestableTags.find((t) => t.name === name)?.id)
      .filter((id): id is string => !!id)

    return NextResponse.json({
      edited_text: parsed.edited_text ?? text,
      description: typeof parsed.description === 'string' && parsed.description.trim() ? parsed.description.trim() : null,
      assignee_id: assigneeId,
      assignee_name: assignee?.name ?? employee.name,
      deadline: parsed.deadline || todayISO,
      priority: parsed.priority || 'обычный',
      tag_ids: tagIds,
      explanation: parsed.explanation,
    })
  } catch (err) {
    if (err instanceof AggregateError) {
      console.error('AI suggest error: all models failed', err.errors.map((e) => String(e)))
    } else {
      console.error('AI suggest error:', err)
    }
    return NextResponse.json({ error: 'Не удалось получить предложение от ИИ. Заполни поля вручную.' }, { status: 500 })
  }
}
