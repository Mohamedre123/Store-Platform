/** بيانات شاشات الفريق والأجهزة وسجل النشاط */
import { cachedResource } from './http'

export type Perm = { key: string; label: string; hint: string }

export type TeamMember = {
  id: string
  userId: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'staff'
  permissions: string[]
  isBlocked: boolean
  joinedAt: string | null
}

export type TeamInvite = { id: string; email: string; role: string; roleLabel: string; expiresAt: string }

export type TeamPayload = {
  canManage: boolean
  currentUserId: string
  roleLabels: Record<string, string>
  permissions: Perm[]
  presets: Array<{ key: string; label: string; hint: string; role: 'admin' | 'staff'; permissions: string[] }>
  members: TeamMember[]
  invites: TeamInvite[]
}

export type DeviceSession = {
  id: string
  device: 'mobile' | 'tablet' | 'desktop'
  label: string
  ip: string | null
  createdAt: string
  expiresAt: string
  isCurrent: boolean
}

export type ActivityItem = {
  id: string
  label: string
  risky: boolean
  who: string
  whoKey: string
  createdAt: string
  before: string | null
  after: string | null
}

export const teamData = cachedResource<TeamPayload>('zw-team:v1', '/api/app/team')
export const sessionsData = cachedResource<{ sessions: DeviceSession[] }>('zw-sessions:v1', '/api/app/sessions')
export const activityData = cachedResource<{ items: ActivityItem[] }>('zw-activity:v1', '/api/app/activity')

export function clearSettingsCaches(): void {
  teamData.clear()
  sessionsData.clear()
  activityData.clear()
}
