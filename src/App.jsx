import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardLayout from './components/layout/DashboardLayout';
import AuthLayout from './components/layout/AuthLayout';
import LanguageSuggestionPopup from './components/LanguageSuggestionPopup';
import { ROLES, PERMISSIONS } from './utils/roles';

// Public Pages
import LandingPage from './pages/landing/LandingPage';
import PublicGapAnalysis from './pages/public/PublicGapAnalysis';
import StartCheckout from './pages/public/StartCheckout';

// Auth Pages
import Login from './pages/auth/Login';
import SignUp from './pages/auth/SignUp';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Unauthorized from './pages/auth/Unauthorized';
import AuthCallback from './pages/auth/AuthCallback';

// Admin Pages
import AdminUsers from './pages/admin/AdminUsers';
import AdminApplications from './pages/admin/AdminApplications';
import AdminRegionalAdmins from './pages/admin/AdminRegionalAdmins';
import AdminAuditors from './pages/admin/AdminAuditors';
import AdminCertBodies from './pages/admin/AdminCertBodies';
import AdminAccreditationBodies from './pages/admin/AdminAccreditationBodies';
import AdminCountries from './pages/admin/AdminCountries';
import AdminCoupons from './pages/admin/AdminCoupons';
import AdminCommissionTiers from './pages/admin/AdminCommissionTiers';
import CertificationBodiesRegistry from './pages/bodies/CertificationBodies';
import AdminCompanies from './pages/admin/AdminCompanies';
import ApplicationDetails from './pages/admin/ApplicationDetails';
import ShareableLinks from './pages/admin/ShareableLinks';
import RegistrationRequests from './pages/admin/RegistrationRequests';
import AdminPermissions from './pages/admin/AdminPermissions';
import AdminUserFields from './pages/admin/AdminUserFields';
import AdminApplicationFields from './pages/admin/AdminApplicationFields';

// Public Registration Landing
import RegisterLanding from './pages/register/RegisterLanding';

// Public ISO Certification Landing (Shareable ISO Links)
import IsoLanding from './pages/iso/IsoLanding';

// Dashboard Pages
import Dashboard from './pages/dashboard/Dashboard';
import Settings from './pages/settings/Settings';
import Notifications from './pages/notifications/Notifications';
import ApplicationForm from './pages/client/ApplicationForm';
import PaymentPlaceholder from './pages/client/PaymentPlaceholder';
import StartPayment from './pages/client/StartPayment';
import GapAnalysis from './pages/client/GapAnalysis';
import MyCertificates from './pages/client/MyCertificates';
import Referrals from './pages/referrals/Referrals';

