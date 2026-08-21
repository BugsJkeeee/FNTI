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

export type ChecklistTrack = 'technical' | 'financial'

export interface Project {
  id: string
  number: number
  wave: number
  lot_label: string
  code: string
  tech_direction: string
  topic: string
  executor_short: string
  executor_full: string
  executor_inn: string
  executor_kpp: string
  executor_address: string
  display_order: number | null
  protocol_number: string
  protocol_date: string | null
  status: 'active' | 'terminated'
  created_by: string | null
  created_at: string
  updated_at: string
  contracts?: ProjectContract[]
  stages?: ProjectStage[]
  comments?: ProjectComment[]
  comment_count?: number
  has_unread_comment?: boolean
}

export interface ProjectContract {
  id: string
  project_id: string
  contract_number: string
  contract_date: string | null
  contract_year: number | null
  stage_number: number | null
  akr: string
  created_at: string
}

export interface ProjectStage {
  id: string
  project_id: string
  stage_number: number
  name: string
  start_date: string | null
  end_date: string | null
  cost: number | null
  technical_summary: string
  financial_summary: string
  created_at: string
  updated_at: string
  checklist_items?: ProjectChecklistItem[]
}

export interface ProjectChecklistItem {
  id: string
  stage_id: string
  track: ChecklistTrack
  step_order: number
  template_key: string | null
  is_default: boolean
  title: string
  target_date: string | null
  done: boolean
  done_at: string | null
  done_by: string | null
  comment: string
  created_at: string
  updated_at: string
  done_by_employee?: Employee
}

export interface ProjectComment {
  id: string
  project_id: string
  author_id: string | null
  text: string
  created_at: string
  author?: Employee
}
