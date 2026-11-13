import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';

// Generic stub for a nav link that's in the design but has no real page
// behind it yet (client's mockup, 28 Oct — several sidebar items like Open
// Projects, My Schedule, Hours/Milestones are visual-only for now, by
// agreement). Keeps the sidebar matching the mockup without faking data.
export default function ComingSoon({ title }) {
  const { t } = useTranslation();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: '80px 20px', color: 'var(--color-text-secondary, #64748b)', textAlign: 'center',
    }}>
      <Construction size={36} />
      <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-text-primary, #0f172a)' }}>{title}</h2>
      <p style={{ margin: 0, fontSize: '0.9rem', maxWidth: 360 }}>{t('common.comingSoon', 'This page is coming soon.')}</p>
    </div>
  );
}
