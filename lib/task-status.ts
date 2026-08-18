import type { Status, Task } from '@/types'

export function getDisplayStatus(task: Task): Status {
  if (task.status === 'выполнена') return 'выполнена'
  if (task.deadline) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadline = new Date(task.deadline)
    if (deadline < today) return 'просрочена'
  }
  return task.status
}

export function isOverdue(task: Task): boolean {
  return getDisplayStatus(task) === 'просрочена'
}

export function isBurning(task: Task): boolean {
  const display = getDisplayStatus(task)
  // Просроченные задачи показываются в своём отдельном разделе — сюда не попадают.
  if (display === 'выполнена' || display === 'просрочена') return false
  if (!task.deadline) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadline = new Date(task.deadline)
  const diffDays = Math.round((deadline.getTime() - today.getTime()) / 86400000)

  // "горит": срочный приоритет в ближайшие 3 дня
  return task.priority === 'срочно' && diffDays <= 3
}

export type TaskRole = 'author' | 'assignee' | 'both' | 'none'

export function getTaskRole(task: Task, employeeId: string): TaskRole {
  const isAuthor = task.author_id === employeeId
  const isAssignee = task.assignee_id === employeeId
  if (isAuthor && isAssignee) return 'both'
  if (isAuthor) return 'author'
  if (isAssignee) return 'assignee'
  return 'none'
}
