import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Input, Button, Select } from '../../components/ui/FormElements';
import { REGIONS, ROLES, ROLE_LABELS, PERMISSIONS, getRolePermissions, hasPermission, getDisplayRoleLabel } from '../../utils/roles';
import { COUNTRY_DIAL_CODES } from '../../utils/dialCodes';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import CustomFieldRenderer from '../../components/CustomFieldRenderer';
import { supabase as supabaseClient } from '../../lib/supabase';
import { User, Globe, Shield, Settings as SettingsIcon, Check, DollarSign } from 'lucide-react';
import './Settings.css';

const allTabs = [
  { id: 'profile', label: 'Profile', icon: User, adminOnly: false },
  { id: 'payouts', label: 'Payouts', icon: DollarSign, superAdminOnly: true },
  { id: 'regions', label: 'Regions', icon: Globe, adminOnly: true },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield, adminOnly: true },
  { id: 'general', label: 'General', icon: SettingsIcon, adminOnly: true },
];

export default function Settings() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('profile');

  const isAdmin = hasPermission(user?.role, PERMISSIONS.MANAGE_USERS);
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const tabs = allTabs.filter(tab => {
    if (tab.superAdminOnly) return isSuperAdmin;
    if (tab.adminOnly) return isAdmin;
    return true;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAdmin ? t('settings.title') : t('settings.myProfile')}</h1>
          <p className="page-subtitle">{isAdmin ? t('settings.manageAccount') : t('settings.manageDetails')}</p>
        </div>
      </div>

      <div className="settings__layout">
        <div className="settings__tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings__tab ${activeTab === tab.id ? 'settings__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="settings__content">
          {activeTab === 'profile' && <ProfileTab user={user} />}
          {activeTab === 'payouts' && <PayoutsTab user={user} />}
          {activeTab === 'regions' && <RegionsTab />}
          {activeTab === 'roles' && <RolesTab />}
          {activeTab === 'general' && <GeneralTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ user }) {
  const { updatePassword, supabase } = useAuth();

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
      setMessage({ type: 'error', text: 'Please choose an image file.' });
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
      setMessage({ type: 'success', text: 'Picture uploaded — click Save Changes to keep it.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to upload picture' });
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

      setMessage({ type: 'success', text: 'Profile updated successfully! Refreshing...' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Please fill in both password fields.' });
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match!' });
      return;
    }

    setPasswordLoading(true);
    setMessage(null);
    try {
      const { success, error } = await updatePassword(passwordData.newPassword);
      if (!success) throw new Error(error);

      setPasswordData({ newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: 'Password updated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update password' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="settings__section">
      <h2 className="settings__section-title">Profile Information</h2>
      <p className="settings__section-desc">Update your account details</p>

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
            <span style={{ fontWeight: 600, fontSize: '1.2rem' }}>{user?.full_name || user?.name || 'User'}</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{getDisplayRoleLabel(user?.role, user?.stakeholder_type) || 'Role'}</span>
            <label className="settings__avatar-upload" style={{ cursor: avatarUploading ? 'wait' : 'pointer' }}>
              <span className="auth-form__link" style={{ fontSize: '0.85rem' }}>
                {avatarUploading ? 'Uploading…' : (avatarUrl ? 'Change picture' : 'Add profile picture')}
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
          <Input
            label="Full Name"
            id="settings-name"
            value={formData.full_name}
            onChange={(e) => setFormData({...formData, full_name: e.target.value})}
          />
          <Input
            label="Email"
            id="settings-email"
            type="email"
            value={user?.email || ''}
            disabled
          />
          <div className="form-group">
            <label className="form-label" htmlFor="settings-phone">Contact Number</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                className="form-select"
                style={{ flex: '1 1 120px', minWidth: '120px' }}
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
                  placeholder="50 123 4567"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                />
              </div>
            </div>
          </div>
          <Input
            label="City"
            id="settings-city"
            value={formData.city}
            onChange={(e) => setFormData({...formData, city: e.target.value})}
            placeholder="City where you live"
          />
          <Input
            label="Country"
            id="settings-country"
            value={formData.country}
            onChange={(e) => setFormData({...formData, country: e.target.value})}
            placeholder="Country where you live"
          />
          <Input
            label="Role"
            id="settings-role"
            value={getDisplayRoleLabel(user?.role, user?.stakeholder_type) || 'Role'}
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
          <Button variant="primary" size="md" onClick={handleProfileUpdate} loading={profileLoading}>Save Changes</Button>
          <Button variant="ghost" size="md" onClick={() => {
            setFormData({
              full_name: user?.full_name || user?.name || '',
              phone_code: initialPhone.code,
              phone_number: initialPhone.number,
              city: user?.city || '',
              country: user?.country || '',
            });
            setAvatarUrl(user?.avatar_url || '');
          }}>Cancel</Button>
        </div>
      </div>

      <h2 className="settings__section-title" style={{ marginTop: '40px', paddingTop: '40px', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>Security</h2>
      <p className="settings__section-desc">Update your password</p>

      <div className="settings__form">
        <div className="settings__form-grid">
          <Input
            label="New Password"
            id="settings-new-password"
            type="password"
            placeholder="Enter new password"
            value={passwordData.newPassword}
            onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
          />
          <Input
            label="Confirm Password"
            id="settings-confirm-password"
            type="password"
            placeholder="Confirm new password"
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
          />
        </div>
        <div className="settings__form-actions">
          <Button variant="primary" size="md" onClick={handlePasswordUpdate} loading={passwordLoading}>Update Password</Button>
        </div>
      </div>
    </div>
  );
}

function PayoutsTab({ user }) {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);

  const fetchReferrals = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', adminId: user.id }),
      });
      const data = await res.json();
      if (data.referrals) setReferrals(data.referrals);
    } catch (err) {
      console.error('Failed to fetch referrals:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

  const handleMarkPaid = async (referralId) => {
    setActionLoading(referralId);
    setMessage(null);
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-payout', adminId: user.id, referralId, payoutStatus: 'paid' }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Payout marked as paid. Referrer has been notified.' });
        fetchReferrals();
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to mark payout' });
    } finally {
      setActionLoading(null);
    }
  };

  const pendingPayouts = referrals.filter(r => r.payout_status !== 'paid');
  const paidPayouts = referrals.filter(r => r.payout_status === 'paid');
  const totalPending = pendingPayouts.reduce((sum, r) => sum + (parseFloat(r.commission_amount) || 0), 0);
  const totalPaid = paidPayouts.reduce((sum, r) => sum + (parseFloat(r.commission_amount) || 0), 0);

  const columns = [
    { key: 'referrer_name', label: 'Referrer', render: (val, row) => (
      <div>
        <div style={{ fontWeight: 600 }}>{val}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{row.referrer_email}</div>
      </div>
    )},
    { key: 'referred_email', label: 'Referred Client' },
    { key: 'payment_amount', label: 'Sale Amount', render: (val) => val ? `$${parseFloat(val).toFixed(2)}` : '-' },
    { key: 'commission_amount', label: 'Commission (10%)', render: (val) => val ? `$${parseFloat(val).toFixed(2)}` : '-' },
    { key: 'payout_status', label: 'Payout Status', render: (val) => (
      <StatusBadge status={val || 'pending'} label={val === 'paid' ? 'Paid' : 'Pending Payout'} />
    )},
    { key: 'converted_at', label: 'Converted', render: (val) => val ? new Date(val).toLocaleDateString() : '-' },
    { key: 'action', label: 'Action', render: (_, row) => row.payout_status !== 'paid' ? (
      <Button
        size="sm"
        variant="primary"
        onClick={() => handleMarkPaid(row.id)}
        loading={actionLoading === row.id}
      >
        Mark Paid
      </Button>
    ) : (
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
        {row.paid_at ? new Date(row.paid_at).toLocaleDateString() : 'Paid'}
      </span>
    )},
  ];

  return (
    <div className="settings__section">
      <h2 className="settings__section-title">Referral Payouts</h2>
      <p className="settings__section-desc">
        Manage commission payouts to referrers. When a referral converts, the referrer receives an in-app notification to send their bank details to your email.
      </p>

      {message && (
        <div style={{
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px',
          backgroundColor: message.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: message.type === 'error' ? '#b91c1c' : '#15803d',
          border: `1px solid ${message.type === 'error' ? '#fca5a5' : '#86efac'}`,
        }}>
          {message.text}
        </div>
      )}

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="payout-stat-card">
          <span className="payout-stat-card__label">Total Conversions</span>
          <span className="payout-stat-card__value">{referrals.length}</span>
        </div>
        <div className="payout-stat-card">
          <span className="payout-stat-card__label">Pending Payouts</span>
          <span className="payout-stat-card__value" style={{ color: '#f59e0b' }}>${totalPending.toFixed(2)}</span>
        </div>
        <div className="payout-stat-card">
          <span className="payout-stat-card__label">Total Paid Out</span>
          <span className="payout-stat-card__value" style={{ color: '#10b981' }}>${totalPaid.toFixed(2)}</span>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading payouts...</p>
      ) : referrals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
          <DollarSign size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p>No converted referrals yet. Payouts will appear here when referrals convert.</p>
        </div>
      ) : (
        <DataTable columns={columns} data={referrals} emptyMessage="No payouts found." />
      )}
    </div>
  );
}

