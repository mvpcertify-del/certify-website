// QMS core (ISO 9001): documents, nonconformities and actions, internal audits, risks, KPIs, management reviews, and the
// audit pack. Super Admin only.
//
// No new serverless function (the Hobby plan allows 12): api/notify-event.js hands every action that starts with "qms-" to
// this file. The pure functions at the top (validation, closing rules, clause readiness) have no database access, so they are
// tested on their own (tests/qms/qms.test.mjs). The database repeats the key rules with triggers (supabase/phase52_qms.sql).
//
// Every change is written to qms_trail (who, what, when), which is what the auditor reads.

import { getAdmin, verifyAdmin } from './_verifyAdmin.js';
import { CLAUSES, TEMPLATES, EDITION } from './_qmsMaster.js';

const CLAUSE_NOS = new Set(CLAUSES.map((c) => c.no));
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const fail = (status, message) => Object.assign(new Error(message), { status });
const clean = (v, max) => {
  const s = Array.from(String(v == null ? '' : v), (ch) => (ch.charCodeAt(0) < 32 && ch !== '\n' ? ' ' : ch)).join('').trim().slice(0, max);
  return s || null;
};
export const today = () => new Date().toISOString().slice(0, 10);

export function addMonths(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export const riskLevel = (score) => (score >= 15 ? 'high' : score >= 8 ? 'medium' : 'low');

// ---------------------------------------------------------------------------- field specs
const text = (max, required = false) => ({ t: 'text', max, required });
const long = (max = 4000) => ({ t: 'text', max, required: false });
const pick = (values, required = false) => ({ t: 'enum', values, required });
const date = (required = false) => ({ t: 'date', required });
const int = (min, max, required = true) => ({ t: 'int', min, max, required });
const num = () => ({ t: 'num', required: false });
const clauseList = () => ({ t: 'clauses', required: false });
const clauseOne = () => ({ t: 'clause', required: false });

export const SPECS = {
  document: {
    table: 'qms_documents', prefix: 'QMS-DOC', numberField: 'doc_no',
    fields: {
      title: text(200, true),
      doc_type: pick(['manual', 'policy', 'procedure', 'work_instruction', 'form', 'record', 'external']),
      clauses: clauseList(), owner_name: text(120), review_months: int(1, 60, false),
    },
  },
  nc: {
    table: 'qms_nonconformities', prefix: 'NC', numberField: 'nc_no',
    fields: {
      title: text(200, true),
      source: pick(['internal_audit', 'external_audit', 'customer_complaint', 'process', 'supplier', 'other']),
      description: long(), clause: clauseOne(), severity: pick(['minor', 'major']),
      containment: long(), root_cause: long(), owner_name: text(120), due_date: date(),
      status: pick(['open', 'contained', 'root_cause', 'action', 'verification', 'closed']),
      effectiveness_note: long(),
    },
  },
  audit: {
    table: 'qms_audits', prefix: 'AUD', numberField: 'audit_no',
    fields: {
      title: text(200, true), audit_type: pick(['internal', 'supplier', 'external']), scope: long(1000),
      clauses: clauseList(), planned_date: date(), completed_date: date(), lead_auditor: text(120), auditee: text(120),
      status: pick(['planned', 'in_progress', 'completed']), summary: long(),
    },
  },
  risk: {
    table: 'qms_risks', prefix: 'RSK', numberField: 'risk_no',
    fields: {
      kind: pick(['risk', 'opportunity']), title: text(200, true), description: long(), clause: clauseOne(),
      likelihood: int(1, 5), impact: int(1, 5), treatment: long(), owner_name: text(120),
      status: pick(['open', 'mitigating', 'accepted', 'closed']), review_date: date(),
    },
  },
  kpi: {
    table: 'qms_kpis', prefix: null, numberField: null,
    fields: {
      name: text(160, true), period: text(40, true), unit: text(20), direction: pick(['higher', 'lower']),
      target: num(), actual: num(), owner_name: text(120), notes: long(1000),
    },
  },
  review: {
    table: 'qms_reviews', prefix: 'REV', numberField: 'review_no',
    fields: {
      review_date: date(true), attendees: long(1000), status: pick(['planned', 'held']),
      customer_feedback: long(), provider_performance: long(), resources: long(), decisions: long(),
    },
  },
  action: {
    table: 'qms_actions', prefix: null, numberField: null, parent: 'nc_id',
    fields: {
      kind: pick(['correction', 'corrective', 'preventive']), description: text(1000, true), owner_name: text(120),
      due_date: date(), status: pick(['open', 'done', 'verified']), verified_note: long(1000),
    },
  },
  finding: {
    table: 'qms_findings', prefix: null, numberField: null, parent: 'audit_id',
    fields: {
      clause: clauseOne(), kind: pick(['conformity', 'observation', 'minor_nc', 'major_nc', 'opportunity']),
      statement: text(1000, true), evidence: long(1000),
    },
  },
};

/**
 * Checks a record against its spec. Pure.
 *   mode 'create': every required field must be present.
 *   mode 'update': only the fields sent are checked.
 * Returns { errors, values }. `values` holds only the fields that may be written.
 */
export function validateRecord(spec, input, mode) {
  const errors = {};
  const values = {};
  for (const [name, f] of Object.entries(spec.fields)) {
    if (mode === 'update' && !(name in input)) continue;
    const raw = input[name];
    const empty = raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && !raw.length && f.t !== 'clauses');
    if (empty) {
      if (f.required && (mode === 'create' || name in input)) errors[name] = 'This is required.';
      else if (f.t === 'clauses') values[name] = [];
      else if (!f.required && (mode === 'update' || f.t === 'date' || f.t === 'num' || f.t === 'text' || f.t === 'clause')) values[name] = null;
      continue;
    }
    if (f.t === 'text') {
      const s = clean(raw, f.max);
      if (!s && f.required) errors[name] = 'This is required.'; else values[name] = s;
    } else if (f.t === 'enum') {
      if (!f.values.includes(raw)) errors[name] = `Choose one of: ${f.values.join(', ')}.`; else values[name] = raw;
    } else if (f.t === 'date') {
      if (!DATE.test(String(raw)) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) errors[name] = 'Use a valid date (YYYY-MM-DD).'; else values[name] = String(raw);
    } else if (f.t === 'int') {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < f.min || n > f.max) errors[name] = `Enter a whole number from ${f.min} to ${f.max}.`; else values[name] = n;
    } else if (f.t === 'num') {
      const n = Number(raw);
      if (!Number.isFinite(n)) errors[name] = 'Enter a number.'; else values[name] = n;
    } else if (f.t === 'clause') {
      if (!CLAUSE_NOS.has(String(raw))) errors[name] = 'Choose a clause of the standard.'; else values[name] = String(raw);
    } else if (f.t === 'clauses') {
      const list = Array.isArray(raw) ? raw.map(String) : [];
      if (list.some((c) => !CLAUSE_NOS.has(c))) errors[name] = 'One of the clauses is not a clause of the standard.'; else values[name] = [...new Set(list)];
    }
  }
  return { errors, values };
}

