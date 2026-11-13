// Persistence for the Odoo sync, over the Supabase service-role client.
// Kept separate from _odooSync.js so that file can be tested with an in-memory
// store and no database.

const JOB_COLUMNS = '*';

export function createSupabaseStore(db) {
  return {
    /** The master switch row (phase46). Missing row = disabled. */
    async getSettings() {
      const { data } = await db.from('odoo_sync_settings').select('enabled, enabled_at').eq('id', true).maybeSingle();
      return data || { enabled: false };
    },

    /**
     * Atomically take the next job that is due: pending, failed with its retry
     * time reached, or running with a lock older than `staleBefore` (a crashed
     * worker). The update is conditional on the status and attempt count the
     * candidate had, so two workers can never both win the same job.
     */
    async claimNext({ now, staleBefore }) {
      const nowIso = now.toISOString();
      const staleIso = staleBefore.toISOString();
      for (let i = 0; i < 3; i += 1) {
        const { data: rows, error } = await db
          .from('odoo_sync_jobs')
          .select(JOB_COLUMNS)
          .or(`and(status.in.(pending,failed),or(next_retry_at.is.null,next_retry_at.lte.${nowIso})),and(status.eq.running,locked_at.lt.${staleIso})`)
          .order('created_at', { ascending: true })
          .limit(1);
        if (error) throw new Error(`odoo_sync_jobs read failed: ${error.message}`);
        const candidate = rows?.[0];
        if (!candidate) return null;

        const { data: won, error: claimErr } = await db
          .from('odoo_sync_jobs')
          .update({ status: 'running', locked_at: nowIso, attempts: candidate.attempts + 1, updated_at: nowIso })
          .eq('id', candidate.id)
          .eq('status', candidate.status)
          .eq('attempts', candidate.attempts)
          .select(JOB_COLUMNS);
        if (claimErr) throw new Error(`odoo_sync_jobs claim failed: ${claimErr.message}`);
        if (won?.length) return won[0];
        // Lost the race; look for another.
      }
      return null;
    },

    async updateJob(id, patch) {
      const { error } = await db.from('odoo_sync_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw new Error(`odoo_sync_jobs update failed: ${error.message}`);
    },

    /** Put a stuck job back in the queue (admin action). Never touches a finished job. */
    async retryJob(id) {
      const { data, error } = await db
        .from('odoo_sync_jobs')
        .update({
          status: 'pending', attempts: 0, next_retry_at: null, locked_at: null,
          last_error: null, error_kind: null, updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .in('status', ['failed', 'needs_review', 'dead'])
        .select('id');
      if (error) throw new Error(`odoo_sync_jobs retry failed: ${error.message}`);
      return Boolean(data?.length);
    },

    /** After going live: let payments that were only dry-run be mirrored for real. */
    async requeueDryRuns() {
      const { data, error } = await db
        .from('odoo_sync_jobs')
        .update({ status: 'pending', attempts: 0, next_retry_at: null, locked_at: null, plan: null, updated_at: new Date().toISOString() })
        .eq('status', 'dry_run')
        .select('id');
      if (error) throw new Error(`odoo_sync_jobs requeue failed: ${error.message}`);
      return data?.length || 0;
    },

    async getEvent(id) {
      const { data } = await db.from('whop_webhook_events').select('id, payload').eq('id', id).maybeSingle();
      return data;
    },

    async loadApplications(ids) {
      const { data, error } = await db
        .from('applications')
        .select('id, client_id, company_name, recommended_iso, selected_package, total_amount, payment_status')
        .in('id', ids);
      if (error) throw new Error(`applications read failed: ${error.message}`);
      return (data || []).map((a) => ({ ...a, total_amount: a.total_amount == null ? null : Number(a.total_amount) }));
    },

    async loadProfile(id) {
      const full = 'id, email, full_name, company_name, phone, country';
      let res = await db.from('profiles').select(full).eq('id', id).maybeSingle();
      // `country` was added in a later migration; fall back rather than fail.
      if (res.error && res.error.code === '42703') {
        res = await db.from('profiles').select('id, email, full_name, company_name, phone').eq('id', id).maybeSingle();
      }
      if (res.error) throw new Error(`profiles read failed: ${res.error.message}`);
      return res.data;
    },

    async getRecord(entityType, certifyId) {
      const { data } = await db.from('odoo_records').select('*').eq('entity_type', entityType).eq('certify_id', certifyId).maybeSingle();
      return data;
    },

    async upsertRecord(record) {
      const { error } = await db.from('odoo_records').upsert(record, { onConflict: 'entity_type,certify_id' });
      if (error) throw new Error(`odoo_records write failed: ${error.message}`);
    },
  };
}
