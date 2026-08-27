-- =====================================================================
-- phase33 — Client replies land in the partner's dashboard
-- =====================================================================
--
-- Client request (27 Aug), point 2:
--   "Replies from Clients will be directed to the notification dashboard of
--    the referral partner + Linked Country Admin + Super Admin. The reply
--    from client should be linked to the (Referral Partner) RP & will not be
--    displayed to other RPs."
--
-- phase32 gave partners a letter to send. Until now its Reply-To was the
-- partner's own mailbox, so a reply left the platform entirely and no admin
-- ever saw it. This migration is the other half: every partner letter belongs
-- to a CONVERSATION, and every reply to it is filed against that conversation.
--
-- ---------------------------------------------------------------------
-- HOW A REPLY FINDS ITS WAY BACK
-- ---------------------------------------------------------------------
-- Each conversation carries a `reply_token`: random, unique, and embedded in
-- the Reply-To address the letter goes out with (see api/_replyAddress.js).
-- A reply is addressed to that unique address, so the token — not the sender's
-- email — is what identifies the thread.
--
-- That distinction matters. Matching on the sender's address fails the moment
-- a lead replies from a different mailbox to the one that was written to (a
-- personal address, a shared inbox, a colleague they forwarded it to), and it
-- breaks outright when the SAME company is a lead of two different partners —
-- which is exactly the case the client's "will not be displayed to other RPs"
-- is about. The token has one owner and cannot be ambiguous.
--
-- ---------------------------------------------------------------------
-- WHO CAN SEE A THREAD
-- ---------------------------------------------------------------------
-- The owning partner, their Country Admin, and Super Admin. Nobody else —
-- expressly including other referral partners, which is enforced here in the
-- database rather than by remembering to add a WHERE clause to every query.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Conversations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_id     uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  lead_email      text NOT NULL,
  lead_name       text,
  standard_slug   text,
  subject         text,
  reply_token     text NOT NULL,
  -- The partner's region, copied at creation rather than joined at read time.
  --
  -- The RLS policy below has to answer "is the reader the Country Admin for
  -- this thread's partner?". Joining profiles to find out would mean the
  -- policy reads ANOTHER user's row, which profiles' own RLS may refuse —
  -- and a policy that silently evaluates to false is an access bug that looks
  -- like an empty inbox. Snapshotting the region keeps the policy dependent
  -- only on the READER's own row, which they can always see.
  --
  -- The trade-off is honest and small: if a partner is later moved to another
  -- region, existing threads stay visible to the old Country Admin. New
  -- threads follow the partner. Reassign with a one-line UPDATE if that ever
  -- matters.
  region          text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  -- Set when a reply arrives, cleared when the partner opens the thread. The
  -- dashboard badge reads this; the notifications table carries the alert.
  has_unread      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- The token is the routing key for inbound mail: it must be unique, and the
-- lookup happens on every inbound message.
CREATE UNIQUE INDEX IF NOT EXISTS partner_conversations_reply_token_uniq
  ON public.partner_conversations (reply_token);

-- The partner's inbox, newest thread first.
CREATE INDEX IF NOT EXISTS partner_conversations_referrer_idx
  ON public.partner_conversations (referrer_id, last_message_at DESC);

-- The admin's inbox, scoped to a region.
CREATE INDEX IF NOT EXISTS partner_conversations_region_idx
  ON public.partner_conversations (region, last_message_at DESC);

-- The last-resort inbound match (see api/inbound-email.js) looks a thread up
-- by who it was written to.
CREATE INDEX IF NOT EXISTS partner_conversations_lead_email_idx
  ON public.partner_conversations (lead_email, last_message_at DESC);

COMMENT ON TABLE public.partner_conversations IS
  'One thread per partner-to-lead email exchange. reply_token routes inbound '
  'replies back to the right thread and the right partner.';

