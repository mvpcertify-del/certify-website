import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, X } from 'lucide-react';
import { Input, Select, Button, Autocomplete } from './ui/FormElements';
import { getRegionFromCountryAsync } from '../utils/roles';
import { supabase } from '../lib/supabase';
import { apiPost } from '../lib/apiClient';
import './ProfileCompletionModal.css';

const EMPLOYEE_RANGES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

const fetchCountryOptions = async (text) => {
  try {
    const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
    const res = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&type=country&apiKey=${apiKey}`);
    const data = await res.json();
    if (data.features) {
      return [...new Set(data.features.map(f => f.properties.country).filter(Boolean))];
    }
    return [];
  } catch {
    return [];
  }
};

export default function ProfileCompletionModal({ user, onComplete, onSkip }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    company_name: user?.company_name || '',
    activity: user?.user_metadata?.activity || '',
    country: user?.user_metadata?.country || '',
    number_of_employees: user?.user_metadata?.number_of_employees || '',
    contact_number: user?.user_metadata?.contact_number || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setError('');
    if (!formData.company_name.trim() || !formData.country.trim()) {
      setError(t('auth.validationCompanyFields'));
      return;
    }
    setSaving(true);
    try {
      const region = await getRegionFromCountryAsync(formData.country, supabase);
      // apiPost attaches the access token; /api/user now rejects anonymous
      // profile writes. `region` is ignored for a self-edit and re-derived
      // server-side from the country, which lands on the same value.
      await apiPost('/api/user', {
        action: 'update-profile',
        userId: user.id,
        company_name: formData.company_name,
        region: region || null,
        activity: formData.activity,
        country: formData.country,
        number_of_employees: formData.number_of_employees,
        contact_number: formData.contact_number,
      });
      onComplete?.();
    } catch (err) {
      setError(err.message || 'Failed to save profile');
      setSaving(false);
    }
  };

  return (
    <div className="profile-complete-modal__overlay" role="dialog" aria-modal="true">
      <div className="profile-complete-modal">
        <button
          type="button"
          className="profile-complete-modal__close"
          onClick={onSkip}
          aria-label={t('auth.completeProfileSkip')}
        >
          <X size={20} />
        </button>

        <div className="profile-complete-modal__icon">
          <Building2 size={28} />
        </div>

        <h2 className="profile-complete-modal__title">{t('auth.completeProfileTitle')}</h2>
        <p className="profile-complete-modal__subtitle">{t('auth.completeProfileSubtitle')}</p>

        {error && (
          <div className="auth-form__error" style={{ marginBottom: '12px' }}>
            <span>{error}</span>
          </div>
        )}

        <div className="profile-complete-modal__body">
          <Input
            label={t('auth.companyName')}
            id="pc-company"
            name="company_name"
            placeholder={t('auth.companyNamePlaceholder')}
            value={formData.company_name}
            onChange={handleChange}
            required
          />

          <Input
            label={t('auth.businessActivity')}
            id="pc-activity"
            name="activity"
            placeholder={t('auth.businessActivityPlaceholder')}
            value={formData.activity}
            onChange={handleChange}
          />

          <Autocomplete
            label={t('auth.location')}
            id="pc-country"
            name="country"
            placeholder={t('auth.locationPlaceholder')}
            freeSolo
            fetchOptions={fetchCountryOptions}
            value={formData.country}
            onChange={handleChange}
            required
          />

          <Select
            label={t('auth.numberOfEmployees')}
            id="pc-employees"
            name="number_of_employees"
            value={formData.number_of_employees}
            onChange={handleChange}
          >
            <option value="">{t('auth.selectRange')}</option>
            {EMPLOYEE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>

          <Input
            label={t('auth.contactNumber')}
            id="pc-phone"
            name="contact_number"
            placeholder="+971 50 123 4567"
            value={formData.contact_number}
            onChange={handleChange}
          />
        </div>

        <div className="profile-complete-modal__actions">
          <Button variant="secondary" size="md" onClick={onSkip} disabled={saving}>
            {t('auth.completeProfileSkip')}
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
            {t('auth.completeProfileSave')}
          </Button>
        </div>
      </div>
    </div>
  );
}
