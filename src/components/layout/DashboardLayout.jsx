import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import SaraChatWidget from '../sara/SaraChatWidget';
import ProfileCompletionModal from '../ProfileCompletionModal';
import BackButton from '../ui/BackButton';
import './DashboardLayout.css';

// Landing surfaces for each role — there is nothing meaningful to go "back" to
// from these, so the arrow is suppressed rather than dangling.
const ROOT_PATHS = new Set(['/dashboard', '/main-dashboard']);

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/companies': 'Companies',
  '/certification-requests': 'Certification Requests',
  '/auditors': 'Auditors',
  '/certification-bodies': 'Certification Bodies',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export default function DashboardLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Remember the collapsed/expanded choice across reloads and pages.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === '1'; } catch { return false; }
  });
  const toggleCollapse = () => setCollapsed((prev) => {
    const next = !prev;
    try { localStorage.setItem('sidebar_collapsed', next ? '1' : '0'); } catch { /* storage blocked */ }
    return next;
  });
  const [profileModalDismissed, setProfileModalDismissed] = useState(false);
  const location = useLocation();
  const isClient = user?.role === ROLES.CLIENT;

  // Referrals/affiliates and investors run on the `client` role but represent a
  // person, not an organisation — they have no company to give, their
  // registration deliberately never asks for one, and the profile page has no
  // company field to satisfy this with. Prompting them for a Company Name would
  // be an unclearable popup, so the modal is for real (company) clients only.
  // 'consultancy' is included because accounts created before phase19 still sit
  // on role='client', and a consultancy has no company record to satisfy this
  // with either.
  const isPureIndividual = user?.stakeholder_type === 'referral'
    || user?.stakeholder_type === 'investor'
    || user?.stakeholder_type === 'consultancy';

  // Show profile-completion modal for clients missing essential company info
  // (typical after Google OAuth or the simplified email signup). Dismissals
  // via Skip are remembered per-session so the user isn't nagged repeatedly.
  const skipKey = user?.id ? `profile_completion_skipped_${user.id}` : null;
  const skippedInSession = skipKey ? sessionStorage.getItem(skipKey) === '1' : false;
  const needsProfileCompletion = Boolean(
    isClient && !isPureIndividual && user && !user.company_name && !skippedInSession && !profileModalDismissed
  );

  const handleProfileComplete = () => {
    setProfileModalDismissed(true);
    window.location.reload();
  };

  const handleProfileSkip = () => {
    if (skipKey) sessionStorage.setItem(skipKey, '1');
    setProfileModalDismissed(true);
  };

  const pageTitle = pageTitles[location.pathname] || (
    <>Certify.cx<sup className="brand-tm">™</sup></>
  );

  return (
    <div className={`dashboard-layout ${collapsed ? 'dashboard-layout--collapsed' : ''}`}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />
      <TopBar
        pageTitle={pageTitle}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        collapsed={collapsed}
      />
      <main className="dashboard-layout__content">
        {!ROOT_PATHS.has(location.pathname) && <BackButton fallback="/dashboard" />}
        <Outlet />
      </main>
      {isClient && <SaraChatWidget user={user} />}
      {needsProfileCompletion && (
        <ProfileCompletionModal
          user={user}
          onComplete={handleProfileComplete}
          onSkip={handleProfileSkip}
        />
      )}
    </div>
  );
}