// ---------------------------------------------------------------------------- rules
/** Why a nonconformity cannot be closed yet, or null when it can. */
export function ncCloseBlocker(nc, actions) {
  if (!String(nc.root_cause || '').trim()) return 'Record the root cause before closing.';
  if (!actions.length) return 'Add at least one corrective or preventive action before closing.';
  if (actions.some((a) => a.status === 'open')) return 'Every action must be done before closing.';
  if (!String(nc.effectiveness_note || '').trim()) return 'Record the effectiveness check before closing.';
  return null;
}

/** Why an audit cannot be marked completed yet, or null. */
export function auditCompleteBlocker(audit, findings) {
  if (!findings.length && !String(audit.summary || '').trim()) return 'Record at least one finding or a summary before completing the audit.';
  if (!audit.completed_date) return 'Enter the date the audit was completed.';
  return null;
}

/** Why a management review cannot be marked held yet, or null. */
export function reviewHeldBlocker(review) {
  if (!String(review.decisions || '').trim()) return 'Record the decisions and actions before marking the review held.';
  return null;
}

/**
 * Clause readiness. Pure.
 *   data: { documents: [{ clauses, status, approved_version }], risks, kpis, audits, reviews }
 * A clause is "ready" when every need in CLAUSES is met, "partial" when some are, "none" otherwise.
 * A draft document counts as partial progress, not as evidence.
 */
