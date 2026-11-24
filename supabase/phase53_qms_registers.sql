-- Phase 53: QMS registers (ISO 9001): suppliers, training and competence, equipment calibration, customer feedback.
-- Run after phase52_qms.sql. Safe to run more than once.
--
-- What this creates
--   qms_suppliers / qms_supplier_evaluations   approved external providers (8.4) and their scored evaluations
--   qms_training                               training and competence records (7.2), with expiry dates
--   qms_equipment / qms_calibrations           monitoring and measuring equipment (7.1.5) and its calibration history
--   qms_feedback                               customer feedback and complaints (9.1.2), a complaint can raise a nonconformity
-- Rules enforced by the database
--   * a supplier evaluation score is always the average of its three ratings
--   * a training record cannot be marked completed without the date it was completed
--   * feedback cannot be marked resolved or closed without a response
--   * every table is service-role only (RLS on, no policies)

-- ---------------------------------------------------------------- suppliers
CREATE TABLE IF NOT EXISTS public.qms_suppliers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_no      text NOT NULL UNIQUE,
  name             text NOT NULL,
  category         text NOT NULL DEFAULT 'other' CHECK (category IN ('certification_body','auditor','contractor','hosting','payment','software','other')),
  country          text,
  contact          text,
  certificate_name text,
  certificate_expiry date,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','conditional','disapproved')),
  next_evaluation  date,
  notes            text,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qms_supplier_evaluations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    uuid NOT NULL REFERENCES public.qms_suppliers(id) ON DELETE CASCADE,
  evaluated_on   date NOT NULL,
  quality        integer NOT NULL CHECK (quality BETWEEN 1 AND 5),
  delivery       integer NOT NULL CHECK (delivery BETWEEN 1 AND 5),
  responsiveness integer NOT NULL CHECK (responsiveness BETWEEN 1 AND 5),
  score          numeric(3,2) GENERATED ALWAYS AS (round((quality + delivery + responsiveness) / 3.0, 2)) STORED,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- training and competence
CREATE TABLE IF NOT EXISTS public.qms_training (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name    text NOT NULL,
  role           text,
  training_title text NOT NULL,
  kind           text NOT NULL DEFAULT 'training' CHECK (kind IN ('training','certification','induction','experience')),
  provider       text,
  planned_date   date,
  completed_on   date,
  expires_on     date,
  evidence       text,
  status         text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','completed')),
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_on IS NULL OR completed_on IS NULL OR expires_on >= completed_on)
);

CREATE OR REPLACE FUNCTION public.qms_training_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.completed_on IS NULL THEN
    RAISE EXCEPTION 'A training record cannot be completed without the date it was completed.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS qms_training_guard_trg ON public.qms_training;
CREATE TRIGGER qms_training_guard_trg BEFORE INSERT OR UPDATE ON public.qms_training
  FOR EACH ROW EXECUTE FUNCTION public.qms_training_guard();

-- ---------------------------------------------------------------- equipment and calibration
CREATE TABLE IF NOT EXISTS public.qms_equipment (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_no    text NOT NULL UNIQUE,
  name            text NOT NULL,
  location        text,
  serial_no       text,
  owner_name      text,
  interval_months integer NOT NULL DEFAULT 12 CHECK (interval_months BETWEEN 1 AND 120),
  last_calibrated date,
  next_due        date,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','out_of_service','retired')),
  notes           text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qms_calibrations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id   uuid NOT NULL REFERENCES public.qms_equipment(id) ON DELETE CASCADE,
  calibrated_on  date NOT NULL,
  result         text NOT NULL CHECK (result IN ('pass','fail')),
  certificate_ref text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- customer feedback and complaints
CREATE TABLE IF NOT EXISTS public.qms_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_no   text NOT NULL UNIQUE,
  kind          text NOT NULL DEFAULT 'complaint' CHECK (kind IN ('complaint','compliment','survey','suggestion')),
  customer_name text,
  received_on   date NOT NULL,
  rating        integer CHECK (rating BETWEEN 1 AND 5),
  subject       text NOT NULL,
  details       text,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new','investigating','resolved','closed')),
  response      text,
  nc_id         uuid REFERENCES public.qms_nonconformities(id) ON DELETE SET NULL,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.qms_feedback_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('resolved','closed') AND coalesce(btrim(NEW.response), '') = '' THEN
    RAISE EXCEPTION 'Feedback cannot be resolved or closed without a response.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS qms_feedback_guard_trg ON public.qms_feedback;
CREATE TRIGGER qms_feedback_guard_trg BEFORE INSERT OR UPDATE ON public.qms_feedback
  FOR EACH ROW EXECUTE FUNCTION public.qms_feedback_guard();

CREATE INDEX IF NOT EXISTS qms_supplier_eval_idx ON public.qms_supplier_evaluations (supplier_id, evaluated_on DESC);
CREATE INDEX IF NOT EXISTS qms_calibrations_idx ON public.qms_calibrations (equipment_id, calibrated_on DESC);

-- ---------------------------------------------------------------- access: service role only
ALTER TABLE public.qms_suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_supplier_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_training             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_equipment            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_calibrations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_feedback             ENABLE ROW LEVEL SECURITY;