function AppRoutes() {
  const { loading } = useAuth();
  const { t } = useTranslation();

  return (
    <>
      {loading ? (
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
          {t('common.loading')}
        </div>
      ) : (
        <Routes>
          {/* ---- Public Landing Page ---- */}
          <Route path="/" element={<LandingPage />} />

          {/* ---- Public Registration Landing ---- */}
          <Route path="/register/:type" element={<RegisterLanding />} />

          {/* ---- Public ISO Certification Landing (per-ISO shareable links) ---- */}
          <Route path="/iso/:slug" element={<IsoLanding />} />

          {/* ---- Public anonymous Gap Analysis quiz ---- */}
          <Route path="/gap-analysis" element={<PublicGapAnalysis />} />

          {/* ---- Auth gate before paid checkout (Google or email) ---- */}
          <Route path="/start-checkout" element={<StartCheckout />} />

          {/* ---- Auth Routes ---- */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>

          {/* ---- OAuth Callback ---- */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* ---- Unauthorized ---- */}
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ---- Protected Dashboard Routes ---- */}
          <Route element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            {/* Generic Dashboard (Fallback) */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Role-Specific Dashboards */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.REGIONAL_ADMIN]}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/auditor/dashboard" element={
              <ProtectedRoute allowedRoles={[ROLES.AUDITOR]}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/cert-body/dashboard" element={
              <ProtectedRoute allowedRoles={[ROLES.CERTIFICATION_BODY]}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/client/dashboard" element={
              <ProtectedRoute allowedRoles={[ROLES.CLIENT]}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/client/apply" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.CREATE_CERTIFICATION}>
                <ApplicationForm />
              </ProtectedRoute>
            } />
            <Route path="/client/apply/:applicationId" element={
              <ProtectedRoute allowedRoles={[ROLES.CLIENT]}>
                <ApplicationForm />
              </ProtectedRoute>
            } />
            <Route path="/client/start-payment" element={
              <ProtectedRoute allowedRoles={[ROLES.CLIENT]}>
                <StartPayment />
              </ProtectedRoute>
            } />
            <Route path="/client/gap-analysis" element={
              <ProtectedRoute allowedRoles={[ROLES.CLIENT]}>
                <GapAnalysis />
              </ProtectedRoute>
            } />
            <Route path="/client/checkout/:applicationId" element={
              <ProtectedRoute allowedRoles={[ROLES.CLIENT]}>
                <PaymentPlaceholder />
              </ProtectedRoute>
            } />
            <Route path="/client/certificates" element={
              <ProtectedRoute allowedRoles={[ROLES.CLIENT]}>
                <MyCertificates />
              </ProtectedRoute>
            } />

            {/* Admin User Management — manage_users permission */}
            <Route path="/admin/users" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_USERS}>
                <AdminUsers />
              </ProtectedRoute>
            } />

            {/* Admin — All Applications */}
            <Route path="/admin/applications" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.VIEW_ALL_CERTIFICATIONS}>
                <AdminApplications />
              </ProtectedRoute>
            } />

            {/* Admin — Companies */}
            <Route path="/admin/companies" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.VIEW_COMPANIES}>
                <AdminCompanies />
              </ProtectedRoute>
            } />

            {/* Admin — Regional Admins */}
            <Route path="/admin/regional-admins" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.CREATE_ADMINS}>
                <AdminRegionalAdmins />
              </ProtectedRoute>
            } />

            {/* Admin — Auditors */}
            <Route path="/admin/auditors" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_AUDITORS}>
                <AdminAuditors />
              </ProtectedRoute>
            } />

            {/* Admin — Certification Body user accounts */}
            <Route path="/admin/cert-bodies" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_BODIES}>
                <AdminCertBodies />
              </ProtectedRoute>
            } />

            {/* Admin — Certification Bodies Registry (separate from CB user accounts) */}
            <Route path="/admin/cb-registry" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_BODIES}>
                <CertificationBodiesRegistry />
              </ProtectedRoute>
            } />

            {/* Admin — Accreditation Bodies (master list) */}
            <Route path="/admin/accreditation-bodies" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_BODIES}>
                <AdminAccreditationBodies />
              </ProtectedRoute>
            } />

            {/* Admin — Countries (linked to regions) */}
            <Route path="/admin/countries" element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                <AdminCountries />
              </ProtectedRoute>
            } />

            {/* Admin — Discount Coupons */}
            <Route path="/admin/coupons" element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                <AdminCoupons />
              </ProtectedRoute>
            } />

            {/* Admin — Referral Commission Tiers */}
            <Route path="/admin/commission-tiers" element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                <AdminCommissionTiers />
              </ProtectedRoute>
            } />

            {/* Admin — Shareable Links */}
            <Route path="/admin/shareable-links" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_USERS}>
                <ShareableLinks />
              </ProtectedRoute>
            } />

            {/* Admin — Registration Requests */}
            <Route path="/admin/registrations" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_USERS}>
                <RegistrationRequests />
              </ProtectedRoute>
            } />

            {/* Admin — Roles & Permissions (super admin only) */}
            <Route path="/admin/permissions" element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                <AdminPermissions />
              </ProtectedRoute>
            } />

            {/* Admin — Custom User Fields (super admin only) */}
            <Route path="/admin/user-fields" element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                <AdminUserFields />
              </ProtectedRoute>
            } />

            {/* Admin — Custom Application Fields (super admin only) */}
            <Route path="/admin/application-fields" element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                <AdminApplicationFields />
              </ProtectedRoute>
            } />

            {/* Application Details — admins, auditors, and CBs can all view */}
            <Route path="/admin/applications/:id" element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.REGIONAL_ADMIN, ROLES.AUDITOR, ROLES.CERTIFICATION_BODY]}>
                <ApplicationDetails />
              </ProtectedRoute>
            } />

            {/* Profile — accessible to all authenticated users */}
            <Route path="/profile" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_SETTINGS}>
                <Settings />
              </ProtectedRoute>
            } />

            {/* Notifications */}
            <Route path="/notifications" element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            } />

            {/* Referral Program */}
            <Route path="/referrals" element={
              <ProtectedRoute>
                <Referrals />
              </ProtectedRoute>
            } />

            {/* Settings — admin only */}
            <Route path="/settings" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_SETTINGS}>
                <Settings />
              </ProtectedRoute>
            } />
          </Route>

          {/* ---- Redirect Catch-All ---- */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <AppRoutes />
            <LanguageSuggestionPopup />
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
