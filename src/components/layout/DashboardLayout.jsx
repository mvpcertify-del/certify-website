import { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import { apiPost } from '../../lib/apiClient';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import SaraChatWidget from '../sara/SaraChatWidget';
import ProfileCompletionModal from '../ProfileCompletionModal';
import BackButton from '../ui/BackButton';
import './DashboardLayout.css';

// Landing surfaces for each role — there is nothing meaningful to go "back" to
// from these, so the arrow is suppressed rather than dangling.
// A landing screen has nothing above it, so it gets no Back link.
// '/referral-dashboard' joined the set on 8 Sep: it is the partner's home,
// exactly as '/main-dashboard' is the Super Admin's.
const ROOT_PATHS = new Set(['/dashboard', '/main-dashboard', '/referral-dashboard', '/contractor/dashboard']);

// The four partner roles that must sign their agreement before using anything
// else (client, 2 Aug — "checking the box during registration"). Since email
// verification was removed, a new partner lands on their dashboard immediately;
// this gate makes signing the very first thing they do.
const CONTRACT_ROLES = new Set([ROLES.REFERRAL, ROLES.CONSULTANCY, ROLES.AUDITOR, ROLES.REGIONAL_ADMIN]);

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/companies': 'Companies',
  '/certification-requests': 'Certification Requests',
  '/auditors': 'Auditors',
  '/certification-bodies': 'Certification Bodies',
  '/reports': 'Reports',
  '/profile': 'My Profile',
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

  // ---- Sign-before-use gate for partner roles ----
  // null = still checking, true = signed current version (or n/a), false = must
  // sign. Fail-OPEN on any error (missing template before the phase29 migration,
  // network blip) so a broken check never bricks a partner's access.
  const mustGate = CONTRACT_ROLES.has(user?.role);
  const [contractOk, setContractOk] = useState(mustGate ? null : true);
  const onContractPage = location.pathname === '/partner/contract';
  useEffect(() => {
    // Only partner roles are gated; non-partners start `true` from useState, so
    // nothing to set synchronously here (which the hooks rule forbids anyway).
    if (!mustGate || !user?.id) return;
    let cancelled = false;
    apiPost('/api/user', { action: 'get-contract' })
      .then((res) => { if (!cancelled) setContractOk(res?.signedCurrentVersion === true); })
      .catch(() => { if (!cancelled) setContractOk(true); });
    return () => { cancelled = true; };
  }, [mustGate, user?.id]);

  // Referrals/affiliates and investors run on the `client` role but represent a
  // person, not an organisation — they have no company to give, their
  // registration deliberately never asks for one, and the profile page has no
  // company field to satisfy this with. Prompting them for a Company Name would
  // be an unclearable popup, so the modal is for real (company) clients only.
  // 'consultancy' is kept here for accounts created before phase22 gave it its
  // own role — those still sit on role='client' and would otherwise be shown
  // the same unclearable company prompt.
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

  // An unsigned partner is sent to the agreement and can reach nothing else
  // until they sign. The contract page itself is never gated (that's where they
  // sign). While the check is in flight, hold the screen rather than flashing
  // the dashboard and then yanking it away.
  if (mustGate && !onContractPage) {
    if (contractOk === null) {
      return <div className="dashboard-layout" style={{ minHeight: '100vh' }} />;
    }
    if (contractOk === false) {
      return <Navigate to="/partner/contract" replace />;
    }
  }

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