function RegionsTab() {
  const [activeRegions, setActiveRegions] = useState(
    () => Object.fromEntries(REGIONS.map(r => [r.id, true]))
  );
  const [saved, setSaved] = useState(false);

  const handleToggle = (regionId) => {
    setActiveRegions(prev => ({ ...prev, [regionId]: !prev[regionId] }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const activeCount = Object.values(activeRegions).filter(Boolean).length;

  return (
    <div className="settings__section">
      <h2 className="settings__section-title">Region Management</h2>
      <p className="settings__section-desc">Configure active regions for your platform ({activeCount} of {REGIONS.length} active)</p>
      <div className="settings__regions-list">
        {REGIONS.map((region) => (
          <div key={region.id} className={`settings__region-row ${!activeRegions[region.id] ? 'settings__region-row--disabled' : ''}`}>
            <div className="settings__region-info">
              <span className="settings__region-emoji">{region.emoji}</span>
              <span className="settings__region-name">{region.label}</span>
              {!activeRegions[region.id] && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', marginLeft: '8px' }}>Inactive</span>}
            </div>
            <div className="settings__region-toggle">
              <label className="settings__switch">
                <input
                  type="checkbox"
                  checked={activeRegions[region.id]}
                  onChange={() => handleToggle(region.id)}
                />
                <span className="settings__switch-slider" />
              </label>
            </div>
          </div>
        ))}
      </div>
      <div className="settings__form-actions" style={{ marginTop: '20px' }}>
        <Button variant="primary" size="md" onClick={handleSave}>
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

function RolesTab() {
  const roleKeys = Object.values(ROLES);
  const permKeys = Object.values(PERMISSIONS);

  return (
    <div className="settings__section">
      <h2 className="settings__section-title">Roles & Permissions</h2>
      <p className="settings__section-desc">View the permission matrix for all roles</p>
      <div className="settings__permissions-table-wrap">
        <table className="settings__permissions-table">
          <thead>
            <tr>
              <th>Permission</th>
              {roleKeys.map(r => <th key={r}>{ROLE_LABELS[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {permKeys.map(perm => (
              <tr key={perm}>
                <td>{perm.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                {roleKeys.map(role => {
                  const has = getRolePermissions(role).includes(perm);
                  return (
                    <td key={role} className="settings__perm-cell">
                      {has ? <Check size={16} className="settings__perm-check" /> : <span className="settings__perm-dash">-</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GeneralTab() {
  return (
    <div className="settings__section">
      <h2 className="settings__section-title">General Settings</h2>
      <p className="settings__section-desc">Platform-wide configuration</p>
      <div className="settings__general-items">
        <div className="settings__general-item">
          <div>
            <h3 className="settings__general-label">Platform Name</h3>
            <p className="settings__general-desc">The name displayed across the platform</p>
          </div>
          <Input id="platform-name" defaultValue="Certify.cx" style={{ maxWidth: 250 }} />
        </div>
        <div className="settings__general-item">
          <div>
            <h3 className="settings__general-label">Email Notifications</h3>
            <p className="settings__general-desc">Receive email alerts for certification updates</p>
          </div>
          <label className="settings__switch">
            <input type="checkbox" defaultChecked />
            <span className="settings__switch-slider" />
          </label>
        </div>
        <div className="settings__general-item">
          <div>
            <h3 className="settings__general-label">Two-Factor Authentication</h3>
            <p className="settings__general-desc">Add an extra layer of account security</p>
          </div>
          <label className="settings__switch">
            <input type="checkbox" />
            <span className="settings__switch-slider" />
          </label>
        </div>
      </div>
    </div>
  );
}