export function clauseReadiness(data) {
  const docs = data.documents || [];
  const has = {
    risk: (data.risks || []).length > 0,
    kpi: (data.kpis || []).length > 0,
    kpiData: (data.kpis || []).some((k) => k.actual !== null && k.actual !== undefined),
    audit: (data.audits || []).some((a) => a.status === 'completed'),
    review: (data.reviews || []).some((r) => r.status === 'held'),
  };
  return CLAUSES.map((c) => {
    const tagged = docs.filter((d) => (d.clauses || []).includes(c.no) && d.status !== 'obsolete');
    const approved = tagged.filter((d) => d.approved_version != null);
    const met = [];
    const missing = [];
    for (const need of c.needs) {
      const ok = need === 'doc' ? approved.length > 0 : has[need];
      (ok ? met : missing).push(need);
    }
    const draftOnly = !met.includes('doc') && c.needs.includes('doc') && tagged.length > 0;
    const level = !missing.length ? 'ready' : (met.length || draftOnly) ? 'partial' : 'none';
    return { no: c.no, title: c.title, level, met, missing, documents: approved.map((d) => d.doc_no) };
  });
}

export function readinessPercent(rows) {
  const total = rows.reduce((s, r) => s + (r.met.length + r.missing.length), 0);
  const done = rows.reduce((s, r) => s + r.met.length, 0);
  return total ? Math.round((done / total) * 100) : 0;
}

// ---------------------------------------------------------------------------- database helpers
async function trail(db, { entity, entity_id = null, ref = null, action, detail = null, actor }) {
  await db.from('qms_trail').insert({ entity, entity_id, ref, action, detail, actor });
}

async function nextNo(db, prefix) {
  const { data, error } = await db.rpc('qms_next_no', { p_prefix: prefix });
  if (error) throw error;
  return data;
}

async function loadAll(db) {
  const [documents, ncs, actions, audits, findings, risks, kpis, reviews] = await Promise.all([
    db.from('qms_documents').select('*').order('doc_no'),
    db.from('qms_nonconformities').select('*').order('created_at', { ascending: false }),
    db.from('qms_actions').select('*'),
    db.from('qms_audits').select('*').order('planned_date', { ascending: false, nullsFirst: false }),
    db.from('qms_findings').select('*'),
    db.from('qms_risks').select('*').order('score', { ascending: false }),
    db.from('qms_kpis').select('*').order('period', { ascending: false }),
    db.from('qms_reviews').select('*').order('review_date', { ascending: false }),
  ]);
  for (const r of [documents, ncs, actions, audits, findings, risks, kpis, reviews]) if (r.error) throw r.error;
  return {
    documents: documents.data, ncs: ncs.data, actions: actions.data, audits: audits.data,
    findings: findings.data, risks: risks.data, kpis: kpis.data, reviews: reviews.data,
  };
}

function overview(all) {
  const t = today();
  const rows = clauseReadiness(all);
  const openNc = all.ncs.filter((n) => n.status !== 'closed');
  return {
    edition: EDITION,
    readiness: rows,
    percent: readinessPercent(rows),
    counts: {
      documents: all.documents.length,
      approved: all.documents.filter((d) => d.approved_version != null && d.status !== 'obsolete').length,
      drafts: all.documents.filter((d) => d.status === 'draft' || d.status === 'in_review').length,
      reviewDue: all.documents.filter((d) => d.approved_version != null && d.status !== 'obsolete' && d.next_review && d.next_review <= t).length,
      openNc: openNc.length,
      overdueNc: openNc.filter((n) => n.due_date && n.due_date < t).length,
      openActions: all.actions.filter((a) => a.status === 'open').length,
      overdueActions: all.actions.filter((a) => a.status === 'open' && a.due_date && a.due_date < t).length,
      audits: all.audits.length,
      auditsCompleted: all.audits.filter((a) => a.status === 'completed').length,
      risks: all.risks.length,
      highRisks: all.risks.filter((r) => r.status !== 'closed' && r.score >= 15).length,
      kpis: all.kpis.length,
      reviews: all.reviews.length,
    },
  };
}

