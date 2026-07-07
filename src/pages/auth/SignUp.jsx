import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Input, Select, Button, Autocomplete } from '../../components/ui/FormElements';
import CustomFieldRenderer, { validateCustomFields } from '../../components/CustomFieldRenderer';
import { getStakeholderType } from '../../utils/stakeholderTypes';
import { supabase } from '../../lib/supabase';
import { AlertCircle, CheckCircle, Eye, EyeOff, Clock, Mail, ArrowLeft, Building2, UserCheck, Gift, Briefcase, Award, TrendingUp, ChevronRight } from 'lucide-react';
import './Auth.css';

// Sign Up account-type options shown in the first-step picker. The visible
// labels are what the client asked for; `slug` maps each to the category that
// already exists in certify.cx (Affiliate → the existing "referral" programme,
// Consultant → "consultancy"). `slug: 'client'` uses the simple email/Google
// flow; every other slug routes into its existing stakeholder wizard.
const SIGNUP_TYPE_OPTIONS = [
  { slug: 'client',             labelKey: 'auth.roleClient',     descKey: 'auth.roleClientDesc',     icon: Building2,   color: '#10B981' },
  { slug: 'auditor',            labelKey: 'auth.roleAuditor',    descKey: 'auth.roleAuditorDesc',    icon: UserCheck,   color: '#3B82F6' },
  { slug: 'referral',           labelKey: 'auth.roleAffiliate',  descKey: 'auth.roleAffiliateDesc',  icon: Gift,        color: '#EC4899' },
  { slug: 'consultancy',        labelKey: 'auth.roleConsultant', descKey: 'auth.roleConsultantDesc', icon: Briefcase,   color: '#F59E0B' },
  { slug: 'certification-body', labelKey: 'auth.roleCertBody',   descKey: 'auth.roleCertBodyDesc',   icon: Award,       color: '#8B5CF6' },
  { slug: 'investor',           labelKey: 'auth.roleInvestor',   descKey: 'auth.roleInvestorDesc',   icon: TrendingUp,  color: '#6366F1' },
];

const EMPLOYEE_RANGES = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+',
];

