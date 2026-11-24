-- Phase 52: Certify.cx QMS core (ISO 9001), the records an auditor asks for. Safe to run more than once.
--
-- What this creates
--   qms_counters / qms_next_no()   running numbers: DOC-, NC-, AUD-, RSK-, REV-
--   qms_documents                  controlled documents (number, title, type, clauses, owner, status, review date)
--   qms_document_versions          every version of a document. An approved version can never be changed.
--   qms_nonconformities            nonconformities (a corrective-action case)
--   qms_actions                    corrective / preventive / correction actions of a nonconformity
--   qms_audits / qms_findings      internal audits and what they found
--   qms_risks                      risk and opportunity register
--   qms_kpis                       quality objectives and their actual results per period
--   qms_reviews                    management reviews (inputs snapshot, decisions)
--   qms_trail                      append-only history of every change (who, what, when)
-- Rules enforced by the database
--   * an approved or superseded document version cannot be edited or deleted
--   * a nonconformity cannot be closed without a root cause and an effectiveness check
--   * the trail cannot be edited or deleted
--   * every table is service-role only (RLS on, no policies)

-- ---------------------------------------------------------------- numbering
CREATE TABLE IF NOT EXISTS public.qms_counters (
  prefix text PRIMARY KEY,
  n      integer NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.qms_next_no(p_prefix text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE v integer;
BEGIN
  INSERT INTO public.qms_counters (prefix, n) VALUES (p_prefix, 1)
  ON CONFLICT (prefix) DO UPDATE SET n = public.qms_counters.n + 1
  RETURNING n INTO v;
  RETURN p_prefix || '-' || lpad(v::text, 4, '0');
END $$;

-- ---------------------------------------------------------------- documents
CREATE TABLE IF NOT EXISTS public.qms_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_no           text NOT NULL UNIQUE,
  title            text NOT NULL,
  doc_type         text NOT NULL DEFAULT 'procedure' CHECK (doc_type IN ('manual','policy','procedure','work_instruction','form','record','external')),
  clauses          text[] NOT NULL DEFAULT '{}',
  owner_name       text,
  review_months    integer NOT NULL DEFAULT 12 CHECK (review_months BETWEEN 1 AND 60),
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','obsolete')),
  approved_version integer,
  next_review      date,
  edition          text NOT NULL DEFAULT 'ISO 9001:2015',
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qms_document_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES public.qms_documents(id) ON DELETE CASCADE,
  version      integer NOT NULL,
  content      text NOT NULL DEFAULT '',
  change_note  text,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','superseded')),
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  approved_by  uuid,
  approved_at  timestamptz,
  UNIQUE (document_id, version)
);

CREATE OR REPLACE FUNCTION public.qms_version_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('approved','superseded') THEN
      RAISE EXCEPTION 'An approved document version cannot be deleted. Mark the document obsolete instead.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'approved' THEN
    -- the only change allowed on an approved version is to supersede it
    IF NEW.status = 'superseded' AND NEW.content = OLD.content AND NEW.version = OLD.version THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'An approved document version cannot be changed. Create a new version.';
  END IF;
  IF OLD.status = 'superseded' THEN
    RAISE EXCEPTION 'A superseded document version cannot be changed.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS qms_version_guard_trg ON public.qms_document_versions;
CREATE TRIGGER qms_version_guard_trg BEFORE UPDATE OR DELETE ON public.qms_document_versions
  FOR EACH ROW EXECUTE FUNCTION public.qms_version_guard();

-- ---------------------------------------------------------------- nonconformities and actions
CREATE TABLE IF NOT EXISTS public.qms_nonconformities (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_no              text NOT NULL UNIQUE,
  title              text NOT NULL,
  source             text NOT NULL DEFAULT 'internal_audit' CHECK (source IN ('internal_audit','external_audit','customer_complaint','process','supplier','other')),
  description        text,
  clause             text,
  severity           text NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor','major')),
  containment        text,
  root_cause         text,
  owner_name         text,
  due_date           date,
  status             text NOT NULL DEFAULT 'open' CHECK (status IN ('open','contained','root_cause','action','verification','closed')),
  effectiveness_note text,
  closed_at          timestamptz,
  finding_id         uuid,
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qms_actions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id         uuid NOT NULL REFERENCES public.qms_nonconformities(id) ON DELETE CASCADE,
  kind          text NOT NULL DEFAULT 'corrective' CHECK (kind IN ('correction','corrective','preventive')),
  description   text NOT NULL,
  owner_name    text,
  due_date      date,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','verified')),
  verified_note text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.qms_nc_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'closed' THEN
    IF coalesce(btrim(NEW.root_cause), '') = '' THEN
      RAISE EXCEPTION 'A nonconformity cannot be closed without a root cause.';
    END IF;
    IF coalesce(btrim(NEW.effectiveness_note), '') = '' THEN
      RAISE EXCEPTION 'A nonconformity cannot be closed without an effectiveness check.';
    END IF;
    IF NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS qms_nc_guard_trg ON public.qms_nonconformities;
CREATE TRIGGER qms_nc_guard_trg BEFORE INSERT OR UPDATE ON public.qms_nonconformities
  FOR EACH ROW EXECUTE FUNCTION public.qms_nc_guard();

-- ---------------------------------------------------------------- internal audits
CREATE TABLE IF NOT EXISTS public.qms_audits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_no       text NOT NULL UNIQUE,
  title          text NOT NULL,
  audit_type     text NOT NULL DEFAULT 'internal' CHECK (audit_type IN ('internal','supplier','external')),
  scope          text,
  clauses        text[] NOT NULL DEFAULT '{}',
  planned_date   date,
  completed_date date,
  lead_auditor   text,
  auditee        text,
  status         text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed')),
  summary        text,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qms_findings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id   uuid NOT NULL REFERENCES public.qms_audits(id) ON DELETE CASCADE,
  clause     text,
  kind       text NOT NULL DEFAULT 'conformity' CHECK (kind IN ('conformity','observation','minor_nc','major_nc','opportunity')),
  statement  text NOT NULL,
  evidence   text,
  nc_id      uuid REFERENCES public.qms_nonconformities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- risks, KPIs, reviews
CREATE TABLE IF NOT EXISTS public.qms_risks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_no     text NOT NULL UNIQUE,
  kind        text NOT NULL DEFAULT 'risk' CHECK (kind IN ('risk','opportunity')),
  title       text NOT NULL,
  description text,
  clause      text,
  likelihood  integer NOT NULL DEFAULT 3 CHECK (likelihood BETWEEN 1 AND 5),
  impact      integer NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  score       integer GENERATED ALWAYS AS (likelihood * impact) STORED,
  treatment   text,
  owner_name  text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','mitigating','accepted','closed')),
  review_date date,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qms_kpis (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  period     text NOT NULL,
  unit       text,
  direction  text NOT NULL DEFAULT 'higher' CHECK (direction IN ('higher','lower')),
  target     numeric,
  actual     numeric,
  owner_name text,
  notes      text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, period)
);

CREATE TABLE IF NOT EXISTS public.qms_reviews (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_no            text NOT NULL UNIQUE,
  review_date          date NOT NULL,
  attendees            text,
  status               text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','held')),
  inputs               jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_feedback    text,
  provider_performance text,
  resources            text,
  decisions            text,
  created_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- trail (append only)
CREATE TABLE IF NOT EXISTS public.qms_trail (
  id         bigserial PRIMARY KEY,
  entity     text NOT NULL,
  entity_id  uuid,
  ref        text,
  action     text NOT NULL,
  detail     jsonb,
  actor      uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.qms_trail_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'The QMS trail is append only.';
END $$;

DROP TRIGGER IF EXISTS qms_trail_guard_trg ON public.qms_trail;
CREATE TRIGGER qms_trail_guard_trg BEFORE UPDATE OR DELETE ON public.qms_trail
  FOR EACH ROW EXECUTE FUNCTION public.qms_trail_guard();

CREATE INDEX IF NOT EXISTS qms_trail_entity_idx ON public.qms_trail (entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qms_actions_nc_idx ON public.qms_actions (nc_id);
CREATE INDEX IF NOT EXISTS qms_findings_audit_idx ON public.qms_findings (audit_id);
CREATE INDEX IF NOT EXISTS qms_versions_doc_idx ON public.qms_document_versions (document_id, version DESC);

-- ---------------------------------------------------------------- access: service role only
ALTER TABLE public.qms_counters          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_nonconformities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_actions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_audits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_findings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_risks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_kpis              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_trail             ENABLE ROW LEVEL SECURITY;