function reviewInputs(all) {
  const t = today();
  const yearAgo = addMonths(t, -12);
  const kpiRows = all.kpis.filter((k) => k.target != null && k.actual != null);
  const met = (k) => (k.direction === 'lower' ? Number(k.actual) <= Number(k.target) : Number(k.actual) >= Number(k.target));
  const completed = all.audits.filter((a) => a.status === 'completed' && (a.completed_date || '') >= yearAgo);
  return {
    snapshot_date: t,
    nonconformities: {
      open: all.ncs.filter((n) => n.status !== 'closed').length,
      closed_last_12_months: all.ncs.filter((n) => n.status === 'closed' && (n.closed_at || '').slice(0, 10) >= yearAgo).length,
      overdue: all.ncs.filter((n) => n.status !== 'closed' && n.due_date && n.due_date < t).length,
    },
    actions: { open: all.actions.filter((a) => a.status === 'open').length },
    kpis: { measured: kpiRows.length, met: kpiRows.filter(met).length, not_met: kpiRows.filter((k) => !met(k)).map((k) => `${k.name} (${k.period})`) },
    audits: {
      completed_last_12_months: completed.length,
      findings: all.findings.filter((f) => completed.some((a) => a.id === f.audit_id)).reduce((o, f) => ({ ...o, [f.kind]: (o[f.kind] || 0) + 1 }), {}),
    },
    risks: { open: all.risks.filter((r) => r.status !== 'closed').length, high: all.risks.filter((r) => r.status !== 'closed' && r.score >= 15).map((r) => r.risk_no) },
    documents: { approved: all.documents.filter((d) => d.approved_version != null && d.status !== 'obsolete').length, review_due: all.documents.filter((d) => d.approved_version != null && d.next_review && d.next_review <= t).map((d) => d.doc_no) },
    previous_review: all.reviews.filter((r) => r.status === 'held')[0]?.review_no || null,
  };
}

const guardMessage = (e) => (e?.code === 'P0001' ? e.message : null);