-- ---------------------------------------------------------------------
-- 2. Messages
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid NOT NULL REFERENCES public.partner_conversations(id) ON DELETE CASCADE,
  direction           text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  from_email          text,
  from_name           text,
  to_email            text,
  subject             text,
  -- PLAIN TEXT ONLY, deliberately.
  --
  -- An inbound message is a stranger's HTML arriving over the internet. Storing
  -- and rendering it would put unsanitised third-party markup on an admin's
  -- screen, which is a cross-site-scripting hole with an invitation attached.
  -- The text/plain alternative every real mail client sends is enough to read
  -- a reply, and it cannot execute.
  body_text           text,
  provider_message_id text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_messages_conversation_idx
  ON public.partner_messages (conversation_id, created_at);

-- The inbound webhook can be retried by the provider (and Svix retries on any
-- non-2xx). Without this, one slow response turns into a duplicated reply in
-- the partner's inbox.
CREATE UNIQUE INDEX IF NOT EXISTS partner_messages_provider_id_uniq
  ON public.partner_messages (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

COMMENT ON COLUMN public.partner_messages.body_text IS
  'Plain text only. Inbound HTML is deliberately discarded rather than stored — '
  'it is untrusted third-party markup destined for an admin screen.';

-- ---------------------------------------------------------------------
-- 3. Visibility rule, in one place
-- ---------------------------------------------------------------------
-- SECURITY DEFINER so it can read profiles regardless of that table's own RLS.
-- It only ever reads the CALLER's row (auth.uid()), so it discloses nothing the
-- caller could not already see about themselves. `search_path` is pinned, which
-- is what stops a caller-controlled search_path from resolving `profiles` to
-- something they created.
CREATE OR REPLACE FUNCTION public.partner_thread_visible(p_referrer uuid, p_region text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_referrer = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = auth.uid()
        AND (
          me.role = 'super_admin'
          OR (me.role = 'regional_admin'
              AND me.region IS NOT NULL
              AND p_region IS NOT NULL
              AND me.region = p_region)
        )
    );
$$;

COMMENT ON FUNCTION public.partner_thread_visible(uuid, text) IS
  'Who may read a partner conversation: its owning partner, their Country '
  'Admin, or a Super Admin. Used by the RLS policies on '
  'partner_conversations and partner_messages so the rule lives in one place.';

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.partner_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_messages      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_conversations_read" ON public.partner_conversations;
CREATE POLICY "partner_conversations_read"
  ON public.partner_conversations FOR SELECT
  TO authenticated
  USING (public.partner_thread_visible(referrer_id, region));

DROP POLICY IF EXISTS "partner_messages_read" ON public.partner_messages;
CREATE POLICY "partner_messages_read"
  ON public.partner_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.partner_conversations c
      WHERE c.id = partner_messages.conversation_id
        AND public.partner_thread_visible(c.referrer_id, c.region)
    )
  );

-- No INSERT/UPDATE/DELETE policy on either table, on purpose. Every write —
-- creating a thread when a letter goes out, filing an inbound reply, marking a
-- thread read, sending a reply from the dashboard — runs through api/ under the
-- service role, which bypasses RLS. A browser session can read its own threads
-- and nothing more. Do not add a write policy here: a partner who could UPDATE
-- a conversation could move a thread to another partner by rewriting
-- referrer_id, which is the one thing the client asked to prevent.

COMMIT;

-- PostgREST serves from a cached schema copy; without this the first reads can
-- fail with "Could not find the table ... in the schema cache" for minutes
-- after the migration succeeded.
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Verification
-- =====================================================================
-- SELECT to_regclass('public.partner_conversations');   -- not null
-- SELECT to_regclass('public.partner_messages');        -- not null
-- SELECT proname FROM pg_proc WHERE proname = 'partner_thread_visible';  -- 1 row
-- SELECT tablename, policyname FROM pg_policies
--  WHERE tablename IN ('partner_conversations','partner_messages');      -- 2 rows
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('partner_conversations','partner_messages');        -- both true
