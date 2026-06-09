import 'server-only'

import { createClient, createServiceClient } from '@/lib/supabase/server'

export type ApprovalCategory =
  | 'outbound_message' | 'care_plan_change' | 'intake_edit'
  | 'patient_invite' | 'patient_data_edit'

export type ApprovalRequest = {
  id:                 string
  clinic_id:          string
  requested_by_user:  string
  category:           ApprovalCategory
  payload:            Record<string, unknown>
  status:             'pending' | 'approved' | 'rejected' | 'expired'
  reviewed_by_user:   string | null
  reviewed_at:        string | null
  decision_note:      string | null
  created_at:         string
}

// Returns true if this category requires approval for the given role.
export async function requiresApproval(
  clinicId:  string,
  category:  ApprovalCategory,
  userRole:  string,
): Promise<boolean> {
  if (userRole === 'owner') return false

  const supabase = await createClient()
  const { data } = await supabase
    .from('approval_settings')
    .select('requires_approval, auto_approve_for_roles')
    .eq('clinic_id', clinicId)
    .eq('category', category)
    .maybeSingle()

  if (!data) return true // default: require approval when no setting exists
  if (!data.requires_approval) return false
  if ((data.auto_approve_for_roles as string[]).includes(userRole)) return false
  return true
}

// Creates an approval request and returns its ID.
export async function createApprovalRequest(
  clinicId:          string,
  requestedByUser:   string,
  category:          ApprovalCategory,
  payload:           Record<string, unknown>,
): Promise<string> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('approval_requests')
    .insert({
      clinic_id:          clinicId,
      requested_by_user:  requestedByUser,
      category,
      payload,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Failed to create approval request: ${error?.message}`)

  // Log to access_log for owner notification tracking (non-fatal, fire-and-forget)
  void service.from('access_log').insert({
    clinic_id:   clinicId,
    actor_email: requestedByUser,
    action:      'approval_requested',
    target_type: category,
    target_id:   data.id,
  })

  return data.id
}

// Approves and executes a request. Returns the (possibly edited) payload.
export async function approveRequest(
  requestId:    string,
  reviewerEmail: string,
  editedPayload?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const service = createServiceClient()

  const { data: req } = await service
    .from('approval_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (!req) throw new Error('Request not found')
  if (req.status !== 'pending') throw new Error('Request is no longer pending')

  const finalPayload = editedPayload ?? req.payload

  await service
    .from('approval_requests')
    .update({
      status:           'approved',
      reviewed_by_user: reviewerEmail,
      reviewed_at:      new Date().toISOString(),
      payload:          finalPayload,
    })
    .eq('id', requestId)

  return finalPayload
}

// Rejects a request.
export async function rejectRequest(
  requestId:    string,
  reviewerEmail: string,
  note:          string,
): Promise<void> {
  const service = createServiceClient()
  await service
    .from('approval_requests')
    .update({
      status:           'rejected',
      reviewed_by_user: reviewerEmail,
      reviewed_at:      new Date().toISOString(),
      decision_note:    note,
    })
    .eq('id', requestId)
}

// Count pending approvals for owner badge.
export async function countPendingApprovals(clinicId: string): Promise<number> {
  const service = createServiceClient()
  const { count } = await service
    .from('approval_requests')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('status', 'pending')
  return count ?? 0
}

// Seed default approval settings for a new clinic.
export async function seedDefaultApprovalSettings(clinicId: string): Promise<void> {
  const service = createServiceClient()
  const defaults: Array<{ clinic_id: string; category: ApprovalCategory; requires_approval: boolean }> = [
    { clinic_id: clinicId, category: 'outbound_message',  requires_approval: true  },
    { clinic_id: clinicId, category: 'care_plan_change',  requires_approval: true  },
    { clinic_id: clinicId, category: 'intake_edit',       requires_approval: false },
    { clinic_id: clinicId, category: 'patient_invite',    requires_approval: true  },
    { clinic_id: clinicId, category: 'patient_data_edit', requires_approval: false },
  ]
  await service
    .from('approval_settings')
    .upsert(defaults, { onConflict: 'clinic_id,category', ignoreDuplicates: true })
}
