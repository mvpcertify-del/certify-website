import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Send, Bot, User, Sparkles, Mail, Tag, CheckCircle } from 'lucide-react';
import './SaraChatWidget.css';

const INTEREST_KEYS = [
  'sara.iso9001',
  'sara.iso14001',
  'sara.iso27001',
  'sara.iso45001',
  'sara.iso22000',
  'sara.iso13485',
  'sara.notSure',
];

// Number of user messages before showing lead capture (for anonymous users)
const LEAD_CAPTURE_AFTER = 2;

export default function SaraChatWidget({ user }) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.split('-')[0] || 'en';
  const initialMessage = { role: 'assistant', content: t('sara.greeting') };
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadEmail, setLeadEmail] = useState('');
  const [leadInterest, setLeadInterest] = useState('');
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const isLoggedIn = !!user;
  const userMessageCount = messages.filter((m) => m.role === 'user').length;

  // Reset conversation when language changes so Sara's greeting and context switch cleanly
  useEffect(() => {
    setMessages([{ role: 'assistant', content: t('sara.greeting') }]);
    setInput('');
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLang]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showLeadForm]);

  // Lets other parts of the page (the home hero's "Hello! I'm Sara" bubble, the
  // footer's "Chat with Sara" button) open the chat without prop plumbing.
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('certify:open-sara', open);
    return () => window.removeEventListener('certify:open-sara', open);
  }, []);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Show lead form after N user messages (anonymous users only)
  useEffect(() => {
    if (!isLoggedIn && !leadCaptured && userMessageCount === LEAD_CAPTURE_AFTER && !loading) {
      // Slight delay so the AI response appears first
      const timer = setTimeout(() => {
        setShowLeadForm(true);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: t('sara.leadCapture'),
          },
        ]);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [userMessageCount, isLoggedIn, leadCaptured, loading, t]);

  const submitLead = async () => {
    if (!leadEmail || !leadEmail.includes('@')) return;
    setLeadSubmitting(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_lead',
          email: leadEmail,
          interest: leadInterest || null,
          source: isLoggedIn ? 'dashboard' : 'landing_page',
          userId: user?.id || null,
        }),
      });

      if (!res.ok) throw new Error('Failed');

      setLeadSuccess(true);
      setLeadCaptured(true);
      setTimeout(() => {
        setShowLeadForm(false);
        setLeadSuccess(false);
      }, 2500);
    } catch (err) {
      console.error('Lead capture error:', err);
    } finally {
      setLeadSubmitting(false);
    }
  };

  const dismissLeadForm = () => {
    setShowLeadForm(false);
    setLeadCaptured(true); // Don't show again
  };

  const sendMessage = async (text) => {
    const userMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      // Skip the initial greeting and any lead-capture messages
      const cleanConversation = updatedMessages
        .slice(1)
        .filter((m) => !m.isLeadPrompt)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: cleanConversation,
          userId: user?.id || null,
          language: currentLang,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('Sara API error:', res.status, errData);
        throw new Error(errData.detail || errData.error || 'Failed to get response');
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ]);
    } catch (err) {
      console.error('Sara chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t('sara.errorMessage'),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    sendMessage(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = [
    t('sara.q1'),
    t('sara.q2'),
    t('sara.q3'),
    t('sara.q4'),
  ];

  const handleQuickQuestion = (q) => {
    sendMessage(q);
  };

  // Format message text — handle markdown-like bold and line breaks
  const formatMessage = (text) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const formatted = parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      return (
        <span key={i}>
          {formatted}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        className={`sara-fab ${isOpen ? 'sara-fab--hidden' : ''}`}
        onClick={() => setIsOpen(true)}
        aria-label={t('sara.chatWithSara')}
      >
        <div className="sara-fab__icon">
          <Sparkles size={24} />
        </div>
        <span className="sara-fab__label">{t('sara.chatWithSara')}</span>
        <div className="sara-fab__pulse" />
      </button>

      {/* Chat Window */}
      <div className={`sara-chat ${isOpen ? 'sara-chat--open' : ''}`}>
        {/* Header */}
        <div className="sara-chat__header">
          <div className="sara-chat__header-info">
            <div className="sara-chat__avatar">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="sara-chat__name">{t('sara.saraTitle')}</h3>
              <span className="sara-chat__status">
                <span className="sara-chat__status-dot" />
                {t('sara.saraRole')}
              </span>
            </div>
          </div>
          <button
            className="sara-chat__close"
            onClick={() => setIsOpen(false)}
            aria-label={t('sara.closeChat')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="sara-chat__messages">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`sara-chat__message sara-chat__message--${msg.role}`}
            >
              <div className="sara-chat__message-icon">
                {msg.role === 'assistant' ? (
                  <Bot size={16} />
                ) : (
                  <User size={16} />
                )}
              </div>
              <div className="sara-chat__message-bubble">
                {formatMessage(msg.content)}
              </div>
            </div>
          ))}

          {loading && (
            <div className="sara-chat__message sara-chat__message--assistant">
              <div className="sara-chat__message-icon">
                <Bot size={16} />
              </div>
              <div className="sara-chat__message-bubble sara-chat__typing">
                <span className="sara-chat__typing-dot" />
                <span className="sara-chat__typing-dot" />
                <span className="sara-chat__typing-dot" />
              </div>
            </div>
          )}

          {/* Lead Capture Form (inline in chat) */}
          {showLeadForm && !leadSuccess && (
            <div className="sara-chat__lead-form">
              <div className="sara-chat__lead-form-inner">
                <div className="sara-chat__lead-field">
                  <Mail size={16} />
                  <input
                    type="email"
                    placeholder={t('sara.emailPlaceholder')}
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    className="sara-chat__lead-input"
                    onKeyDown={(e) => e.key === 'Enter' && submitLead()}
                  />
                </div>
                <div className="sara-chat__lead-field">
                  <Tag size={16} />
                  <select
                    value={leadInterest}
                    onChange={(e) => setLeadInterest(e.target.value)}
                    className="sara-chat__lead-select"
                  >
                    <option value="">{t('sara.selectInterest')}</option>
                    {INTEREST_KEYS.map((key) => (
                      <option key={key} value={t(key)}>{t(key)}</option>
                    ))}
                  </select>
                </div>
                <div className="sara-chat__lead-actions">
                  <button
                    className="sara-chat__lead-submit"
                    onClick={submitLead}
                    disabled={!leadEmail.includes('@') || leadSubmitting}
                  >
                    {leadSubmitting ? t('common.loading') : t('sara.keepUpdated')}
                  </button>
                  <button
                    className="sara-chat__lead-dismiss"
                    onClick={dismissLeadForm}
                  >
                    {t('sara.noThanks')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lead success confirmation */}
          {showLeadForm && leadSuccess && (
            <div className="sara-chat__lead-success">
              <CheckCircle size={18} />
              <span>{t('sara.thankYou')}</span>
            </div>
          )}

          {/* Quick Questions (only show if just the initial message) */}
          {messages.length === 1 && !loading && (
            <div className="sara-chat__quick-questions">
              <p className="sara-chat__quick-label">{t('sara.quickQuestions')}</p>
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  className="sara-chat__quick-btn"
                  onClick={() => handleQuickQuestion(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="sara-chat__input-area">
          <textarea
            ref={inputRef}
            className="sara-chat__input"
            placeholder={t('sara.inputPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button
            className="sara-chat__send"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            aria-label={t('common.send', 'Send')}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
