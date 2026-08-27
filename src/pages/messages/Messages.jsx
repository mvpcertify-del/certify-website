import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import { Button } from '../../components/ui/FormElements';
import { getIsoBySlug } from '../../utils/isoCatalog';
import {
  Inbox, Mail, MailOpen, Send, AlertCircle, CornerUpLeft, User,
} from 'lucide-react';
import './Messages.css';

// ============================================================================
// Partner inbox (phase33)
// ============================================================================
// The client's 27 Aug point 2: a client's reply is "directed to the
// notification dashboard of the referral partner + Linked Country Admin +
// Super Admin", is linked to that partner, and "will not be displayed to
// other RPs".
//
// WHAT ENFORCES THAT IS NOT THIS FILE. The queries below are deliberately
// unfiltered — no `.eq('referrer_id', user.id)` anywhere — because the RLS
// policies from phase33 already return only the threads this viewer may see.
// Writing the rule here as well would mean two copies of it, and the copy that
// silently stops matching is the one nobody notices. A partner gets their own
// threads; a Country Admin gets their region's; a Super Admin gets everything.
//
// The reply box appears only for the partner who owns the thread. Admins read.
// An admin replying would break the very link the client asked for, and the
// client on the far end would never know the person had changed.
// ============================================================================

const PREVIEW_CHARS = 110;

