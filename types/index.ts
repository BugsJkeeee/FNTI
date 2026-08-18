export type Priority = 'срочно' | 'обычный' | 'низкий'
export type Status = 'новая' | 'в работе' | 'выполнена' | 'просрочена'

export interface Employee {
  id: string
  name: string
  email: string
  specialization: string | null
  is_owner: boolean
  created_at: string
  telegram_chat_id: number | null
  telegram_link_code: string | null
}

export interface Task {
  id: string
  number: number
  text: string
  description: string | null
  original_text: string | null
  author_id: string | null
  assignee_id: string | null
  deadline: string | null
  priority: Priority
  status: Status
  ai_explanation: string | null
  created_at: string
  updated_at: string
  author?: Employee
  assignee?: Employee
  comment_count?: number
  has_unread_comment?: boolean
  tags?: Tag[]
}

export interface Tag {
  id: string
  name: string
  created_by: string | null
  created_at: string
}

export interface Comment {
  id: string
  task_id: string
  author_id: string | null
  text: string
  created_at: string
  author?: Employee
}

export interface GlossaryEntry {
  id: string
  author_id: string | null
  text: string
  created_at: string
  author?: Employee
}

export interface AiSuggestion {
  edited_text: string
  description: string | null
  assignee_id: string
  assignee_name: string
  deadline: string
  priority: Priority
  tag_ids: string[]
  explanation: string
}
