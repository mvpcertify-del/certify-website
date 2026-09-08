import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/FormElements';
import { TRAINING_TOPICS } from './trainingTopics';
import { ArrowRight } from 'lucide-react';
import '../dashboard/MainDashboard.css';
import './Referrals.css';

// "Training" — the first box on the Referral Program Dashboard (client, 7 Sep).
//
// Laid out as the SAME grid of boxes as the dashboard itself, on the client's
// instruction of 8 Sep: "If you can follow & apply the Boxes Visual appearance
// in Training & Marketing, it will be more easy to understand by referral
// partners." So it imports MainDashboard.css and reuses `main-dash__card`
// rather than growing a third card style — a partner learns one visual idea,
// a box you pick, and it holds on every screen they touch.
//
// Picking a box opens its walkthrough underneath instead of navigating away:
// the grid is the map, and a partner comparing "adding a client" against
// "sending a proposal" should not have to go back and forth to see both.
//
// The tutorials are read here rather than watched. Nothing in this platform
// stores training content — no table, no bucket, no upload screen — so instead
// of shipping a page that waits on files somebody still has to produce, the
// walkthroughs are written into the product as translated copy (see
// trainingTopics.js). A partner sees the real steps on day one, in their own
// language, and a correction is a copy edit.
export default function ReferralTraining() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // The first topic is open on arrival. A partner opening this page is almost
  // always new, so "getting started" is what they want; and an empty panel
  // under a grid of boxes reads as something that failed to load.
  const [openKey, setOpenKey] = useState(TRAINING_TOPICS[0].key);
  const topic = TRAINING_TOPICS.find(x => x.key === openKey) || null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('refTraining.title')}</h1>
          <p className="page-subtitle">{t('refTraining.subtitle')}</p>
        </div>
      </div>

      <div className="main-dash__grid">
        {TRAINING_TOPICS.map((tp) => {
          const Icon = tp.icon;
          const selected = tp.key === openKey;
          return (
            <button
              key={tp.key}
              type="button"
              // The chosen box keeps its accent border, so the panel below is
              // visibly the answer to the box that was just pressed.
              className={`main-dash__card${selected ? ' main-dash__card--selected' : ''}`}
              aria-expanded={selected}
              onClick={() => setOpenKey(tp.key)}
              style={{ '--card-accent': tp.color }}
            >
              <div className="main-dash__icon" style={{ background: `${tp.color}1a`, color: tp.color }}>
                <Icon size={24} />
              </div>
              {/* The big figure is the number of steps, so a partner can see
                  what they are committing to before they open it. */}
              <div className="main-dash__value">{tp.steps}</div>
              <div className="main-dash__label">{t(`refTraining.${tp.key}Title`)}</div>
              <div className="main-dash__desc">{t(`refTraining.${tp.key}Desc`)}</div>
            </button>
          );
        })}
      </div>

      {topic && (
        <div className="referral-training__panel">
          <h2 className="referral-training__panel-title">
            {t(`refTraining.${topic.key}Title`)}
          </h2>
          <ol className="referral-training__steps">
            {/* `steps` is a count in the catalogue; the sentences live in the
                locale files, one key per step. */}
            {Array.from({ length: topic.steps }, (_, i) => (
              <li key={i}>{t(`refTraining.${topic.key}Step${i + 1}`)}</li>
            ))}
          </ol>
          <Button variant="primary" size="md" onClick={() => navigate(topic.path)}>
            {t('refTraining.openScreen')} <ArrowRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