const COUNTRY_DIAL_CODES = [
  { code: '+971', label: 'UAE (+971)' },
  { code: '+966', label: 'Saudi Arabia (+966)' },
  { code: '+1', label: 'USA/Canada (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+33', label: 'France (+33)' },
  { code: '+49', label: 'Germany (+49)' },
  { code: '+81', label: 'Japan (+81)' },
  { code: '+93', label: 'Afghanistan (+93)' },
  { code: '+355', label: 'Albania (+355)' },
  { code: '+213', label: 'Algeria (+213)' },
  { code: '+376', label: 'Andorra (+376)' },
  { code: '+244', label: 'Angola (+244)' },
  { code: '+1-268', label: 'Antigua and Barbuda (+1-268)' },
  { code: '+54', label: 'Argentina (+54)' },
  { code: '+374', label: 'Armenia (+374)' },
  { code: '+297', label: 'Aruba (+297)' },
  { code: '+43', label: 'Austria (+43)' },
  { code: '+994', label: 'Azerbaijan (+994)' },
  { code: '+1-242', label: 'Bahamas (+1-242)' },
  { code: '+973', label: 'Bahrain (+973)' },
  { code: '+880', label: 'Bangladesh (+880)' },
  { code: '+1-246', label: 'Barbados (+1-246)' },
  { code: '+375', label: 'Belarus (+375)' },
  { code: '+32', label: 'Belgium (+32)' },
  { code: '+501', label: 'Belize (+501)' },
  { code: '+229', label: 'Benin (+229)' },
  { code: '+1-441', label: 'Bermuda (+1-441)' },
  { code: '+975', label: 'Bhutan (+975)' },
  { code: '+591', label: 'Bolivia (+591)' },
  { code: '+387', label: 'Bosnia and Herzegovina (+387)' },
  { code: '+267', label: 'Botswana (+267)' },
  { code: '+55', label: 'Brazil (+55)' },
  { code: '+673', label: 'Brunei (+673)' },
  { code: '+359', label: 'Bulgaria (+359)' },
  { code: '+226', label: 'Burkina Faso (+226)' },
  { code: '+257', label: 'Burundi (+257)' },
  { code: '+855', label: 'Cambodia (+855)' },
  { code: '+237', label: 'Cameroon (+237)' },
  { code: '+238', label: 'Cape Verde (+238)' },
  { code: '+1-345', label: 'Cayman Islands (+1-345)' },
  { code: '+236', label: 'Central African Republic (+236)' },
  { code: '+235', label: 'Chad (+235)' },
  { code: '+56', label: 'Chile (+56)' },
  { code: '+86', label: 'China (+86)' },
  { code: '+57', label: 'Colombia (+57)' },
  { code: '+269', label: 'Comoros (+269)' },
  { code: '+243', label: 'Congo (DRC) (+243)' },
  { code: '+242', label: 'Congo (Republic) (+242)' },
  { code: '+506', label: 'Costa Rica (+506)' },
  { code: '+225', label: 'Côte d’Ivoire (+225)' },
  { code: '+385', label: 'Croatia (+385)' },
  { code: '+53', label: 'Cuba (+53)' },
  { code: '+357', label: 'Cyprus (+357)' },
  { code: '+420', label: 'Czech Republic (+420)' },
  { code: '+45', label: 'Denmark (+45)' },
  { code: '+253', label: 'Djibouti (+253)' },
  { code: '+1-767', label: 'Dominica (+1-767)' },
  { code: '+1-809', label: 'Dominican Republic (+1-809)' },
  { code: '+593', label: 'Ecuador (+593)' },
  { code: '+20', label: 'Egypt (+20)' },
  { code: '+503', label: 'El Salvador (+503)' },
  { code: '+240', label: 'Equatorial Guinea (+240)' },
  { code: '+291', label: 'Eritrea (+291)' },
  { code: '+372', label: 'Estonia (+372)' },
  { code: '+268', label: 'Eswatini (+268)' },
  { code: '+251', label: 'Ethiopia (+251)' },
  { code: '+679', label: 'Fiji (+679)' },
  { code: '+358', label: 'Finland (+358)' },
  { code: '+241', label: 'Gabon (+241)' },
  { code: '+220', label: 'Gambia (+220)' },
  { code: '+995', label: 'Georgia (+995)' },
  { code: '+233', label: 'Ghana (+233)' },
  { code: '+350', label: 'Gibraltar (+350)' },
  { code: '+30', label: 'Greece (+30)' },
  { code: '+299', label: 'Greenland (+299)' },
  { code: '+1-473', label: 'Grenada (+1-473)' },
  { code: '+502', label: 'Guatemala (+502)' },
  { code: '+224', label: 'Guinea (+224)' },
  { code: '+245', label: 'Guinea-Bissau (+245)' },
  { code: '+592', label: 'Guyana (+592)' },
  { code: '+509', label: 'Haiti (+509)' },
  { code: '+504', label: 'Honduras (+504)' },
  { code: '+852', label: 'Hong Kong (+852)' },
  { code: '+36', label: 'Hungary (+36)' },
  { code: '+354', label: 'Iceland (+354)' },
  { code: '+62', label: 'Indonesia (+62)' },
  { code: '+98', label: 'Iran (+98)' },
  { code: '+964', label: 'Iraq (+964)' },
  { code: '+353', label: 'Ireland (+353)' },
  { code: '+972', label: 'Israel (+972)' },
  { code: '+39', label: 'Italy (+39)' },
  { code: '+1-876', label: 'Jamaica (+1-876)' },
  { code: '+962', label: 'Jordan (+962)' },
  { code: '+7', label: 'Kazakhstan (+7)' },
  { code: '+254', label: 'Kenya (+254)' },
  { code: '+686', label: 'Kiribati (+686)' },
  { code: '+383', label: 'Kosovo (+383)' },
  { code: '+965', label: 'Kuwait (+965)' },
  { code: '+996', label: 'Kyrgyzstan (+996)' },
  { code: '+856', label: 'Laos (+856)' },
  { code: '+371', label: 'Latvia (+371)' },
  { code: '+961', label: 'Lebanon (+961)' },
  { code: '+266', label: 'Lesotho (+266)' },
  { code: '+231', label: 'Liberia (+231)' },
  { code: '+218', label: 'Libya (+218)' },
  { code: '+423', label: 'Liechtenstein (+423)' },
  { code: '+370', label: 'Lithuania (+370)' },
  { code: '+352', label: 'Luxembourg (+352)' },
  { code: '+853', label: 'Macau (+853)' },
  { code: '+389', label: 'North Macedonia (+389)' },
  { code: '+261', label: 'Madagascar (+261)' },
  { code: '+265', label: 'Malawi (+265)' },
  { code: '+60', label: 'Malaysia (+60)' },
  { code: '+960', label: 'Maldives (+960)' },
  { code: '+223', label: 'Mali (+223)' },
  { code: '+356', label: 'Malta (+356)' },
  { code: '+692', label: 'Marshall Islands (+692)' },
  { code: '+222', label: 'Mauritania (+222)' },
  { code: '+230', label: 'Mauritius (+230)' },
  { code: '+52', label: 'Mexico (+52)' },
  { code: '+691', label: 'Micronesia (+691)' },
  { code: '+373', label: 'Moldova (+373)' },
  { code: '+377', label: 'Monaco (+377)' },
  { code: '+976', label: 'Mongolia (+976)' },
  { code: '+382', label: 'Montenegro (+382)' },
  { code: '+212', label: 'Morocco (+212)' },
  { code: '+258', label: 'Mozambique (+258)' },
  { code: '+95', label: 'Myanmar (+95)' },
  { code: '+264', label: 'Namibia (+264)' },
  { code: '+674', label: 'Nauru (+674)' },
  { code: '+977', label: 'Nepal (+977)' },
  { code: '+31', label: 'Netherlands (+31)' },
  { code: '+64', label: 'New Zealand (+64)' },
  { code: '+505', label: 'Nicaragua (+505)' },
  { code: '+227', label: 'Niger (+227)' },
  { code: '+234', label: 'Nigeria (+234)' },
  { code: '+850', label: 'North Korea (+850)' },
  { code: '+47', label: 'Norway (+47)' },
  { code: '+968', label: 'Oman (+968)' },
  { code: '+92', label: 'Pakistan (+92)' },
  { code: '+680', label: 'Palau (+680)' },
  { code: '+970', label: 'Palestine (+970)' },
  { code: '+507', label: 'Panama (+507)' },
  { code: '+675', label: 'Papua New Guinea (+675)' },
  { code: '+595', label: 'Paraguay (+595)' },
  { code: '+51', label: 'Peru (+51)' },
  { code: '+63', label: 'Philippines (+63)' },
  { code: '+48', label: 'Poland (+48)' },
  { code: '+351', label: 'Portugal (+351)' },
  { code: '+1-787', label: 'Puerto Rico (+1-787)' },
  { code: '+974', label: 'Qatar (+974)' },
  { code: '+40', label: 'Romania (+40)' },
  { code: '+7', label: 'Russia (+7)' },
  { code: '+250', label: 'Rwanda (+250)' },
  { code: '+1-869', label: 'Saint Kitts and Nevis (+1-869)' },
  { code: '+1-758', label: 'Saint Lucia (+1-758)' },
  { code: '+1-784', label: 'Saint Vincent and the Grenadines (+1-784)' },
  { code: '+685', label: 'Samoa (+685)' },
  { code: '+378', label: 'San Marino (+378)' },
  { code: '+239', label: 'São Tomé and Príncipe (+239)' },
  { code: '+221', label: 'Senegal (+221)' },
  { code: '+381', label: 'Serbia (+381)' },
  { code: '+248', label: 'Seychelles (+248)' },
  { code: '+232', label: 'Sierra Leone (+232)' },
  { code: '+421', label: 'Slovakia (+421)' },
  { code: '+386', label: 'Slovenia (+386)' },
  { code: '+677', label: 'Solomon Islands (+677)' },
  { code: '+252', label: 'Somalia (+252)' },
  { code: '+27', label: 'South Africa (+27)' },
  { code: '+82', label: 'South Korea (+82)' },
  { code: '+211', label: 'South Sudan (+211)' },
  { code: '+34', label: 'Spain (+34)' },
  { code: '+94', label: 'Sri Lanka (+94)' },
  { code: '+249', label: 'Sudan (+249)' },
  { code: '+597', label: 'Suriname (+597)' },
  { code: '+46', label: 'Sweden (+46)' },
  { code: '+41', label: 'Switzerland (+41)' },
  { code: '+963', label: 'Syria (+963)' },
  { code: '+886', label: 'Taiwan (+886)' },
  { code: '+992', label: 'Tajikistan (+992)' },
  { code: '+255', label: 'Tanzania (+255)' },
  { code: '+66', label: 'Thailand (+66)' },
  { code: '+670', label: 'Timor-Leste (+670)' },
  { code: '+228', label: 'Togo (+228)' },
  { code: '+676', label: 'Tonga (+676)' },
  { code: '+1-868', label: 'Trinidad and Tobago (+1-868)' },
  { code: '+216', label: 'Tunisia (+216)' },
  { code: '+90', label: 'Turkey (+90)' },
  { code: '+993', label: 'Turkmenistan (+993)' },
  { code: '+688', label: 'Tuvalu (+688)' },
  { code: '+256', label: 'Uganda (+256)' },
  { code: '+380', label: 'Ukraine (+380)' },
  { code: '+598', label: 'Uruguay (+598)' },
  { code: '+998', label: 'Uzbekistan (+998)' },
  { code: '+678', label: 'Vanuatu (+678)' },
  { code: '+379', label: 'Vatican City (+379)' },
  { code: '+58', label: 'Venezuela (+58)' },
  { code: '+84', label: 'Vietnam (+84)' },
  { code: '+967', label: 'Yemen (+967)' },
  { code: '+260', label: 'Zambia (+260)' },
  { code: '+263', label: 'Zimbabwe (+263)' },
];

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

