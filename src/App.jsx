import { lazy as _reactLazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import LanguageSuggestionPopup from './components/LanguageSuggestionPopup';
import { ROLES, PERMISSIONS } from './utils/roles';

// Wrap React.lazy so a failed dynamic import (a stale chunk after a redeploy —
// "Failed to fetch dynamically imported module") triggers ONE hard reload that
// pulls the fresh index.html + new chunk filenames. Shares the one-shot guard
// key with main.jsx's vite:preloadError handler so we never reload-loop. Every
// `lazy(() => import(...))` below routes through this automatically.
const RELOAD_GUARD_KEY = 'certifycx-chunk-reloaded';
function lazy(factory) {
  return _reactLazy(() =>
    factory().catch((err) => {
      if (!sessionStorage.getItem(RELOAD_GUARD_KEY)) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
        window.location.reload();
        return new Promise(() => {}); // stall render until the reload happens
      }
      throw err; // already retried once — let the ErrorBoundary show the error
    })
  );
}

// Layouts and pages are code-split with React.lazy so the initial download is
// just the shell + the one route the visitor actually landed on. Without this,
// every admin/client page ships in the first bundle and blocks first paint.
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const AuthLayout = lazy(() => import('./components/layout/AuthLayout'));

// Public Pages
const LandingPage = lazy(() => import('./pages/landing/LandingPage'));
const PublicGapAnalysis = lazy(() => import('./pages/public/PublicGapAnalysis'));
// Public pay-first checkout (no signup gate). Replaces the old /start-checkout
// auth gate — buyers create their account AT payment. /start-checkout is kept
// as an alias so older shared links keep working.
const Checkout = lazy(() => import('./pages/public/Checkout'));
const Certifications = lazy(() => import('./pages/public/Certifications'));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/legal/TermsOfService'));

