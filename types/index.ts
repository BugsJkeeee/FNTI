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
  project_id: string | null
  author?: Employee
  assignee?: Employee
  project?: { id: string; number: number; wave: number; code: string } | null
  comment_count?: number
  has_unread_comment?: boolean
  tags?: Tag[]
}

// Лёгкий список проектов для выпадающих селектов (постановка/фильтр задачи по проекту) —
// без тяжёлых вложенных этапов/чек-листов/платежей, которые тянет основной GET /api/projects.
export interface ProjectOption {
  id: string
  number: number
  wave: number
  code: string
  status: 'active' | 'terminating' | 'terminated'
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
  status: 'active' | 'terminating' | 'terminated'
  created_by: string | null
  created_at: string
  updated_at: string
  // Обогащение из мега-таблицы НИОКР (см. private/, вне репозитория)
  external_project_id: string
  competition_application_number: string
  protocol_announce_number: string
  protocol_announce_date: string | null
  egisu_number: string
  kbk: string
  kbk_code: string
  result_name: string
  result_code: string
  contact_name: string
  contact_phone: string
  contact_email: string
  org_email: string
  grantee_email_from_contract: string
  org_contact: string
  tech_contact: string
  partner_industrial: string
  partner_confirming_doc: string
  partner_co_executors: string
  partner_other: string
  partner_source_comment: string
  data_quality_comment: string
  user_comment: string
  demand_comment: string
  financial_expertise_comment: string
  executor_state: string
  source_note: string
  contracts?: ProjectContract[]
  stages?: ProjectStage[]
  comments?: ProjectComment[]
  payments?: ProjectPayment[]
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
  invoice_number: string
  subsidy_ministry: string
  subsidy_agreement_number: string
  subsidy_agreement_date: string | null
  subsidy_decision_number: string
  subsidy_decision_date: string | null
  subsidy_identifier: string
  additional_agreements: { number: string; date: string | null }[]
  created_at: string
}

export interface ProjectPayment {
  id: string
  project_id: string
  external_payment_id: string
  contract_number: string
  record_type: string
  period_label: string
  window_start: string | null
  window_end: string | null
  plan_year: number | null
  actually_paid: boolean
  payment_request_date: string | null
  obligation_amount: number | null
  paid_amount: number | null
  carry_forward: boolean
  adjusted_year: number | null
  forecast_carry_2026_2027: boolean
  payment_request_number: string
  payment_request_comment: string
  source_note: string
  comment: string
  created_at: string
  updated_at: string
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
  claims?: ProjectClaim[]
}

export interface ProjectClaim {
  id: string
  stage_id: string
  claim_date: string | null
  claim_number: string
  claim_balance: number | null
  claim_misuse_amount: number | null
  claim_noncompliance_amount: number | null
  claim_execution_date: string | null
  claim_execution_payments: { date: string | null; amount: number }[]
  created_at: string
  updated_at: string
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