export default function Messages() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const endRef = useRef(null);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('partner_conversations')
      .select('id, referrer_id, lead_email, lead_name, standard_slug, subject, has_unread, last_message_at')
      .order('last_message_at', { ascending: false });
    if (err) setError(err.message);
    setThreads(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const active = threads.find((th) => th.id === activeId) || null;
  const isOwner = Boolean(active && user?.id && active.referrer_id === user.id);

  const openThread = async (thread) => {
    setActiveId(thread.id);
    setReplyBody('');
    setError('');
    setSent('');
    setMessagesLoading(true);

    const { data } = await supabase
      .from('partner_messages')
      .select('id, direction, from_email, from_name, to_email, subject, body_text, created_at')
      .eq('conversation_id', thread.id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setMessagesLoading(false);

    // Only the owning partner can clear the badge — it is their unread marker,
    // not a shared one, so an admin opening the thread must not consume it.
    if (thread.has_unread && user?.id === thread.referrer_id) {
      try {
        await apiPost('/api/partner-messages', { action: 'mark-read', conversationId: thread.id });
        setThreads((prev) => prev.map((x) => (x.id === thread.id ? { ...x, has_unread: false } : x)));
      } catch {
        // A badge that stays lit is a cosmetic problem; the thread is open and
        // readable either way, so this is not worth an error banner.
      }
    }
  };

  // Keep the newest message in view when a thread opens or a reply is added.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  const handleReply = async () => {
    if (!active || !replyBody.trim()) return;
    setSending(true);
    setError('');
    setSent('');
    try {
      await apiPost('/api/partner-messages', {
        action: 'reply',
        conversationId: active.id,
        body: replyBody.trim(),
      });
      setReplyBody('');
      setSent(t('messages.replySent'));
      // Re-read rather than optimistically appending: the server decides the
      // subject line and the timestamp, and a guessed row that disagrees with
      // the stored one is worse than a short wait.
      const { data } = await supabase
        .from('partner_messages')
        .select('id, direction, from_email, from_name, to_email, subject, body_text, created_at')
        .eq('conversation_id', active.id)
        .order('created_at', { ascending: true });
      setMessages(data || []);
      loadThreads();
    } catch (err) {
      setError(err.message || t('messages.replyFailed'));
    } finally {
      setSending(false);
    }
  };

  const preview = (thread) => {
    const s = thread.subject || '';
    return s.length > PREVIEW_CHARS ? `${s.slice(0, PREVIEW_CHARS)}…` : s;
  };

  const when = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString();
  };

  const unreadCount = threads.filter((th) => th.has_unread).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('messages.title')}</h1>
          <p className="page-subtitle">{t('messages.subtitle')}</p>
        </div>
      </div>

      {error && (
        <div className="admin-users__error" style={{ marginBottom: 'var(--spacing-md)' }}>
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</p>
      ) : threads.length === 0 ? (
        <div className="messages__empty">
          <Inbox size={40} />
          <p>{t('messages.none')}</p>
          <p className="messages__empty-hint">{t('messages.noneHint')}</p>
        </div>
      ) : (
        <div className="messages">
          <aside className="messages__list">
            <div className="messages__list-head">
              {/* `n`, not `count`: i18next treats `count` as a plural selector
                  and would look for messages.threads_one / _other, which do not
                  exist — in several of the nine locales that resolves to the
                  raw key rather than the string. */}
              {t('messages.threads', { n: threads.length })}
              {unreadCount > 0 && <span className="messages__badge">{unreadCount}</span>}
            </div>
            {threads.map((thread) => {
              const iso = getIsoBySlug(thread.standard_slug || '');
              return (
                <button
                  type="button"
                  key={thread.id}
                  className={`messages__thread${thread.id === activeId ? ' is-active' : ''}${thread.has_unread ? ' is-unread' : ''}`}
                  onClick={() => openThread(thread)}
                >
                  <span className="messages__thread-top">
                    <span className="messages__thread-who">
                      {thread.has_unread ? <Mail size={14} /> : <MailOpen size={14} />}
                      {thread.lead_name || thread.lead_email}
                    </span>
                    <span className="messages__thread-when">{when(thread.last_message_at)}</span>
                  </span>
                  <span className="messages__thread-sub">{preview(thread)}</span>
                  {iso && <span className="messages__thread-tag">{iso.code}</span>}
                </button>
              );
            })}
          </aside>

          <section className="messages__pane">
            {!active ? (
              <div className="messages__placeholder">
                <Inbox size={32} />
                <p>{t('messages.selectThread')}</p>
              </div>
            ) : (
              <>
                <header className="messages__pane-head">
                  <div>
                    <h2>{active.lead_name || active.lead_email}</h2>
                    <p>{active.lead_email}</p>
                  </div>
                  {/* An admin is reading someone else's conversation. Saying so
                      explains why there is no reply box, instead of leaving it
                      looking broken. */}
                  {!isOwner && (
                    <span className="messages__readonly">
                      <User size={13} /> {t('messages.readOnly')}
                    </span>
                  )}
                </header>

                <div className="messages__scroll">
                  {messagesLoading ? (
                    <p style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</p>
                  ) : (
                    messages.map((m) => (
                      <article
                        key={m.id}
                        className={`messages__msg messages__msg--${m.direction}`}
                      >
                        <div className="messages__msg-head">
                          <span className="messages__msg-from">
                            {m.direction === 'inbound'
                              ? (m.from_name || m.from_email || t('messages.client'))
                              : (m.from_name || t('messages.you'))}
                          </span>
                          <span className="messages__msg-when">
                            {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                          </span>
                        </div>
                        {m.subject && <p className="messages__msg-subject">{m.subject}</p>}
                        {/* body_text is plain text by construction (inbound HTML
                            is never stored) and is rendered as a text node —
                            never dangerouslySetInnerHTML. */}
                        <p className="messages__msg-body">{m.body_text || ''}</p>
                      </article>
                    ))
                  )}
                  <div ref={endRef} />
                </div>

                {isOwner && (
                  <div className="messages__reply">
                    {sent && <p className="messages__sent">{sent}</p>}
                    <textarea
                      className="messages__reply-input"
                      rows={4}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder={t('messages.replyPlaceholder')}
                      maxLength={5000}
                    />
                    <div className="messages__reply-actions">
                      <span className="messages__reply-hint">
                        <CornerUpLeft size={13} /> {t('messages.replyHint')}
                      </span>
                      <Button
                        variant="primary"
                        size="md"
                        loading={sending}
                        disabled={!replyBody.trim() || sending}
                        onClick={handleReply}
                      >
                        <Send size={15} /> {t('messages.send')}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
