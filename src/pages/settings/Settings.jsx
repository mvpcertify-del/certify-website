import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Input, Button, Autocomplete } from '../../components/ui/FormElements';
import NameFields from '../../components/ui/NameFields';
import { getDisplayRoleLabel } from '../../utils/roles';
import { COUNTRY_DIAL_CODES, dialCodeForCountry } from '../../utils/dialCodes';
import { fetchCityOptions } from '../../utils/geoapify';
import CustomFieldRenderer from '../../components/CustomFieldRenderer';
import { supabase as supabaseClient } from '../../lib/supabase';
import { Eye, EyeOff } from 'lucide-react';
import './Settings.css';

// My Profile.
//
// Until 12 Sep this file was ALSO the "Settings" page: /profile and /settings
// both mounted it, both opened on the same Profile tab, and a Super Admin saw
// both links in the sidebar — pointing at one screen whose title said
// "Settings" even after clicking "My Profile". The client asked what the
// difference was, and the honest answer was that there was none.
//
// So it is now one page with one name. The admin tabs that used to hang off it
// went as follows:
//   - Payouts             -> its own screen, /admin/payouts (the one tab that
//                            did real work)
//   - Roles & Permissions -> removed; it was a read-only copy of the editable
//                            matrix at /admin/permissions
//   - Regions, General    -> removed on the client's instruction. Neither saved
//                            anything: their toggles reset on reload, which is
//                            worse than not offering them
//
// /settings still resolves (App.jsx redirects it here) so old bookmarks land
// somewhere real.
export default function Settings() {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings.myProfile')}</h1>
          <p className="page-subtitle">{t('settings.manageDetails')}</p>
        </div>
      </div>

      <div className="settings__content">
        <ProfileTab user={user} />
      </div>
    </div>
  );
}

