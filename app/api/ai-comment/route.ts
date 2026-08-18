import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { canSetPrivateTag, isPrivateTagName } from '@/lib/tags'

export async function POST(req: NextRequest) {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { text } = await req.json()
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Нужен текст команды' }, { status: 400 })
  }

  const supabase = await createClient()
  const [{ data: tasks }, { data: allTags }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, text, author_id, assignee_id, assignee:employees!tasks_assignee_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('tags').select('id, name'),
  ])

  const taskList = (tasks ?? []) as unknown as {
    id: string
    text: string
    author_id: string | null
    assignee_id: string | null
    assignee: { name: string } | null
  }[]

  const tagList = allTags ?? []

  const taskContext = taskList
    .map((t) => `- id: ${t.id}, текст: "${t.text}", исполнитель: ${t.assignee?.name ?? '—'}`)
    .join('\n')

  const tagContext = tagList.map((t) => `- ${t.name}`).join('\n')

  const today = new Date()
  const todayStr = today.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const todayISO = today.toISOString().slice(0, 10)

  const prompt = `Ты — ассистент в системе управления задачами команды. Автор (${employee.name}) даёт команду в свободной форме.

Сегодня: ${todayStr}, т.е. ${todayISO}.

Список существующих задач:
${taskContext || '(задач нет)'}

Список существующих тегов:
${tagContext || '(тегов нет)'}

Команда автора: "${text}"

Задачи:
1. Определи намерение (intent): "comment" — добавить комментарий к задаче; "deadline" — перенести/изменить срок задачи; "priority" — изменить приоритет/важность задачи; "status" — изменить статус задачи; "add_tag" — поставить тег на задачу; "remove_tag" — убрать тег с задачи; "unclear" — не похоже ни на одно из этого.
2. Определи, к какой именно задаче из списка это относится — по смыслу, а не только по точному совпадению слов.
3. Если можешь уверенно определить ровно одну задачу — верни её id. Если нет (нет подходящей, либо несколько одинаково подходящих) — верни task_id: null и коротко объясни в reason.
4. Если intent = "comment": извлеки текст комментария — то, что нужно написать, без служебных фраз вроде "напиши комментарий в задаче про X, что", только суть сообщения, от первого лица.
5. Если intent = "deadline": переведи новый срок в дату YYYY-MM-DD, отталкиваясь от сегодняшней даты.
6. Если intent = "priority": сопоставь с одним из ТОЧНО трёх значений: "срочно", "обычный", "низкий".
7. Если intent = "status": сопоставь с одним из ТОЧНО трёх значений: "новая", "в работе", "выполнена". Примеры: "готово", "сделано", "закрой" → выполнена; "взял в работу", "начал делать" → в работе; "верни в новые", "ещё не начинал" → новая.
8. Если intent = "add_tag" или "remove_tag": сопоставь упомянутый тег с одним из существующих тегов из списка выше (без учёта регистра), верни его название дословно как в списке в поле tag_name. Если подходящего тега в списке нет — tag_name: null. Никогда не придумывай новый тег для этого намерения.

Верни ТОЛЬКО валидный JSON без markdown-разметки, строго в таком формате:
{
  "intent": "comment" | "deadline" | "priority" | "status" | "add_tag" | "remove_tag" | "unclear",
  "task_id": "id задачи из списка выше или null",
  "comment_text": "текст комментария или null",
  "new_deadline": "YYYY-MM-DD или null",
  "new_priority": "срочно" | "обычный" | "низкий" | null,
  "new_status": "новая" | "в работе" | "выполнена" | null,
  "tag_name": "название тега из списка выше или null",
  "reason": "если task_id null или intent unclear — короткое объяснение на русском, иначе пустая строка"
}`

  const candidateModels = [
    'qwen/qwen-2.5-7b-instruct:free',
    'google/gemma-2-9b-it:free',
    'meta-llama/llama-3.1-8b-instruct:free',
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
        max_tokens: 400,
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

    // Неоднозначно с задачей (для комментария — отдаём выбор пользователю).
    if (!parsed.task_id) {
      if (parsed.intent === 'comment') {
        return NextResponse.json({
          type: 'comment_needs_choice',
          reason: parsed.reason || 'Не понял, к какой задаче это относится.',
          suggested_text: parsed.comment_text || text,
          candidates: taskList.map((t) => ({ id: t.id, text: t.text })),
        })
      }
      return NextResponse.json(
        { error: parsed.reason || 'Не удалось понять, к какой задаче это относится. Сформулируй точнее.' },
        { status: 422 }
      )
    }

    // Защита от "галлюцинации" id — задача обязательно должна быть из реального списка.
    const matchedTask = taskList.find((t) => t.id === parsed.task_id)
    if (!matchedTask) {
      return NextResponse.json(
        { error: 'ИИ предложил несуществующую задачу. Попробуй переформулировать команду.' },
        { status: 422 }
      )
    }

    if (parsed.intent === 'comment') {
      if (!parsed.comment_text) {
        return NextResponse.json({ error: 'Не понял, что написать в комментарии.' }, { status: 422 })
      }

      const { data: comment, error } = await supabase
        .from('task_comments')
        .insert({ task_id: parsed.task_id, author_id: employee.id, text: parsed.comment_text })
        .select('*, author:employees(id, name)')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await supabase.from('task_history').insert({
        task_id: parsed.task_id,
        changed_by: employee.id,
        change_description: 'Добавлен комментарий (через ИИ-команду)',
      })

      return NextResponse.json({
        type: 'comment_posted',
        task_id: parsed.task_id,
        task_text: matchedTask.text,
        comment_text: comment.text,
      })
    }

    if (parsed.intent === 'deadline' || parsed.intent === 'priority') {
      const isAuthor = matchedTask.author_id === employee.id
      const isAssignee = matchedTask.assignee_id === employee.id
      if (!isAuthor && !isAssignee) {
        return NextResponse.json(
          { error: `Нет прав менять задачу «${matchedTask.text}» — редактировать может только автор или исполнитель.` },
          { status: 403 }
        )
      }

      const field = parsed.intent === 'deadline' ? 'deadline' : 'priority'
      const newValue = parsed.intent === 'deadline' ? parsed.new_deadline : parsed.new_priority
      if (!newValue) {
        return NextResponse.json({ error: 'Не понял новое значение срока/приоритета.' }, { status: 422 })
      }

      const { error } = await supabase.from('tasks').update({ [field]: newValue }).eq('id', parsed.task_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await supabase.from('task_history').insert({
        task_id: parsed.task_id,
        changed_by: employee.id,
        change_description: `Изменено через ИИ-команду: ${field === 'deadline' ? 'срок' : 'приоритет'} → ${newValue}`,
      })

      return NextResponse.json({
        type: 'task_updated',
        task_id: parsed.task_id,
        task_text: matchedTask.text,
        field,
        new_value: newValue,
      })
    }

    if (parsed.intent === 'status') {
      const isAssignee = matchedTask.assignee_id === employee.id
      if (!isAssignee) {
        return NextResponse.json(
          { error: `Менять статус может только исполнитель задачи «${matchedTask.text}».` },
          { status: 403 }
        )
      }

      if (!parsed.new_status || !['новая', 'в работе', 'выполнена'].includes(parsed.new_status)) {
        return NextResponse.json({ error: 'Не понял новый статус.' }, { status: 422 })
      }

      const { error } = await supabase.from('tasks').update({ status: parsed.new_status }).eq('id', parsed.task_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await supabase.from('task_history').insert({
        task_id: parsed.task_id,
        changed_by: employee.id,
        change_description: `Изменено через ИИ-команду: статус → ${parsed.new_status}`,
      })

      return NextResponse.json({
        type: 'task_updated',
        task_id: parsed.task_id,
        task_text: matchedTask.text,
        field: 'status',
        new_value: parsed.new_status,
      })
    }

    if (parsed.intent === 'add_tag' || parsed.intent === 'remove_tag') {
      if (!parsed.tag_name) {
        return NextResponse.json(
          { error: 'Не нашёл такой тег среди существующих. Создать новый можно на странице «Глоссарий».' },
          { status: 422 }
        )
      }

      const tag = tagList.find((t) => t.name.toLowerCase() === String(parsed.tag_name).toLowerCase())
      if (!tag) {
        return NextResponse.json(
          { error: 'ИИ предложил несуществующий тег. Попробуй переформулировать команду.' },
          { status: 422 }
        )
      }

      if (isPrivateTagName(tag.name) && !canSetPrivateTag(matchedTask.author_id, matchedTask.assignee_id, employee.id)) {
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
        changed_by: employee.id,
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
  } catch (err) {
    if (err instanceof AggregateError) {
      console.error('AI command error: all models failed', err.errors.map((e) => String(e)))
    } else {
      console.error('AI command error:', err)
    }
    return NextResponse.json({ error: 'Не удалось получить ответ от ИИ. Попробуй ещё раз.' }, { status: 500 })
  }
}
