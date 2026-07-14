import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, AlertCircle, X, CalendarClock } from 'lucide-react';
import { Button } from '../../components/ui/FormElements';
import ConsultationModal from '../../components/ConsultationModal';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import BrandLogo from '../../components/ui/BrandLogo';
import BackButton from '../../components/ui/BackButton';
import '../client/GapAnalysis.css';
import './PublicGapAnalysis.css';

// Anonymous version of the gap analysis quiz. No auth, no Supabase write.
// Score is stashed in localStorage so it can be hydrated into the user's
// profile when they later sign up via /start-checkout.
const QUESTION_KEYS = ['gapAnalysis.q1', 'gapAnalysis.q2', 'gapAnalysis.q3', 'gapAnalysis.q4', 'gapAnalysis.q5'];
const ANON_STORAGE_KEY = 'gap_analysis_score_anon';

export default function PublicGapAnalysis() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [answers, setAnswers] = useState(Array(QUESTION_KEYS.length).fill(null));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(null);
  const [consultOpen, setConsultOpen] = useState(false);

  // After the test is taken, gently prompt the visitor to book a consultation
  // once (they can reopen it from the button below the results).
  const autoPromptedRef = useRef(false);
  useEffect(() => {
    if (score !== null && !autoPromptedRef.current) {
      autoPromptedRef.current = true;
      setConsultOpen(true);
    }
  }, [score]);

  const handleAnswer = (val) => {
    const newAnswers = [...answers];
    newAnswers[currentIdx] = val;
    setAnswers(newAnswers);
    if (currentIdx < QUESTION_KEYS.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const handleSubmit = () => {
    const yesCount = answers.filter(a => a === true).length;
    const finalScore = Math.round((yesCount / QUESTION_KEYS.length) * 100);
    try { localStorage.setItem(ANON_STORAGE_KEY, String(finalScore)); } catch { /* ignore */ }
    setScore(finalScore);
  };

  // Results view: show score + 3-tier pricing upsell
  if (score !== null) {
    const isReady = score >= 60;
    return (
      <div className="public-gap">
        <header className="public-gap__header">
          <BrandLogo size={26} />
          <LanguageSwitcher variant="landing" />
        </header>

        <BackButton />

        <div className="public-gap__results">
          <div className="public-gap__results-card">
            {isReady ? (
              <CheckCircle2 size={48} color="var(--color-success)" style={{ margin: '0 auto 16px', display: 'block' }} />
            ) : (
              <AlertCircle size={48} color="var(--color-warning)" style={{ margin: '0 auto 16px', display: 'block' }} />
            )}
            <h2 style={{ textAlign: 'center', marginBottom: 8 }}>{t('gapAnalysis.publicResultsTitle')}</h2>
            <div
              className="gap-analysis__score"
              style={{
                color: isReady ? 'var(--color-success)' : 'var(--color-warning)',
                textAlign: 'center',
              }}
            >
              {t('dashboard.yourScore', { score })}
            </div>
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', maxWidth: 520, margin: '0 auto 8px' }}>
              {isReady ? t('gapAnalysis.highScoreUpsell') : t('gapAnalysis.lowScoreUpsell')}
            </p>

            <div className="public-gap__result-actions">
              <Button variant="primary" size="lg" onClick={() => navigate('/certifications')}>
                {t('gapAnalysis.proceedToCert')} <ArrowRight size={16} style={{ marginLeft: 8 }} />
              </Button>
              <Button variant="secondary" size="lg" onClick={() => setConsultOpen(true)}>
                <CalendarClock size={16} style={{ marginRight: 8 }} />
                {t('consultation.book')}
              </Button>
            </div>
          </div>
        </div>

        <ConsultationModal isOpen={consultOpen} onClose={() => setConsultOpen(false)} />
      </div>
    );
  }

  // Quiz view (anonymous)
  return (
    <div className="public-gap">
      <header className="public-gap__header">
        <BrandLogo size={26} />
        <LanguageSwitcher variant="landing" />
      </header>

      <BackButton />

      <div className="public-gap__hero">
        <h1>{t('gapAnalysis.publicHeroTitle')}</h1>
        <p>{t('gapAnalysis.publicHeroSubtitle')}</p>
      </div>

      <div className="page-container gap-analysis-page" style={{ minHeight: 'auto', padding: '0 1rem 3rem' }}>
        <div className="gap-analysis__content">
          <Link to="/" className="gap-analysis__close-btn" title="Close">
            <X size={20} />
          </Link>

          <div className="gap-analysis__progress">
            {t('gapAnalysis.questionOf', { current: currentIdx + 1, total: QUESTION_KEYS.length })}
            <div className="gap-analysis__progress-bar">
              <div
                className="gap-analysis__progress-fill"
                style={{ width: `${((currentIdx) / QUESTION_KEYS.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="gap-analysis__question-card">
            <h3 className="gap-analysis__question">{t(QUESTION_KEYS[currentIdx])}</h3>
            <div className="gap-analysis__options">
              <button
                className={`gap-analysis__option ${answers[currentIdx] === true ? 'selected-yes' : ''}`}
                onClick={() => handleAnswer(true)}
              >
                <div className="gap-analysis__option-radio">
                  {answers[currentIdx] === true && <div className="gap-analysis__option-radio-fill" />}
                </div>
                {t('common.yes')}
              </button>
              <button
                className={`gap-analysis__option ${answers[currentIdx] === false ? 'selected-no' : ''}`}
                onClick={() => handleAnswer(false)}
              >
                <div className="gap-analysis__option-radio">
                  {answers[currentIdx] === false && <div className="gap-analysis__option-radio-fill" />}
                </div>
                {t('common.no')}
              </button>
            </div>
          </div>

          <div className="gap-analysis__actions">
            <Button
              variant="secondary"
              onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
            >
              {t('common.back')}
            </Button>

            {currentIdx === QUESTION_KEYS.length - 1 ? (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={answers[currentIdx] === null}
              >
                {t('gapAnalysis.seeResults')} <ArrowRight size={16} style={{ marginLeft: '8px' }} />
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => setCurrentIdx(prev => Math.min(QUESTION_KEYS.length - 1, prev + 1))}
                disabled={answers[currentIdx] === null}
              >
                {t('common.next')} <ArrowRight size={16} style={{ marginLeft: '8px' }} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