// ---------------------------------------------------------------------------- handler
export async function handleQmsAction(req, res) {
  const body = req.body || {};
  const action = String(body.action || '');
  const auth = await verifyAdmin(req, { requireSuperAdmin: true });
  if (auth.error) return res.status(auth.status || 403).json({ error: auth.error });
  const actor = auth.caller.id;

  try {
    const db = getAdmin();

    if (action === 'qms-overview') {
      return res.status(200).json(overview(await loadAll(db)));
    }

    // Create the document set from the ISO 9001 template library. Existing numbers are left alone, so it is safe to repeat.
    if (action === 'qms-generate') {
      const { data: existing } = await db.from('qms_documents').select('doc_no');
      const have = new Set((existing || []).map((d) => d.doc_no));
      let created = 0;
      for (const t of TEMPLATES) {
        if (have.has(t.doc_no)) continue;
        const { data: row, error } = await db.from('qms_documents').insert({
          doc_no: t.doc_no, title: t.title, doc_type: t.doc_type, clauses: t.clauses, status: 'draft', edition: EDITION, created_by: actor,
        }).select('id').single();
        if (error) throw error;
        const v = await db.from('qms_document_versions').insert({ document_id: row.id, version: 1, content: t.content, change_note: 'Generated from the ISO 9001 template', status: 'draft', created_by: actor });
        if (v.error) throw v.error;
        await trail(db, { entity: 'document', entity_id: row.id, ref: t.doc_no, action: 'generated', detail: { version: 1 }, actor });
        created += 1;
      }
      return res.status(200).json({ ok: true, created, skipped: TEMPLATES.length - created, total: TEMPLATES.length });
    }

    if (action === 'qms-list') {
      const spec = SPECS[body.entity];
      if (!spec) throw fail(400, 'Unknown list.');
      const all = await loadAll(db);
      const map = { document: all.documents, nc: all.ncs, audit: all.audits, risk: all.risks, kpi: all.kpis, review: all.reviews };
      const rows = map[body.entity];
      if (!rows) throw fail(400, 'Unknown list.');
      const extra = body.entity === 'nc' ? { actions: all.actions } : body.entity === 'audit' ? { findings: all.findings } : {};
      return res.status(200).json({ rows, ...extra });
    }

    if (action === 'qms-get') {
      const spec = SPECS[body.entity];
      if (!spec || !body.id) throw fail(400, 'Missing item.');
      const { data: row } = await db.from(spec.table).select('*').eq('id', body.id).maybeSingle();
      if (!row) throw fail(404, 'Not found.');
      const out = { row };
      if (body.entity === 'document') out.versions = (await db.from('qms_document_versions').select('*').eq('document_id', row.id).order('version', { ascending: false })).data || [];
      if (body.entity === 'nc') out.actions = (await db.from('qms_actions').select('*').eq('nc_id', row.id).order('created_at')).data || [];
      if (body.entity === 'audit') out.findings = (await db.from('qms_findings').select('*').eq('audit_id', row.id).order('created_at')).data || [];
      out.trail = (await db.from('qms_trail').select('action, detail, actor, created_at').eq('entity', body.entity).eq('entity_id', row.id).order('created_at', { ascending: false }).limit(50)).data || [];
      return res.status(200).json(out);
    }

    if (action === 'qms-save') {
      const spec = SPECS[body.entity];
      if (!spec || body.entity === 'action' || body.entity === 'finding') throw fail(400, 'Unknown record.');
      const input = body.record || {};
      const mode = body.id ? 'update' : 'create';
      const { errors, values } = validateRecord(spec, input, mode);

      let current = null;
      if (mode === 'update') {
        current = (await db.from(spec.table).select('*').eq('id', body.id).maybeSingle()).data;
        if (!current) throw fail(404, 'Not found.');
      }
      const merged = { ...(current || {}), ...values };

      // Rules that depend on other records.
      if (body.entity === 'nc' && merged.status === 'closed' && (mode === 'create' || current.status !== 'closed')) {
        const acts = mode === 'update' ? (await db.from('qms_actions').select('status').eq('nc_id', body.id)).data || [] : [];
        const why = ncCloseBlocker(merged, acts);
        if (why) errors.status = why;
      }
      if (body.entity === 'nc' && current?.status === 'closed' && values.status && values.status !== 'closed') errors.status = 'A closed nonconformity cannot be reopened. Raise a new one.';
      if (body.entity === 'audit' && merged.status === 'completed') {
        const fs = mode === 'update' ? (await db.from('qms_findings').select('id').eq('audit_id', body.id)).data || [] : [];
        const why = auditCompleteBlocker(merged, fs);
        if (why) errors.status = why;
      }
      if (body.entity === 'review' && merged.status === 'held') {
        const why = reviewHeldBlocker(merged);
        if (why) errors.status = why;
      }
      if (body.entity === 'document') {
        delete values.status;
        if (mode === 'create' && !values.title) errors.title = 'This is required.';
      }
      if (Object.keys(errors).length) return res.status(200).json({ ok: false, errors });

      if (mode === 'create') {
        const row = { ...values, created_by: actor };
        if (spec.numberField) row[spec.numberField] = await nextNo(db, spec.prefix);
        if (body.entity === 'document') row.edition = EDITION;
        if (body.entity === 'nc' && row.status === 'closed') row.closed_at = new Date().toISOString();
        const { data, error } = await db.from(spec.table).insert(row).select('*').single();
        if (error) {
          if (error.code === '23505' && body.entity === 'kpi') return res.status(200).json({ ok: false, errors: { name: 'This KPI already has a result for that period.' } });
          throw error;
        }
        if (body.entity === 'document') {
          await db.from('qms_document_versions').insert({ document_id: data.id, version: 1, content: clean(input.content, 100000) || '', change_note: 'First version', status: 'draft', created_by: actor });
        }
        await trail(db, { entity: body.entity, entity_id: data.id, ref: data[spec.numberField] || data.name || null, action: 'created', detail: values, actor });
        return res.status(200).json({ ok: true, row: data });
      }

      const changes = {};
      for (const [k, v] of Object.entries(values)) {
        const before = current[k] ?? null;
        const same = Array.isArray(v) ? JSON.stringify(v) === JSON.stringify(before || []) : before === (v ?? null);
        if (!same) changes[k] = v ?? null;
      }
      if (!Object.keys(changes).length) return res.status(200).json({ ok: true, unchanged: true, row: current });
      if (body.entity === 'nc' && changes.status === 'closed') changes.closed_at = new Date().toISOString();
      if (body.entity === 'audit' && changes.status === 'completed' && !merged.completed_date) changes.completed_date = today();
      const { data, error } = await db.from(spec.table).update({ ...changes, updated_at: new Date().toISOString() }).eq('id', body.id).select('*').single();
      if (error) {
        const msg = guardMessage(error);
        if (msg) return res.status(200).json({ ok: false, errors: { status: msg } });
        throw error;
      }
      const before = Object.fromEntries(Object.keys(changes).map((k) => [k, current[k] ?? null]));
      await trail(db, { entity: body.entity, entity_id: body.id, ref: current[spec.numberField] || null, action: changes.status ? `status: ${changes.status}` : 'updated', detail: { before, after: changes }, actor });
      return res.status(200).json({ ok: true, row: data });
    }

    // Actions of a nonconformity and findings of an audit.
    if (action === 'qms-child-save' || action === 'qms-child-delete') {
      const spec = SPECS[body.entity];
      if (!spec || !spec.parent) throw fail(400, 'Unknown record.');
      const parentTable = spec.parent === 'nc_id' ? 'qms_nonconformities' : 'qms_audits';
      if (action === 'qms-child-delete') {
        const { data: row } = await db.from(spec.table).select('*').eq('id', body.id).maybeSingle();
        if (!row) throw fail(404, 'Not found.');
        const { data: parent } = await db.from(parentTable).select('status, nc_no, audit_no').eq('id', row[spec.parent]).maybeSingle();
        if (parent?.status === 'closed' || parent?.status === 'completed') throw fail(400, 'A closed case cannot be changed.');
        await db.from(spec.table).delete().eq('id', body.id);
        await trail(db, { entity: body.entity, entity_id: body.id, ref: parent?.nc_no || parent?.audit_no || null, action: 'deleted', detail: row, actor });
        return res.status(200).json({ ok: true });
      }
      const input = body.record || {};
      const mode = body.id ? 'update' : 'create';
      const { errors, values } = validateRecord(spec, input, mode);
      const parentId = mode === 'create' ? input[spec.parent] : (await db.from(spec.table).select(spec.parent).eq('id', body.id).maybeSingle()).data?.[spec.parent];
      const { data: parent } = await db.from(parentTable).select('*').eq('id', parentId).maybeSingle();
      if (!parent) throw fail(404, 'The case was not found.');
      if (parent.status === 'closed' || parent.status === 'completed') errors._ = 'A closed case cannot be changed.';
      if (Object.keys(errors).length) return res.status(200).json({ ok: false, errors });
      if (mode === 'create') {
        const { data, error } = await db.from(spec.table).insert({ ...values, [spec.parent]: parentId }).select('*').single();
        if (error) throw error;
        await trail(db, { entity: body.entity, entity_id: data.id, ref: parent.nc_no || parent.audit_no, action: 'created', detail: values, actor });
        return res.status(200).json({ ok: true, row: data });
      }
      const { data, error } = await db.from(spec.table).update({ ...values, ...(spec.table === 'qms_actions' ? { updated_at: new Date().toISOString() } : {}) }).eq('id', body.id).select('*').single();
      if (error) throw error;
      await trail(db, { entity: body.entity, entity_id: body.id, ref: parent.nc_no || parent.audit_no, action: 'updated', detail: values, actor });
      return res.status(200).json({ ok: true, row: data });
    }

    // Turn a nonconformity finding into a nonconformity record and link them.
    if (action === 'qms-finding-to-nc') {
      const { data: f } = await db.from('qms_findings').select('*').eq('id', body.id).maybeSingle();
      if (!f) throw fail(404, 'Finding not found.');
      if (f.nc_id) return res.status(200).json({ ok: false, errors: { _: 'A nonconformity was already raised for this finding.' } });
      if (f.kind !== 'minor_nc' && f.kind !== 'major_nc') return res.status(200).json({ ok: false, errors: { _: 'Only a minor or major nonconformity finding can raise a nonconformity.' } });
      const { data: a } = await db.from('qms_audits').select('audit_no').eq('id', f.audit_id).maybeSingle();
      const row = {
        nc_no: await nextNo(db, 'NC'), title: clean(f.statement, 120), source: 'internal_audit', description: `${f.statement}${f.evidence ? `\nEvidence: ${f.evidence}` : ''}${a ? `\nFound in ${a.audit_no}.` : ''}`,
        clause: f.clause, severity: f.kind === 'major_nc' ? 'major' : 'minor', status: 'open', finding_id: f.id, created_by: actor,
      };
      const { data: nc, error } = await db.from('qms_nonconformities').insert(row).select('*').single();
      if (error) throw error;
      await db.from('qms_findings').update({ nc_id: nc.id }).eq('id', f.id);
      await trail(db, { entity: 'nc', entity_id: nc.id, ref: nc.nc_no, action: 'created from audit finding', detail: { audit: a?.audit_no, finding: f.id }, actor });
      return res.status(200).json({ ok: true, row: nc });
    }

    // Add or change the working text of a document (creates a new version when the current one is approved).
    if (action === 'qms-doc-version') {
      const { data: doc } = await db.from('qms_documents').select('*').eq('id', body.id).maybeSingle();
      if (!doc) throw fail(404, 'Document not found.');
      if (doc.status === 'obsolete') return res.status(200).json({ ok: false, errors: { _: 'An obsolete document cannot be changed.' } });
      const content = String(body.content == null ? '' : body.content).slice(0, 100000);
      const note = clean(body.change_note, 300);
      const { data: versions } = await db.from('qms_document_versions').select('*').eq('document_id', doc.id).order('version', { ascending: false });
      const latest = versions?.[0];
      if (latest && (latest.status === 'draft' || latest.status === 'in_review')) {
        const { error } = await db.from('qms_document_versions').update({ content, change_note: note || latest.change_note, status: 'draft' }).eq('id', latest.id);
        if (error) throw error;
        await db.from('qms_documents').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', doc.id);
        await trail(db, { entity: 'document', entity_id: doc.id, ref: doc.doc_no, action: `edited v${latest.version}`, detail: { change_note: note }, actor });
        return res.status(200).json({ ok: true, version: latest.version });
      }
      if (!note) return res.status(200).json({ ok: false, errors: { change_note: 'Describe what changed. A new version of an approved document needs a change note.' } });
      const version = (latest?.version || 0) + 1;
      const { error } = await db.from('qms_document_versions').insert({ document_id: doc.id, version, content, change_note: note, status: 'draft', created_by: actor });
      if (error) throw error;
      await db.from('qms_documents').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', doc.id);
      await trail(db, { entity: 'document', entity_id: doc.id, ref: doc.doc_no, action: `new version v${version}`, detail: { change_note: note }, actor });
      return res.status(200).json({ ok: true, version });
    }

    // draft -> in_review -> approved. approved -> (new version) ... obsolete.
    if (action === 'qms-doc-status') {
      const to = String(body.to || '');
      const { data: doc } = await db.from('qms_documents').select('*').eq('id', body.id).maybeSingle();
      if (!doc) throw fail(404, 'Document not found.');
      const { data: versions } = await db.from('qms_document_versions').select('*').eq('document_id', doc.id).order('version', { ascending: false });
      const latest = versions?.[0];
      const now = new Date().toISOString();

      if (to === 'obsolete') {
        if (doc.status === 'obsolete') return res.status(200).json({ ok: true, unchanged: true });
        await db.from('qms_documents').update({ status: 'obsolete', updated_at: now }).eq('id', doc.id);
        await trail(db, { entity: 'document', entity_id: doc.id, ref: doc.doc_no, action: 'marked obsolete', actor });
        return res.status(200).json({ ok: true });
      }
      if (!latest) throw fail(400, 'The document has no version.');
      if (to === 'in_review') {
        if (latest.status !== 'draft') return res.status(200).json({ ok: false, errors: { _: 'Only a draft can be sent for review.' } });
        if (!String(latest.content || '').trim()) return res.status(200).json({ ok: false, errors: { _: 'The document is empty. Write the content first.' } });
        await db.from('qms_document_versions').update({ status: 'in_review' }).eq('id', latest.id);
        await db.from('qms_documents').update({ status: 'in_review', updated_at: now }).eq('id', doc.id);
        await trail(db, { entity: 'document', entity_id: doc.id, ref: doc.doc_no, action: `v${latest.version} sent for review`, actor });
        return res.status(200).json({ ok: true });
      }
      if (to === 'draft') {
        if (latest.status !== 'in_review') return res.status(200).json({ ok: false, errors: { _: 'Only a document in review can be returned to draft.' } });
        await db.from('qms_document_versions').update({ status: 'draft' }).eq('id', latest.id);
        await db.from('qms_documents').update({ status: 'draft', updated_at: now }).eq('id', doc.id);
        await trail(db, { entity: 'document', entity_id: doc.id, ref: doc.doc_no, action: `v${latest.version} returned to draft`, actor });
        return res.status(200).json({ ok: true });
      }
      if (to === 'approved') {
        if (latest.status !== 'in_review') return res.status(200).json({ ok: false, errors: { _: 'Send the document for review before approving it.' } });
        const prev = (versions || []).find((v) => v.status === 'approved');
        if (prev) await db.from('qms_document_versions').update({ status: 'superseded' }).eq('id', prev.id);
        const { error } = await db.from('qms_document_versions').update({ status: 'approved', approved_by: actor, approved_at: now }).eq('id', latest.id);
        if (error) throw error;
        await db.from('qms_documents').update({ status: 'approved', approved_version: latest.version, next_review: addMonths(today(), doc.review_months || 12), updated_at: now }).eq('id', doc.id);
        await trail(db, { entity: 'document', entity_id: doc.id, ref: doc.doc_no, action: `v${latest.version} approved`, detail: { author: latest.created_by, approver: actor }, actor });
        return res.status(200).json({ ok: true });
      }
      throw fail(400, 'Unknown status.');
    }

    if (action === 'qms-review-snapshot') {
      const { data: rv } = await db.from('qms_reviews').select('*').eq('id', body.id).maybeSingle();
      if (!rv) throw fail(404, 'Review not found.');
      if (rv.status === 'held') return res.status(200).json({ ok: false, errors: { _: 'A held review is a record and cannot be refreshed.' } });
      const inputs = reviewInputs(await loadAll(db));
      await db.from('qms_reviews').update({ inputs, updated_at: new Date().toISOString() }).eq('id', rv.id);
      await trail(db, { entity: 'review', entity_id: rv.id, ref: rv.review_no, action: 'inputs collected', actor });
      return res.status(200).json({ ok: true, inputs });
    }

    // Everything an auditor asks for, clause by clause.
    if (action === 'qms-pack') {
      const all = await loadAll(db);
      const { data: versions } = await db.from('qms_document_versions').select('document_id, version, status, approved_by, approved_at, created_by, change_note').in('status', ['approved']);
      const { data: tr } = await db.from('qms_trail').select('entity, ref, action, created_at').order('created_at', { ascending: false }).limit(300);
      return res.status(200).json({
        generated_at: new Date().toISOString(),
        ...overview(all),
        documents: all.documents.map((d) => ({ ...d, approval: (versions || []).find((v) => v.document_id === d.id && v.version === d.approved_version) || null })),
        nonconformities: all.ncs.map((n) => ({ ...n, actions: all.actions.filter((a) => a.nc_id === n.id) })),
        audits: all.audits.map((a) => ({ ...a, findings: all.findings.filter((f) => f.audit_id === a.id) })),
        risks: all.risks, kpis: all.kpis, reviews: all.reviews, trail: tr || [],
      });
    }

    if (action === 'qms-trail') {
      let q = db.from('qms_trail').select('*').order('created_at', { ascending: false }).limit(Math.min(Number(body.limit) || 100, 500));
      if (body.entity) q = q.eq('entity', String(body.entity));
      const { data } = await q;
      return res.status(200).json({ trail: data || [] });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    const msg = guardMessage(e);
    if (msg) return res.status(200).json({ ok: false, errors: { _: msg } });
    console.error('[qms]', action, e?.message || e);
    return res.status(e?.status || 500).json({ error: e?.message || 'Request failed' });
  }
}
