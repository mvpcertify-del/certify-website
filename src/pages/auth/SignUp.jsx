import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Input, Select, Button, Autocomplete } from '../../components/ui/FormElements';
import CustomFieldRenderer, { validateCustomFields } from '../../components/CustomFieldRenderer';
import MultiSelect from '../../components/ui/MultiSelect';
import { getStakeholderType } from '../../utils/stakeholderTypes';
import { COUNTRY_DIAL_CODES, dialCodeForCountry } from '../../utils/dialCodes';
import {
  AUDITOR_LEVELS,
  AUDITOR_STANDARD_OPTIONS,
  AUDITOR_SECTOR_OPTIONS,
} from '../../utils/auditorOptions';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import { AlertCircle, CheckCircle, Eye, EyeOff, Clock, ArrowLeft } from 'lucide-react';
import './Auth.css';

const EMPLOYEE_RANGES = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+',
];

// Auditor paperwork travels to /api/user as base64 inside a JSON body, so it
// has to stay under the Vercel 4.5 MB request cap once inflated by a third.
// Kept in step with MAX_DOC_BYTES in api/user.js.
const MAX_AUDITOR_UPLOAD_MB = 3;

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(new Error('Could not read file'));
  reader.readAsDataURL(file);
});

// Hook: load active custom_user_fields that apply to the given role.
function useCustomFieldsForRole(role) {
  const [fields, setFields] = useState([]);
  useEffect(() => {
    if (!role) return;
    supabase
      .from('custom_user_fields')
      .select('*')
      .eq('is_active', true)
      .contains('applies_to_roles', [role])
      .order('display_order', { ascending: true })
      .then(({ data }) => setFields(data || []));
  }, [role]);
  return fields;
}

