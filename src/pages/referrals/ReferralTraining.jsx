import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BackButton from '../../components/ui/BackButton';
import { Button } from '../../components/ui/FormElements';
import { TRAINING_TOPICS } from './trainingTopics';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import './Referrals.css';

// "Training" — the first box on the Referral Program Dashboard (client, 8 Sep).
//
// The tutorials are read here rather than downloaded or watched. Nothing in
// this platform stores training content — there is no table, no bucket and no
// upload screen for it — so instead of shipping a page that waits on files
// somebody still has to produce, the walkthroughs are written into the product
// as translated copy (see trainingTopics.js). A partner sees the real steps on
// day one, in their own language, and a correction is a copy edit.
//
// Every walkthrough ends by taking the partner to the screen it describes:
// reading how to send an invite is only useful next to the button that sends
// one.
export default function ReferralTraining() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Only the first topic starts open. A partner opening this page is almost
  // always new, so "getting started" is what they want; the rest stay collapsed
  // so the six topics fit on one screen and can be scanned.
  const [openKey, setOpenKey] = useState(TRAINING_TOPICS[0].key);

  return (
    <div className="page-container">
      <BackButton fallback="/referral-dashboard" />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('refTraining.title')}</h1>
          <p className="page-subtitle">{t('refTraining.subtitle')}</p>
        </div>
      </div>

      <div className="referral-training-grid">
        {TRAINING_TOPICS.map((topic) => {
          const Icon = topic.icon;
          const isOpen = openKey === topic.key;

          return (
            <div className="referral-training" key={topic.key}>
              {/* The whole head toggles, so the target is the full row rather
                  than a chevron a touch user has to hit precisely. */}
              <button
                type="button"
                className="referral-training__head"
                aria-expanded={isOpen}
                onClick={() => setOpenKey(isOpen ? null : topic.key)}
              >
                <span className="referral-training__icon"><Icon size={20} /></span>
                <span className="referral-training__head-text">
                  <span className="referral-training__title">
                    {t(`refTraining.${topic.key}Title`)}
                  </span>
                  <span className="referral-training__desc">
                    {t(`refTraining.${topic.key}Desc`)}
                  </span>
                </span>
                <span className="referral-training__chevron">
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
              </button>

              <div className="referral-training__body" hidden={!isOpen}>
                <ol className="referral-training__steps">
                  {/* `steps` is a count in the catalogue; the sentences live in
                      the locale files, one key per step. */}
                  {Array.from({ length: topic.steps }, (_, i) => (
                    <li key={i}>{t(`refTraining.${topic.key}Step${i + 1}`)}</li>
                  ))}
                </ol>

                <Button
                  variant="outline"
                  size="md"
                  onClick={() => navigate(topic.path)}
                >
                  {t('refTraining.openScreen')} <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
