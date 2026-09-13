import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/FormElements';
import { TRAINING_TOPICS, wikiUrl } from './trainingTopics';
import { ArrowRight, PlayCircle, FileDown } from 'lucide-react';
import DashboardBoxes from '../../components/ui/DashboardBoxes';
import './Referrals.css';

// "Training" — the first box on the Referral Program Dashboard (client, 7 Sep).
//
// Laid out as the SAME grid of boxes as the dashboard itself, on the client's
// instruction of 8 Sep: "If you can follow & apply the Boxes Visual appearance
// in Training & Marketing, it will be more easy to understand by referral
// partners." So it renders <DashboardBoxes>, the one shared grid every
// dashboard now uses — a partner learns one visual idea, a box you pick, and
// it holds on every screen they touch.
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

      <DashboardBoxes
        selectedKey={openKey}
        boxes={TRAINING_TOPICS.map((tp) => ({
          key: tp.key,
          icon: tp.icon,
          color: tp.color,
          // The big figure is how many steps the walkthrough runs to, so a
          // partner sees the length before opening it.
          value: tp.steps,
          label: t(`refTraining.${tp.key}Title`),
          desc: t(`refTraining.${tp.key}Desc`),
          // Opens underneath rather than navigating: the grid is the map, and
          // comparing two walkthroughs should not need a round trip.
          onClick: () => setOpenKey(tp.key),
        }))}
      />

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
          {/* Two ways to take the same walkthrough, each carrying its own
              length so a partner can pick one that fits the time they have
              (client, 13 Sep). Rendered only for topics whose recording and
              hand-out are actually published on the wiki — a button that
              leads to a missing page is worse than no button. */}
          {(topic.video || topic.pdf) && (
            <div className="referral-training__media">
              {topic.video && (
                <a
                  className="referral-training__media-link"
                  href={wikiUrl(topic.video.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <PlayCircle size={16} />
                  {t('refTraining.watchVideo', { minutes: topic.video.minutes })}
                </a>
              )}
              {topic.pdf && (
                <a
                  className="referral-training__media-link"
                  href={wikiUrl(topic.pdf.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileDown size={16} />
                  {t('refTraining.readPdf', { minutes: topic.pdf.minutes })}
                </a>
              )}
            </div>
          )}
          <Button variant="primary" size="md" onClick={() => navigate(topic.path)}>
            {t('refTraining.openScreen')} <ArrowRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