// Auth Pages
const Login = lazy(() => import('./pages/auth/Login'));
const SignUp = lazy(() => import('./pages/auth/SignUp'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const Unauthorized = lazy(() => import('./pages/auth/Unauthorized'));
const AuthCallback = lazy(() => import('./pages/auth/AuthCallback'));

// Admin Pages
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminApplications = lazy(() => import('./pages/admin/AdminApplications'));
const AdminRegionalAdmins = lazy(() => import('./pages/admin/AdminRegionalAdmins'));
const AdminAuditors = lazy(() => import('./pages/admin/AdminAuditors'));
const AdminCertBodies = lazy(() => import('./pages/admin/AdminCertBodies'));
const AdminAccreditationBodies = lazy(() => import('./pages/admin/AdminAccreditationBodies'));
const AdminCountries = lazy(() => import('./pages/admin/AdminCountries'));
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'));
const AdminCommissionTiers = lazy(() => import('./pages/admin/AdminCommissionTiers'));
const AdminConsultancies = lazy(() => import('./pages/admin/AdminConsultancies'));
const AdminReferralPartners = lazy(() => import('./pages/admin/AdminReferralPartners'));
const AdminBilling = lazy(() => import('./pages/admin/AdminBilling'));
const CertificationBodiesRegistry = lazy(() => import('./pages/bodies/CertificationBodies'));
const AdminCompanies = lazy(() => import('./pages/admin/AdminCompanies'));
const ApplicationDetails = lazy(() => import('./pages/admin/ApplicationDetails'));
const ShareableLinks = lazy(() => import('./pages/admin/ShareableLinks'));
const RegistrationRequests = lazy(() => import('./pages/admin/RegistrationRequests'));
const AdminPermissions = lazy(() => import('./pages/admin/AdminPermissions'));
const AdminUserFields = lazy(() => import('./pages/admin/AdminUserFields'));
const AdminApplicationFields = lazy(() => import('./pages/admin/AdminApplicationFields'));

// Public Registration Landing
const RegisterLanding = lazy(() => import('./pages/register/RegisterLanding'));

// Public ISO Certification Landing (Shareable ISO Links)
const IsoLanding = lazy(() => import('./pages/iso/IsoLanding'));

// Public Compliance Audit service page — the non-ISO counterpart to
// /iso/:slug (SOC, GDPR, PCI DSS, HIPAA, …). Content, price and checkout.
const ComplianceLanding = lazy(() => import('./pages/compliance/ComplianceLanding'));

// Dashboard Pages
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const MainDashboard = lazy(() => import('./pages/dashboard/MainDashboard'));
const Sales = lazy(() => import('./pages/admin/Sales'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const Notifications = lazy(() => import('./pages/notifications/Notifications'));
const ApplicationForm = lazy(() => import('./pages/client/ApplicationForm'));
const PaymentPlaceholder = lazy(() => import('./pages/client/PaymentPlaceholder'));
const StartPayment = lazy(() => import('./pages/client/StartPayment'));
const GapAnalysis = lazy(() => import('./pages/client/GapAnalysis'));
const MyCertificates = lazy(() => import('./pages/client/MyCertificates'));
const Referrals = lazy(() => import('./pages/referrals/Referrals'));
const PartnerContract = lazy(() => import('./pages/partner/PartnerContract'));

// Lightweight fallback shown while a route's chunk is being fetched. Kept tiny
// and theme-aware (transparent background) so it doesn't flash a black screen.
function RouteFallback() {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '60vh',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-busy="true"
    />
  );
}

function AppRoutes() {
  // Public routes render immediately — they don't wait for the Supabase auth
  // session to resolve. Auth-gated routes still wait via <ProtectedRoute>,
  // which renders its own loading spinner. This is what removes the long
  // black "Loading..." screen on first visit to the landing page.
  return (
    <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* ---- Public Landing Page ---- */}
          <Route path="/" element={<LandingPage />} />

          {/* ---- Public Registration Landing ---- */}
          <Route path="/register/:type" element={<RegisterLanding />} />

          {/* ---- Public ISO Certification Landing (per-ISO shareable links) ---- */}
          <Route path="/iso/:slug" element={<IsoLanding />} />

          {/* ---- Public Compliance Audit service pages ---- */}
          <Route path="/compliance/:slug" element={<ComplianceLanding />} />

          {/* ---- Public anonymous Gap Analysis quiz ---- */}
          <Route path="/gap-analysis" element={<PublicGapAnalysis />} />

          {/* ---- Public "all certifications" listing (gap-analysis → proceed) ---- */}
          <Route path="/certifications" element={<Certifications />} />

          {/* ---- Public legal pages (linked from signup + footer) ---- */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />

          {/* ---- Public pay-first checkout (no signup gate) ---- */}
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout/success" element={<Checkout />} />
          {/* Alias: old links that pointed at the removed auth gate now land on
              the new frictionless checkout. */}
          <Route path="/start-checkout" element={<Checkout />} />

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

            {/* Main Dashboard — Super Admin overview landing (category boxes).
                The role "Certification dashboard" above is kept intact. */}
            <Route path="/main-dashboard" element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                <MainDashboard />
              </ProtectedRoute>
            } />

            {/* Admin — Sales / revenue overview (Super Admin) */}
            <Route path="/admin/sales" element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                <Sales />
              </ProtectedRoute>
            } />

            {/* Admin — Invoices & Receipts.
                A regional admin is admitted deliberately: RLS on invoices /
                payment_receipts and the server-side scope check on the
                issue-invoice / issue-receipt actions both restrict them to
                their own region, so this is not a cross-region leak. */}
            <Route path="/admin/billing" element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.REGIONAL_ADMIN]}>
                <AdminBilling />
              </ProtectedRoute>
            } />

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

            {/* Admin — Consultancy Partners (performance + agreement) */}
            <Route path="/admin/consultancies" element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.REGIONAL_ADMIN]}>
                <AdminConsultancies />
              </ProtectedRoute>
            } />

            {/* Admin — Referral Partners (who they introduced, what they earned).
                Distinct from /referrals, which is a partner's OWN dashboard. */}
            <Route path="/admin/referral-partners" element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.REGIONAL_ADMIN]}>
                <AdminReferralPartners />
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

            {/* Referral dashboard — referral partners (and super admin oversight) */}
            <Route path="/referrals" element={
              <ProtectedRoute requiredPermission={PERMISSIONS.VIEW_REFERRALS}>
                <Referrals />
              </ProtectedRoute>
            } />

            {/* Partner agreement — electronic contract signing. One agreement
                per partner role (client, 2 Aug); the server serves each role
                its own contract, so all four partner roles share this route. */}
            <Route path="/partner/contract" element={
              <ProtectedRoute allowedRoles={[ROLES.CONSULTANCY, ROLES.REFERRAL, ROLES.AUDITOR, ROLES.REGIONAL_ADMIN]}>
                <PartnerContract />
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
    </Suspense>
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