function ProfileTab({ user }) {
  const { updatePassword, supabase } = useAuth();
  const { t } = useTranslation();

  // Split a stored phone string ("+971 50 123 4567") back into dial code +
  // number so the two-part control can round-trip it. Longest code wins so
  // "+1-268" doesn't get mistaken for "+1".
  const splitPhone = (raw) => {
    if (!raw) return { code: '+971', number: '' };
    const match = [...COUNTRY_DIAL_CODES]
      .sort((a, b) => b.code.length - a.code.length)
      .find(c => raw.startsWith(c.code));
    if (match) return { code: match.code, number: raw.slice(match.code.length).trim() };
    return { code: '+971', number: raw };
  };
  const initialPhone = splitPhone(user?.phone || user?.contact_number || '');

  const [formData, setFormData] = useState({
    full_name: user?.full_name || user?.name || '',
    phone_code: initialPhone.code,
    phone_number: initialPhone.number,
    city: user?.city || '',
    country: user?.country || '',
  });

  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [customFields, setCustomFields] = useState([]);
  const [customValues, setCustomValues] = useState(user?.custom_fields || {});

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // Show/hide toggles for the two password fields. Tracked separately so
  // revealing the new password does not also reveal the confirmation — the
  // point of the second field is to catch a typo, and it cannot do that if
  // both are visible at once.
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Load custom fields scoped to the user's role.
  useEffect(() => {
    if (!user?.role) return;
    supabaseClient
      .from('custom_user_fields')
      .select('*')
      .eq('is_active', true)
      .contains('applies_to_roles', [user.role])
      .order('display_order', { ascending: true })
      .then(({ data }) => setCustomFields(data || []));
  }, [user?.role]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: t('settings.chooseImage') });
      return;
    }
    setAvatarUploading(true);
    setMessage(null);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      setMessage({ type: 'success', text: t('settings.pictureUploaded') });
    } catch (err) {
      console.error('Avatar upload failed:', err);
      setMessage({ type: 'error', text: t('settings.failedUpload') });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleProfileUpdate = async () => {
    setProfileLoading(true);
    setMessage(null);
    try {
      const phone = formData.phone_number.trim()
        ? `${formData.phone_code} ${formData.phone_number.trim()}`
        : null;
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone,
          city: formData.city,
          country: formData.country,
          avatar_url: avatarUrl || null,
          custom_fields: customValues,
        })
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: t('settings.profileUpdated') });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('Profile update failed:', err);
      setMessage({ type: 'error', text: t('settings.failedUpdate') });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      setMessage({ type: 'error', text: t('settings.passwordsRequired') });
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: t('settings.passwordsMismatch') });
      return;
    }

    setPasswordLoading(true);
    setMessage(null);
    try {
      const { success, error } = await updatePassword(passwordData.newPassword);
      if (!success) throw new Error(error);

      setPasswordData({ newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: t('settings.passwordUpdated') });
    } catch (err) {
      // Supabase Auth's own sentence ("Password should be at least 6
      // characters") is specific and useful, so it is kept when there is one.
      setMessage({ type: 'error', text: err.message || t('settings.failedPasswordUpdate') });
    } finally {
      setPasswordLoading(false);
    }
  };

  const roleLabel = getDisplayRoleLabel(user?.role, user?.stakeholder_type) || t('settings.role');

  return (
    <div className="settings__section">
      <h2 className="settings__section-title">{t('settings.profileInfo')}</h2>
      <p className="settings__section-desc">{t('settings.updateDetails')}</p>

      {message && (
        <div className="application-form__error" style={{
          backgroundColor: message.type === 'error' ? 'var(--color-bg-error, #fee2e2)' : 'var(--color-bg-success, #dcfce7)',
          color: message.type === 'error' ? 'var(--color-text-error, #b91c1c)' : 'var(--color-text-success, #15803d)',
          border: `1px solid ${message.type === 'error' ? '#fca5a5' : '#86efac'}`,
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {message.text}
        </div>
      )}

      <div className="settings__form" style={{ marginBottom: '40px' }}>
        <div className="settings__avatar-section">
          <div className="settings__avatar-large" style={avatarUrl ? { padding: 0, overflow: 'hidden' } : undefined}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              (user?.full_name || user?.name || 'U').charAt(0)
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '1.2rem' }}>{user?.full_name || user?.name || t('common.user')}</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{roleLabel}</span>
            <label className="settings__avatar-upload" style={{ cursor: avatarUploading ? 'wait' : 'pointer' }}>
              <span className="auth-form__link" style={{ fontSize: '0.85rem' }}>
                {avatarUploading
                  ? t('settings.uploading')
                  : (avatarUrl ? t('settings.changePicture') : t('settings.addPicture'))}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={avatarUploading}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
        <div className="settings__form-grid">
          <NameFields
            idPrefix="settings-name"
            value={formData.full_name}
            onChange={(v) => setFormData({ ...formData, full_name: v })}
          />
          <Input
            label={t('settings.email')}
            id="settings-email"
            type="email"
            value={user?.email || ''}
            disabled
          />
          <div className="form-group">
            <label className="form-label" htmlFor="settings-phone">{t('settings.contactNumber')}</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                className="form-select"
                style={{ flex: '1 1 120px', minWidth: '120px' }}
                aria-label={t('settings.contactNumber')}
                value={formData.phone_code}
                onChange={(e) => setFormData({ ...formData, phone_code: e.target.value })}
              >
                {COUNTRY_DIAL_CODES.map(c => (
                  <option key={`${c.code}-${c.label}`} value={c.code}>{c.label}</option>
                ))}
              </select>
              <div style={{ flex: 1 }}>
                <input
                  className="form-input"
                  id="settings-phone"
                  dir="ltr"
                  placeholder="50 123 4567"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                />
              </div>
            </div>
          </div>
          {/* Type a city → pick "City, Country" → both fill in, and the phone
              dial code auto-updates to that country (client, 25 Jul). */}
          <Autocomplete
            label={t('settings.city')}
            id="settings-city"
            name="city"
            freeSolo
            placeholder={t('settings.cityPlaceholder')}
            value={formData.city}
            fetchOptions={fetchCityOptions}
            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
            onSelect={(opt) => {
              if (!opt || typeof opt === 'string') return;
              const code = dialCodeForCountry({ countryCode: opt.countryCode, countryName: opt.country });
              setFormData(prev => ({
                ...prev,
                city: opt.city || prev.city,
                country: opt.country || prev.country,
                ...(code ? { phone_code: code } : {}),
              }));
            }}
          />
          <Input
            label={t('settings.countryLabel')}
            id="settings-country"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            placeholder={t('settings.countryPlaceholder')}
          />
          <Input
            label={t('settings.role')}
            id="settings-role"
            value={roleLabel}
            disabled
          />
        </div>

        {customFields.length > 0 && (
          <div className="settings__form-grid" style={{ marginTop: 20 }}>
            {customFields.map(field => (
              <div key={field.id} style={{ gridColumn: field.field_type === 'textarea' ? '1 / -1' : 'auto' }}>
                <CustomFieldRenderer
                  field={field}
                  value={customValues[field.field_key]}
                  onChange={(v) => setCustomValues(prev => ({ ...prev, [field.field_key]: v }))}
                />
              </div>
            ))}
          </div>
        )}

        <div className="settings__form-actions">
          <Button variant="primary" size="md" onClick={handleProfileUpdate} loading={profileLoading}>{t('common.save')}</Button>
          <Button variant="ghost" size="md" onClick={() => {
            setFormData({
              full_name: user?.full_name || user?.name || '',
              phone_code: initialPhone.code,
              phone_number: initialPhone.number,
              city: user?.city || '',
              country: user?.country || '',
            });
            setAvatarUrl(user?.avatar_url || '');
          }}>{t('common.cancel')}</Button>
        </div>
      </div>

      <h2 className="settings__section-title" style={{ marginTop: '40px', paddingTop: '40px', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>{t('settings.security')}</h2>
      <p className="settings__section-desc">{t('settings.updatePassword')}</p>

      <div className="settings__form">
        <div className="settings__form-grid">
          <Input
            label={t('settings.newPassword')}
            id="settings-new-password"
            // Revealing the field flips type to "text", and FormElements only
            // forces LTR for type="password" — so in Arabic a revealed password
            // would render right-to-left. dir pins it regardless of type.
            dir="ltr"
            type={showNewPassword ? 'text' : 'password'}
            placeholder={t('settings.newPasswordPlaceholder')}
            value={passwordData.newPassword}
            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
            rightElement={
              <button
                type="button"
                className="settings__password-toggle"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                title={showNewPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          <Input
            label={t('settings.confirmPassword')}
            id="settings-confirm-password"
            dir="ltr"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder={t('settings.confirmPasswordPlaceholder')}
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
            rightElement={
              <button
                type="button"
                className="settings__password-toggle"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                title={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
        </div>
        <div className="settings__form-actions">
          <Button variant="primary" size="md" onClick={handlePasswordUpdate} loading={passwordLoading}>{t('settings.updatePasswordBtn')}</Button>
        </div>
      </div>
    </div>
  );
}