const fetchGeoapifyOptions = async (text, type) => {
  try {
    const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
    const res = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&type=${type}&apiKey=${apiKey}`);
    const data = await res.json();
    if (data.features) {
      return [...new Set(data.features.map(f => f.properties.formatted))];
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
function NextSteps() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        textAlign: 'left',
        width: '100%',
        marginBottom: '20px',
        padding: '16px',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        background: 'var(--color-bg-subtle, #f9fafb)',
      }}
    >
      <p style={{ fontWeight: 600, margin: '0 0 10px', fontSize: 'var(--font-size-sm)' }}>
        {t('auth.nextStepsTitle')}
      </p>
      <ol style={{ margin: 0, paddingInlineStart: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
        <li>{t('auth.nextStep1')}</li>
        <li>{t('auth.nextStep2')}</li>
        <li>{t('auth.nextStep3')}</li>
      </ol>
      <p style={{ margin: '12px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        {t('auth.nextStepsContact')}{' '}
        <a href="mailto:support@certify.cx" className="auth-form__link">support@certify.cx</a>
      </p>
    </div>
  );
}

export default function SignUp() {
  const [searchParams] = useSearchParams();
  const registrationType = searchParams.get('type') || '';
  const stakeholderConfig = getStakeholderType(registrationType);
  // Set once the visitor picks "Client" in the first-step type picker — that
  // choice keeps the simple email/Google flow (not the detailed wizard).
  const [clientPicked, setClientPicked] = useState(false);

  // A valid ?type= in the URL (e.g. from /register/:type landing pages or a
  // shared link) goes straight to that stakeholder wizard — unchanged behavior.
  if (registrationType && stakeholderConfig) {
    return <StakeholderSignUpWizard stakeholderConfig={stakeholderConfig} registrationType={registrationType} />;
  }

  // No type chosen yet → show the account-type picker first. "It is not always
  // registering for certification" — the visitor tells us who they are, then
  // continues with Gmail/email.
  if (!registrationType && !clientPicked) {
    return <SignUpTypePicker onPickClient={() => setClientPicked(true)} />;
  }

  return <SimpleClientSignUp />;
}

// First step of Sign Up: pick the account type. "Client" continues here in the
// simple flow; every other type navigates to /signup?type=<slug> which renders
// that type's existing multi-step wizard.
function SignUpTypePicker({ onPickClient }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refQuery = searchParams.get('ref') ? `&ref=${encodeURIComponent(searchParams.get('ref'))}` : '';

  const choose = (slug) => {
    if (slug === 'client') {
      onPickClient();
    } else {
      navigate(`/signup?type=${slug}${refQuery}`);
    }
  };

  return (
    <div className="auth-form auth-form--simple">
      <h2 className="auth-form__hero-title">{t('auth.chooseTypeTitle')}</h2>
      <p className="auth-form__hero-subtitle">{t('auth.chooseTypeSubtitle')}</p>

      <div className="signup-type-list">
        {SIGNUP_TYPE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.slug}
              type="button"
              className="signup-type-option"
              onClick={() => choose(opt.slug)}
            >
              <span className="signup-type-option__icon" style={{ backgroundColor: opt.color }}>
                <Icon size={20} />
              </span>
              <span className="signup-type-option__text">
                <span className="signup-type-option__name">{t(opt.labelKey)}</span>
                <span className="signup-type-option__desc">{t(opt.descKey)}</span>
              </span>
              <ChevronRight size={18} className="signup-type-option__chev" />
            </button>
          );
        })}
      </div>

      <p className="auth-form__legal" style={{ marginTop: 'var(--spacing-lg)' }}>
        {t('auth.alreadyHaveAccount')}{' '}
        <Link to="/login" className="auth-form__link">{t('auth.signIn')}</Link>
      </p>
    </div>
  );
}

function SimpleClientSignUp() {
  const { signup, signInWithGoogle } = useAuth();
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
  const [emailVerification, setEmailVerification] = useState(false);
  const [emailSendFailed, setEmailSendFailed] = useState(false);
  const [resendStatus, setResendStatus] = useState(''); // '', 'sending', 'sent', 'error'

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
      setEmailVerification(true);
      setEmailSendFailed(!!result.emailSendFailed);
      setLoading(false);
      return;
    }
    setError(result.error);
    setLoading(false);
  };

  const handleResendVerification = async () => {
    setResendStatus('sending');
    try {
      const resp = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (resp.ok) {
        setResendStatus('sent');
        setEmailSendFailed(false);
      } else {
        setResendStatus('error');
      }
    } catch {
      setResendStatus('error');
    }
  };

  if (emailVerification) {
    return (
      <div className="auth-form">
        <div className="auth-form__pending">
          <Mail size={48} className="auth-form__pending-icon" />
          <h2 className="auth-form__title">{t('auth.verifyYourEmail')}</h2>
          {emailSendFailed && resendStatus !== 'sent' ? (
            <>
              <p className="auth-form__subtitle" style={{ marginBottom: '12px' }}>
                {t('auth.verificationEmailFailed', { email })}
              </p>
              <Button
                type="button"
                onClick={handleResendVerification}
                disabled={resendStatus === 'sending'}
                style={{ marginBottom: '16px' }}
              >
                {resendStatus === 'sending' ? t('auth.resending') : t('auth.resendVerification')}
              </Button>
              {resendStatus === 'error' && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error, #c00)', marginBottom: '16px' }}>
                  {t('auth.resendError')}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="auth-form__subtitle" style={{ marginBottom: '12px' }}>
                {t('auth.verificationEmailSent', { email })}
              </p>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
                {t('auth.checkInboxMessage')}
              </p>
            </>
          )}
          <NextSteps />
          <Link to="/login" className="auth-form__link" style={{ fontSize: 'var(--font-size-sm)' }}>{t('auth.goToLogin')}</Link>
        </div>
      </div>
    );
  }

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
  const { signup, signInWithGoogle } = useAuth();
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [emailVerification, setEmailVerification] = useState(false);
  const [emailSendFailed, setEmailSendFailed] = useState(false);
  const [resendStatus, setResendStatus] = useState('');

  const customFields = useCustomFieldsForRole(targetRole);
  const [customValues, setCustomValues] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updates = { [name]: value };
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep()) return;

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
      if (targetRole === 'auditor' && result.data?.user && (auditorCert || auditorCv)) {
        try {
          const uploads = [];
          if (auditorCert) {
            uploads.push(supabase.storage.from('auditor-documents')
              .upload(`${result.data.user.id}/lead-auditor-certificate-${Date.now()}-${auditorCert.name}`, auditorCert, { upsert: true }));
          }
          if (auditorCv) {
            uploads.push(supabase.storage.from('auditor-documents')
              .upload(`${result.data.user.id}/cv-${Date.now()}-${auditorCv.name}`, auditorCv, { upsert: true }));
          }
          await Promise.all(uploads);
        } catch (uploadErr) {
          console.error('Auditor document upload error:', uploadErr);
        }
      }
      if (result.needsApproval) {
        await supabase.auth.signOut();
        setPendingApproval(true);
        setLoading(false);
        return;
      }
      setEmailVerification(true);
      setEmailSendFailed(!!result.emailSendFailed);
      setLoading(false);
      return;
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleResendVerification = async () => {
    setResendStatus('sending');
    try {
      const resp = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });
      if (resp.ok) {
        setResendStatus('sent');
        setEmailSendFailed(false);
      } else {
        setResendStatus('error');
      }
    } catch {
      setResendStatus('error');
    }
  };

  if (emailVerification) {
    return (
      <div className="auth-form">
        <div className="auth-form__pending">
          <Mail size={48} className="auth-form__pending-icon" />
          <h2 className="auth-form__title">{t('auth.verifyYourEmail')}</h2>
          {emailSendFailed && resendStatus !== 'sent' ? (
            <>
              <p className="auth-form__subtitle" style={{ marginBottom: '12px' }}>
                {t('auth.verificationEmailFailed', { email: formData.email })}
              </p>
              <Button
                type="button"
                onClick={handleResendVerification}
                disabled={resendStatus === 'sending'}
                style={{ marginBottom: '16px' }}
              >
                {resendStatus === 'sending' ? t('auth.resending') : t('auth.resendVerification')}
              </Button>
              {resendStatus === 'error' && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error, #c00)', marginBottom: '16px' }}>
                  {t('auth.resendError')}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="auth-form__subtitle" style={{ marginBottom: '12px' }}>
                {t('auth.verificationEmailSent', { email: formData.email })}
              </p>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
                {t('auth.checkInboxMessage')}
              </p>
            </>
          )}
          <NextSteps />
          <Link to="/login" className="auth-form__link" style={{ fontSize: 'var(--font-size-sm)' }}>{t('auth.goToLogin')}</Link>
        </div>
      </div>
    );
  }

  if (pendingApproval) {
    return (
      <div className="auth-form">
        <div className="auth-form__pending">
          <Clock size={48} className="auth-form__pending-icon" />
          <h2 className="auth-form__title">{t('auth.registrationSubmitted')}</h2>
          <p className="auth-form__subtitle" style={{ marginBottom: '12px' }}>
            {t('auth.thankYouRegister', { type: stakeholderConfig ? stakeholderConfig.singularTitle : 'a stakeholder' })}
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
            {t('auth.registrationUnderReview')}
          </p>
          <Link to="/login" className="auth-form__link" style={{ fontSize: 'var(--font-size-sm)' }}>{t('auth.goToLogin')}</Link>
        </div>
      </div>
    );
  }

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

      <div className="signup-steps">
        {[
          isPureIndividual ? t('auth.personalInfo') : t('auth.companyInfo'),
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

      {error && (
        <div className="auth-form__error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form__body">
        {step === 1 && (
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
              value={formData.location} onChange={handleChange} required />

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
