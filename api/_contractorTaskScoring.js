// Shared "mark a contractor task decided" logic — phase44, 28 Oct.
//
// Two callers reach this with the same end state (status + achieved_percent
// + email/notification), so the fan-out lives in one place:
//   - api/user.js's reviewContractorTask: an admin explicitly marks a
//     *submitted* task 'completed' (100%) — immediate, human decision.
//   - api/notify-event.js's contractor-task-deadlines cron: sweeps tasks
//     whose deadline has passed without a completed review and marks them
//     'missed' (0%) automatically — the client's stated rule ("0% if missed
//     completing the task as per deadline date").
//
// Binary by design, matching the client's instruction exactly: 100% or 0%,
// nothing in between. supabase/phase43_contractor_tasks.sql's CHECK
// constraint still allows 50 for a possible future partial-credit phase, but
// nothing in this codebase ever writes it.
import { sendViaResend } from './_resendClient.js';
import { contractorTaskStatusEmail } from './_emailTemplates.js';
import { notifyAdmins } from './_notifyAdmins.js';
import { APP_URL } from './_appUrl.js';

const DASHBOARD = `${APP_URL}/contractor/contract`;

// Applies the decision to one task row and fires both notifications (email +
// in-app to the contractor, in-app + email to the admins in that contractor's
// region). Caller has already verified the task is allowed to move to this
// status — this function does the write and the fan-out, not the
// authorization check.
export async function applyContractorTaskDecision(supabaseAdmin, task, decision) {
  const achievedPercent = decision === 'completed' ? 100 : 0;

  const { data: updated, error } = await supabaseAdmin
    .from('contractor_tasks')
    .update({ status: decision, achieved_percent: achievedPercent, updated_at: new Date().toISOString() })
    .eq('id', task.id)
    .select()
    .single();
  if (error) throw error;

  const { data: contractor } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name, region, notifications_enabled')
    .eq('id', task.contractor_id)
    .maybeSingle();

  // In-app notification (always — independent of the email opt-out, same
  // convention notify-event.js uses for other lifecycle events).
  await supabaseAdmin.from('notifications').insert({
    user_id: task.contractor_id,
    type: 'system',
    title: decision === 'completed' ? 'Task marked completed' : 'Task marked missed',
    message: `"${task.task_description.slice(0, 100)}" — ${achievedPercent}% achieved.`,
  }).then(() => {}, (e) => console.error('applyContractorTaskDecision: notification insert failed', e?.message));

  // Email to the contractor (best-effort, respects the same per-user
  // notifications_enabled switch every other lifecycle email honors).
  if (contractor?.email && contractor.notifications_enabled !== false) {
    try {
      const { subject, html, text } = contractorTaskStatusEmail({
        name: contractor.full_name || null,
        taskDescription: task.task_description,
        status: decision,
        achievedPercent,
        dashboardUrl: DASHBOARD,
      });
      await sendViaResend({ to: contractor.email, subject, html, text });
    } catch (e) {
      console.error('applyContractorTaskDecision: contractor email failed', e?.message);
    }
  }

  // Admins (region-scoped to the contractor, same as every other admin
  // alert in this codebase) — in-app + email, via the shared helper.
  await notifyAdmins(supabaseAdmin, {
    title: decision === 'completed' ? 'Contractor task completed' : 'Contractor task missed',
    message: `${contractor?.full_name || 'A contractor'}'s task "${task.task_description.slice(0, 100)}" was marked ${decision} (${achievedPercent}%).`,
    region: contractor?.region || null,
  }).catch(() => {});

  return updated;
}