// Returns STRUCTURED options: { label, city, country, countryCode }.
//
// `label` is Geoapify's formatted "City, Region, Country" string shown in the
// dropdown; the other fields are pulled straight from the feature so a single
// selection fills city AND country AND the phone dial code — no fragile
// comma-splitting of the display string (client, 25 Jul: "type the city name,
// it appears with the country, select it").
//
// `&lang=en` is essential: without it the Arabic funnel gets country names in
// Arabic, which match nothing in the English country->region / country->dial
// maps, silently blanking both region and the phone code.
const fetchGeoapifyOptions = async (text, type) => {
  try {
    const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
    const res = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&type=${type}&lang=en&apiKey=${apiKey}`);
    const data = await res.json();
    if (data.features) {
      const seen = new Set();
      const out = [];
      for (const f of data.features) {
        const p = f.properties || {};
        const label = p.formatted;
        if (!label || seen.has(label)) continue;
        seen.add(label);
        out.push({
          label,
          city: p.city || p.county || p.address_line1 || '',
          country: p.country || '',
          countryCode: p.country_code || '',
        });
      }
      return out;
    }
    return [];
  } catch (error) {
    console.error('Geoapify error:', error);
    return [];
  }
};

// Shown right after an account is created (the "verify your email" screen).
// Instead of dropping a brand-new user straight onto an empty dashboard, this
// tells them what to do next and how to reach the team — the "further steps /
// contact someone" the client asked for.
export default function SignUp() {
  const [searchParams] = useSearchParams();
  const registrationType = searchParams.get('type') || '';
  const stakeholderConfig = getStakeholderType(registrationType);

  // A valid ?type= in the URL (from the invite-only /register/:type landing
  // pages or a shared link) goes to that stakeholder wizard.
  if (registrationType && stakeholderConfig) {
    return <StakeholderSignUpWizard stakeholderConfig={stakeholderConfig} registrationType={registrationType} />;
  }

  // Public sign up is for CLIENTS only (client request). Auditors, CBs,
  // consultancies and referrals/affiliates are invite-only — they reach their
  // wizard through a shared /register/:type link, never the public /signup.
  return <SimpleClientSignUp />;
}

function SimpleClientSignUp() {
  const { signup, signInWithGoogle, login, getRoleDashboard } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref') || '';

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const customFields = useCustomFieldsForRole('client');
  const [customValues, setCustomValues] = useState({});

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleEmailContinue = (e) => {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) {
      setError(t('auth.validationEmail'));
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError(t('auth.validationName'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.validationPasswordLength'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.validationPasswordMatch'));
      return;
    }
    const customCheck = validateCustomFields(customFields, customValues);
    if (!customCheck.valid) {
      setError(t('auth.validationCustomField', { field: customCheck.errorField }));
      return;
    }

    setLoading(true);
    const result = await signup({
      name,
      email,
      password,
      referral_code: referralCode,
      role: 'client',
      stakeholder_type: 'client',
      custom_fields: customValues,
    });

    if (result.success) {
      // Verification was removed — sign the new user straight in and take them
      // to their dashboard instead of a "check your email" screen.
      const loginRes = await login(email, password);
      if (loginRes?.success) {
        navigate(getRoleDashboard(loginRes.data?.user?.role || 'client'));
      } else {
        navigate('/login');
      }
      return;
    }
    setError(result.error);
    setLoading(false);
  };


  return (
    <div className="auth-form auth-form--simple">
      <h2 className="auth-form__hero-title">{t('auth.simpleHeroTitle')}</h2>

      {error && (
        <div className="auth-form__error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {step === 1 && (
        <>
          <button
            type="button"
            className="auth-google-btn auth-google-btn--pill"
            disabled={googleLoading}
            onClick={async () => {
              setGoogleLoading(true);
              setError('');
              const result = await signInWithGoogle();
              if (!result.success) {
                setError(result.error);
                setGoogleLoading(false);
              }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? t('common.redirecting') : t('auth.continueWithGoogle')}
          </button>

          <div className="auth-divider">
            <span>{t('common.or')}</span>
          </div>

          <form onSubmit={handleEmailContinue} className="auth-form__body">
            <Input
              type="email"
              id="signup-email"
              name="email"
              placeholder={t('auth.enterYourEmail')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" size="lg" fullWidth>
              {t('auth.continue')}
            </Button>
          </form>

          <p className="auth-form__legal">
            {t('auth.legalPrefix')}{' '}
            <Link to="/terms" className="auth-form__link">{t('auth.termsLink')}</Link>
            {' '}{t('auth.legalAnd')}{' '}
            <Link to="/privacy" className="auth-form__link">{t('auth.privacyLink')}</Link>.
          </p>
        </>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit} className="auth-form__body">
          <button
            type="button"
            className="auth-back-link"
            onClick={() => { setError(''); setStep(1); }}
          >
            <ArrowLeft size={16} /> {email}
          </button>

          <Input
            label={t('auth.yourName')}
            id="signup-name"
            name="name"
            placeholder={t('auth.yourNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label={t('auth.passwordRequired')}
            type={showPassword ? 'text' : 'password'}
            id="signup-password"
            name="password"
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: '4px' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          <Input
            label={t('auth.confirmPassword')}
            type={showConfirmPassword ? 'text' : 'password'}
            id="signup-confirm"
            name="confirmPassword"
            placeholder={t('auth.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            rightElement={
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: '4px' }}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          {customFields.map(field => (
            <CustomFieldRenderer
              key={field.id}
              field={field}
              value={customValues[field.field_key]}
              onChange={(v) => setCustomValues(prev => ({ ...prev, [field.field_key]: v }))}
            />
          ))}

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            {t('auth.createAccount')}
          </Button>
        </form>
      )}

      <p className="auth-form__footer-text">
        {t('auth.alreadyHaveAccount')} <Link to="/login" className="auth-form__link">{t('auth.signIn')}</Link>
      </p>
    </div>
  );
}

function StakeholderSignUpWizard({ stakeholderConfig, registrationType }) {
  const { signup, signInWithGoogle, login, getRoleDashboard } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref') || '';
  const targetRole = stakeholderConfig?.role || 'client';
  const isIndividualStakeholder = targetRole === 'auditor' || registrationType === 'referral' || registrationType === 'investor';
  // Pure individuals (referral, investor) — no company context at all. Auditors
  // are individuals but still capture a "practice name" + professional fields.
  const isPureIndividual = registrationType === 'referral' || registrationType === 'investor';
  const DRAFT_KEY = `signup_draft_${registrationType || 'default'}`;
  const DEFAULT_FORM = {
    company_name: '',
    activity: '',
    number_of_employees: '',
    number_of_locations: '',
    website: '',
    location: '',
    city: '',
    country: '',
    contact_person_name: '',
    contact_role: '',
    contact_code: '+971',
    contact_number: '',
    email: '',
    password: '',
    confirmPassword: '',
  };
  const loadDraft = () => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return { step: 1, formData: DEFAULT_FORM };
      const parsed = JSON.parse(raw);
      return {
        step: parsed.step || 1,
        formData: { ...DEFAULT_FORM, ...(parsed.formData || {}), password: '', confirmPassword: '' },
      };
    } catch {
      return { step: 1, formData: DEFAULT_FORM };
    }
  };
  const initial = loadDraft();
  const [step, setStep] = useState(initial.step);
  const [formData, setFormData] = useState(initial.formData);

  useEffect(() => {
    try {
      const { password: _p, confirmPassword: _c, ...safeData } = formData;
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, formData: safeData }));
    } catch { /* storage full or blocked — ignore */ }
  }, [formData, step, DRAFT_KEY]);
  const [auditorCert, setAuditorCert] = useState(null);
  const [auditorCv, setAuditorCv] = useState(null);
  const [auditorAuditLog, setAuditorAuditLog] = useState(null);
  // Qualification arrays, shared with the admin "Add Auditor" modal through
  // src/utils/auditorOptions.js so the two forms collect identical values.
  const [auditorStandards, setAuditorStandards] = useState([]);
  const [auditorLevels, setAuditorLevels] = useState([]);
  const [auditorSectors, setAuditorSectors] = useState([]);
  // Non-blocking: the account exists, but a document or the qualification list
  // did not save. Shown on the "verify your email" screen.
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const customFields = useCustomFieldsForRole(targetRole);
  const [customValues, setCustomValues] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updates = { [name]: value };
      // Fallback for free typing (no structured pick): split the display string.
      // A real selection goes through handleLocationSelect below, which is exact.
      if (name === 'location') {
        if (value && typeof value === 'string' && value.includes(',')) {
          const parts = value.split(',');
          const possibleCountry = parts[parts.length - 1].trim();
          const possibleCity = parts[0].trim();
          if (possibleCountry) updates.country = possibleCountry;
          if (possibleCity) updates.city = possibleCity;
        } else {
          updates.city = value;
          updates.country = '';
        }
      }
      return { ...prev, ...updates };
    });
  };

  // Fired when a city suggestion is actually picked. Uses Geoapify's structured
  // fields (not string-splitting) to set city + country, and auto-fills the
  // phone dial code from the country so the user types only the local number
  // (client, 25 Jul). The user can still change the dial code manually after.
  const handleLocationSelect = (opt) => {
    if (!opt || typeof opt === 'string') return;
    const derivedCode = dialCodeForCountry({ countryCode: opt.countryCode, countryName: opt.country });
    setFormData(prev => ({
      ...prev,
      location: opt.label,
      city: opt.city || prev.city,
      country: opt.country || prev.country,
      ...(derivedCode ? { contact_code: derivedCode } : {}),
    }));
  };

  const validateStep = () => {
    setError('');
    if (step === 1) {
      if (isPureIndividual) {
        if (!formData.location) {
          setError(t('auth.validationCompanyFields'));
          return false;
        }
      } else if (isIndividualStakeholder) {
        if (!formData.activity || !formData.location) {
          setError(t('auth.validationCompanyFields'));
          return false;
        }
      } else if (!formData.company_name || !formData.activity || !formData.location) {
        setError(t('auth.validationCompanyFields'));
        return false;
      }
    }
    if (step === 2) {
      if (!formData.contact_person_name || !formData.email || !formData.contact_number) {
        setError(t('auth.validationContactFields'));
        return false;
      }
    }
    if (step === 3) {
      if (formData.password.length < 6) {
        setError(t('auth.validationPasswordLength'));
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError(t('auth.validationPasswordMatch'));
        return false;
      }
      if (targetRole === 'auditor' && (!auditorCert || !auditorCv)) {
        setError(t('auth.validationAuditorDocs'));
        return false;
      }
      // An auditor with no standard and no level cannot be matched to an audit,
      // which is the only reason the record exists. The Audit Log stays
      // optional — not every auditor has one to hand at registration.
      if (targetRole === 'auditor' && (auditorStandards.length === 0 || auditorLevels.length === 0)) {
        setError(t('auth.validationAuditorQualifications'));
        return false;
      }
      const customCheck = validateCustomFields(customFields, customValues);
      if (!customCheck.valid) {
        setError(t('auth.validationCustomField', { field: customCheck.errorField }));
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep(s => s + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(s => s - 1);
  };

  // Pure individuals (referral/affiliate, investor) use a single simple form —
  // the client asked for the shortest possible registration: name, contact
  // number (+ dial code), email, location, and a password to create the login.
  const validateSimple = () => {
    setError('');
    if (!formData.contact_person_name || !formData.email || !formData.contact_number || !formData.location) {
      setError(t('auth.validationContactFields'));
      return false;
    }
    if (formData.password.length < 6) {
      setError(t('auth.validationPasswordLength'));
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.validationPasswordMatch'));
      return false;
    }
    return true;
  };

  // Everything an auditor supplies that AuthContext.signup() does not carry.
  // It runs AFTER the account exists because the qualification arrays key off
  // the new profile id and the files cannot ride inside the signup payload.
  //
  // The uploads go through /api/user rather than straight to storage: signup
  // creates the account unconfirmed and never signs the user in, so there is
  // no session here and a browser-side upload has no identity to authorize
  // against. That is also why every auditor certificate uploaded before
  // phase24 was lost — the bucket did not exist, and the error was swallowed.
  // Returns a human-readable list of what failed, or '' when all is well.
  const attachAuditorDetails = async (auditorId) => {
    const failed = [];

    try {
      await apiPost('/api/user', {
        action: 'save-auditor-qualifications',
        auditorId,
        standards: auditorStandards,
        levels: auditorLevels,
        sectors: auditorSectors,
      });
    } catch (err) {
      console.error('Auditor qualifications save failed:', err);
      failed.push(t('auth.auditorStandards'));
    }

    const documents = [
      ['certificate', auditorCert],
      ['cv', auditorCv],
      ['audit_log', auditorAuditLog],
    ].filter(([, file]) => !!file);

    for (const [docType, file] of documents) {
      try {
        if (file.size > MAX_AUDITOR_UPLOAD_MB * 1024 * 1024) {
          throw new Error(`Larger than ${MAX_AUDITOR_UPLOAD_MB} MB`);
        }
        await apiPost('/api/user', {
          action: 'add-auditor-document',
          auditorId,
          docType,
          fileName: file.name,
          mimeType: file.type || null,
          sizeBytes: file.size,
          dataBase64: await fileToBase64(file),
        });
      } catch (err) {
        console.error('Auditor document upload failed:', docType, err);
        failed.push(file.name);
      }
    }

    return failed.join(', ');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPureIndividual ? !validateSimple() : !validateStep()) return;

    setLoading(true);
    const result = await signup({
      name: formData.contact_person_name,
      email: formData.email,
      password: formData.password,
      // Pure individuals (referral / investor) have no company context — omit
      // all company-specific fields so admins don't see misleading data.
      company_name: isPureIndividual ? null : formData.company_name,
      activity: isPureIndividual ? null : formData.activity,
      number_of_employees: isPureIndividual ? null : formData.number_of_employees,
      number_of_locations: isPureIndividual ? null : formData.number_of_locations,
      website: isPureIndividual ? null : formData.website,
      city: formData.city,
      country: formData.country,
      contact_number: `${formData.contact_code} ${formData.contact_number}`,
      contact_role: isPureIndividual ? null : formData.contact_role,
      referral_code: referralCode,
      role: targetRole,
      stakeholder_type: registrationType || 'client',
      custom_fields: customValues,
    });

    if (result.success) {
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      if (targetRole === 'auditor' && result.data?.user?.id) {
        // Upload the auditor's documents while there is still no session (the
        // bootstrap path). A failure is logged inside attachAuditorDetails; we
        // don't block sign-in on it.
        await attachAuditorDetails(result.data.user.id);
      }
      // Verification was removed — sign in and go straight to the dashboard.
      const loginRes = await login(formData.email, formData.password);
      if (loginRes?.success) {
        navigate(getRoleDashboard(loginRes.data?.user?.role || 'client'));
      } else {
        navigate('/login');
      }
      return;
    } else {
      setError(result.error);
    }
    setLoading(false);
  };


  return (
    <div className="auth-form auth-form--wide">
      <h2 className="auth-form__title">
        {t('auth.registerAs', { type: stakeholderConfig.singularTitle })}
      </h2>
      <p className="auth-form__subtitle">
        {stakeholderConfig.description}
      </p>

      <button
        type="button"
        className="auth-google-btn"
        disabled={googleLoading}
        onClick={async () => {
          setGoogleLoading(true);
          setError('');
          const result = await signInWithGoogle('/auth/callback', registrationType || 'client');
          if (!result.success) {
            setError(result.error);
            setGoogleLoading(false);
          }
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
        </svg>
        {googleLoading ? t('common.redirecting') : t('auth.signUpWithGoogle')}
      </button>

      <div className="auth-divider">
        <span>{t('auth.orFillDetails')}</span>
      </div>

      {!isPureIndividual && (
        <div className="signup-steps">
          {[
            t('auth.companyInfo'),
            t('auth.contactCerts'),
            t('auth.createAccount'),
          ].map((label, i) => (
            <div key={label} className={`signup-steps__item ${step > i + 1 ? 'signup-steps__item--done' : ''} ${step === i + 1 ? 'signup-steps__item--active' : ''}`}>
              <div className="signup-steps__circle">
                {step > i + 1 ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span className="signup-steps__label">{label}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="auth-form__error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form__body">
        {/* Simple single-step form for referrals/affiliates & investors —
            just the essentials, no multi-step wizard. */}
        {isPureIndividual && (
          <>
            <Input
              label={t('auth.fullName')}
              id="signup-contact-name" name="contact_person_name"
              placeholder={t('auth.fullNamePlaceholder')}
              value={formData.contact_person_name}
              onChange={handleChange} required />

            <Input label={t('auth.emailRequired')} type="email" id="signup-email" name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange} required />

            <div className="form-group">
              <label className="form-label" htmlFor="signup-phone">{t('auth.contactNumber')}</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  className="form-select"
                  style={{ flex: '1 1 120px', minWidth: '120px' }}
                  name="contact_code"
                  value={formData.contact_code}
                  onChange={handleChange}
                >
                  {COUNTRY_DIAL_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <div style={{ flex: 1 }}>
                  <input
                    className="form-input"
                    id="signup-phone"
                    name="contact_number"
                    placeholder="50 123 4567"
                    value={formData.contact_number}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            <Autocomplete label={t('auth.location')} id="signup-location" name="location"
              placeholder={t('auth.locationPlaceholder')} freeSolo
              fetchOptions={(text) => fetchGeoapifyOptions(text, 'city')}
              value={formData.location} onChange={handleChange} onSelect={handleLocationSelect} required />

            <Input label={t('auth.passwordRequired')} type={showPassword ? 'text' : 'password'} id="signup-password" name="password"
              placeholder={t('auth.passwordPlaceholder')} value={formData.password}
              onChange={handleChange} required
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: '4px' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            <Input label={t('auth.confirmPassword')} type={showConfirmPassword ? 'text' : 'password'} id="signup-confirm" name="confirmPassword"
              placeholder={t('auth.confirmPasswordPlaceholder')} value={formData.confirmPassword}
              onChange={handleChange} required
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: '4px' }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              {t('auth.createAccount')}
            </Button>
          </>
        )}

        {!isPureIndividual && step === 1 && (
          <>
            {!isPureIndividual && (
              <Input
                label={isIndividualStakeholder ? t('auth.practiceName') : t('auth.companyName')}
                id="signup-company"
                name="company_name"
                placeholder={isIndividualStakeholder ? t('auth.practiceNamePlaceholder') : t('auth.companyNamePlaceholder')}
                value={formData.company_name}
                onChange={handleChange}
                required={!isIndividualStakeholder}
              />
            )}

            {!isPureIndividual && (
              <Input
                label={targetRole === 'auditor' ? t('auth.professionalExpertise') : t('auth.businessActivity')}
                id="signup-activity"
                name="activity"
                placeholder={targetRole === 'auditor' ? t('auth.professionalExpertisePlaceholder') : t('auth.businessActivityPlaceholder')}
                value={formData.activity}
                onChange={handleChange}
                required
              />
            )}

            {!isIndividualStakeholder && (
              <>
                <div className="auth-form__row">
                  <Select label={t('auth.numberOfEmployees')} id="signup-employees" name="number_of_employees"
                    value={formData.number_of_employees} onChange={handleChange}>
                    <option value="">{t('auth.selectRange')}</option>
                    {EMPLOYEE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                  </Select>

                  <Input label={t('auth.numberOfLocations')} id="signup-locations" name="number_of_locations"
                    type="number" placeholder="e.g. 3"
                    value={formData.number_of_locations} onChange={handleChange} />
                </div>

                <Input label={t('auth.website')} id="signup-website" name="website"
                  placeholder="https://yourcompany.com"
                  value={formData.website} onChange={handleChange} />
              </>
            )}

            <Autocomplete label={t('auth.location')} id="signup-location" name="location"
              placeholder={t('auth.locationPlaceholder')} freeSolo
              fetchOptions={(text) => fetchGeoapifyOptions(text, 'city')}
              value={formData.location} onChange={handleChange} onSelect={handleLocationSelect} required />

            <Button type="button" variant="primary" size="lg" fullWidth onClick={handleNext}>
              {t('auth.continue')}
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <Input
              label={isPureIndividual ? t('auth.fullName') : t('auth.contactPersonName')}
              id="signup-contact-name" name="contact_person_name"
              placeholder={isPureIndividual ? t('auth.fullNamePlaceholder') : t('auth.contactPersonPlaceholder')}
              value={formData.contact_person_name}
              onChange={handleChange} required />

            {!isPureIndividual && (
              <Input label={t('auth.designationRole')} id="signup-contact-role" name="contact_role"
                placeholder={t('auth.designationPlaceholder')}
                value={formData.contact_role}
                onChange={handleChange} />
            )}

            <Input label={t('auth.emailRequired')} type="email" id="signup-email" name="email"
              placeholder={isPureIndividual ? 'you@example.com' : 'you@company.com'}
              value={formData.email}
              onChange={handleChange} required />

            <div className="form-group">
              <label className="form-label" htmlFor="signup-phone">{t('auth.contactNumber')}</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  className="form-select"
                  style={{ flex: '1 1 120px', minWidth: '120px' }}
                  name="contact_code"
                  value={formData.contact_code}
                  onChange={handleChange}
                >
                  {COUNTRY_DIAL_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <div style={{ flex: 1 }}>
                  <input
                    className="form-input"
                    id="signup-phone"
                    name="contact_number"
                    placeholder="50 123 4567"
                    value={formData.contact_number}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="auth-form__row">
              <Button type="button" variant="secondary" size="lg" fullWidth onClick={handleBack}>
                {t('auth.backBtn')}
              </Button>
              <Button type="button" variant="primary" size="lg" fullWidth onClick={handleNext}>
                {t('auth.continue')}
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="signup-summary">
              {formData.company_name && (
                <p><strong>Company:</strong> {formData.company_name}</p>
              )}
              <p><strong>Contact:</strong> {formData.contact_person_name} ({formData.email})</p>
            </div>

            <Input label={t('auth.passwordRequired')} type={showPassword ? "text" : "password"} id="signup-password" name="password"
              placeholder={t('auth.passwordPlaceholder')} value={formData.password}
              onChange={handleChange} required
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: '4px' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            <Input label={t('auth.confirmPassword')} type={showConfirmPassword ? "text" : "password"} id="signup-confirm" name="confirmPassword"
              placeholder={t('auth.confirmPasswordPlaceholder')} value={formData.confirmPassword}
              onChange={handleChange} required
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: '4px' }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            {targetRole === 'auditor' && (
              <>
                {/* Client: "If possible to put the Standards & Level of
                    certificate next to each other, it will be good."
                    auth-form__row collapses to one column under 640px. */}
                <div className="auth-form__row">
                  <MultiSelect
                    id="signup-auditor-standards"
                    label={t('auth.auditorStandards')}
                    options={AUDITOR_STANDARD_OPTIONS}
                    value={auditorStandards}
                    onChange={setAuditorStandards}
                    placeholder={t('auth.auditorStandardsPlaceholder')}
                    maxVisible={2}
                  />
                  <MultiSelect
                    id="signup-auditor-levels"
                    label={t('auth.auditorLevel')}
                    options={AUDITOR_LEVELS}
                    value={auditorLevels}
                    onChange={setAuditorLevels}
                    placeholder={t('auth.auditorLevelPlaceholder')}
                    maxVisible={2}
                  />
                </div>

                <MultiSelect
                  id="signup-auditor-sectors"
                  label={t('auth.auditorSectors')}
                  options={AUDITOR_SECTOR_OPTIONS}
                  value={auditorSectors}
                  onChange={setAuditorSectors}
                  placeholder={t('auth.auditorSectorsPlaceholder')}
                  maxVisible={2}
                />
              </>
            )}

            {targetRole === 'auditor' && (
              <div style={{ marginTop: '8px', padding: '16px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-subtle, #f9fafb)' }}>
                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: '4px' }}>{t('auth.auditorDocsTitle')}</p>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>{t('auth.auditorDocsEnglishNote')}</p>

                <div className="form-group">
                  <label className="form-label" htmlFor="signup-cert">{t('auth.leadAuditorCertificate')}</label>
                  <input
                    className="form-input"
                    id="signup-cert"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => setAuditorCert(e.target.files?.[0] || null)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="signup-cv">{t('auth.auditorCv')}</label>
                  <input
                    className="form-input"
                    id="signup-cv"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setAuditorCv(e.target.files?.[0] || null)}
                    required
                  />
                </div>

                {/* Optional: not every auditor has their log to hand at
                    registration, and blocking sign-up on it loses the auditor. */}
                <div className="form-group">
                  <label className="form-label" htmlFor="signup-audit-log">{t('auth.auditorAuditLog')}</label>
                  <input
                    className="form-input"
                    id="signup-audit-log"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => setAuditorAuditLog(e.target.files?.[0] || null)}
                  />
                </div>

                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                  {t('auth.auditorDocsSizeNote', { max: MAX_AUDITOR_UPLOAD_MB })}
                </p>
              </div>
            )}

            {customFields.map(field => (
              <CustomFieldRenderer
                key={field.id}
                field={field}
                value={customValues[field.field_key]}
                onChange={(v) => setCustomValues(prev => ({ ...prev, [field.field_key]: v }))}
              />
            ))}

            <div className="auth-form__row">
              <Button type="button" variant="secondary" size="lg" fullWidth onClick={handleBack}>
                {t('auth.backBtn')}
              </Button>
              <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                {t('auth.createAccount')}
              </Button>
            </div>
          </>
        )}
      </form>

      <p className="auth-form__footer-text">
        {t('auth.alreadyHaveAccount')} <Link to="/login" className="auth-form__link">{t('auth.signIn')}</Link>
        {registrationType && (
          <> | <Link to={`/register/${registrationType}`} className="auth-form__link">{t('auth.backToInfo')}</Link></>
        )}
      </p>
    </div>
  );
}
