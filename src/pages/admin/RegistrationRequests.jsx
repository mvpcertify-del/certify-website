import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ROLES } from '../../utils/roles';
import { STAKEHOLDER_TYPES, getStakeholderCopy } from '../../utils/stakeholderTypes';
import {
  UserPlus, CheckCircle2, XCircle, Clock, Search,
  Building2, Mail, MapPin, Globe2, Filter,
} from 'lucide-react';
import { Button } from '../../components/ui/FormElements';
import { apiPost } from '../../lib/apiClient';
import './RegistrationRequests.css';

const STATUS_TABS = [
  { id: 'pending', label: 'Pending', icon: Clock },
  { id: 'approved', label: 'Approved', icon: CheckCircle2 },
  { id: 'rejected', label: 'Rejected', icon: XCircle },
];

export default function RegistrationRequests() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchRequests = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    let query = supabase
      .from('profiles')
      .select('*')
      .eq('approval_status', activeTab)
      .not('stakeholder_type', 'eq', 'client')
      .order('created_at', { ascending: false });

    // Regional admins only see registrations from their region. Fail-closed —
    // a null region scopes to nothing, not the full list.
    if (user.role === ROLES.REGIONAL_ADMIN) {
      query = query.eq('region', user.region || '__no_region__');
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching registrations:', error);
    }
    setRequests(data || []);
    setLoading(false);
  }, [user?.id, user?.role, user?.region, activeTab]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAction = async (userId, action) => {
    setActionLoading(userId);
    try {
      // apiPost attaches the Supabase access token. A bare fetch sent no
      // Authorization header, and the endpoint now verifies the caller from
      // that token rather than trusting an adminId in the body.
      const result = await apiPost('/api/user', { action: 'approve-registration', userId, decision: action });
      if (result.success) {
        // Remove from current list
        setRequests(prev => prev.filter(r => r.id !== userId));
      }
    } catch (err) {
      console.error('Action error:', err);
    }
    setActionLoading(null);
  };

  const getStakeholderLabel = (type) => {
    const config = STAKEHOLDER_TYPES[type];
    // Fall back to the raw stakeholder_type for a value this build does not
    // know about (an older row, a type since removed) rather than showing a
    // blank badge.
    return config ? getStakeholderCopy(config, t).singularTitle : (type || t('common.unknown'));
  };

  const getStakeholderColor = (type) => {
    return STAKEHOLDER_TYPES[type]?.color || '#6B7280';
  };

  const filtered = requests.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.full_name || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.company_name || '').toLowerCase().includes(q) ||
      (r.stakeholder_type || '').toLowerCase().includes(q)
    );
  });

  const pendingCount = activeTab === 'pending' ? filtered.length : null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin.registrationRequests')}</h1>
          <p className="page-subtitle">{t('admin.registrationRequestsDesc')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="reg-req__tabs">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.id}
            className={`reg-req__tab ${activeTab === tab.id ? 'reg-req__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="reg-req__search">
        <Search size={18} className="reg-req__search-icon" />
        <input
          type="text"
          className="reg-req__search-input"
          placeholder={t('admin.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)', padding: 'var(--spacing-lg)' }}>{t('admin.loadingRegistrations')}</p>
      ) : filtered.length === 0 ? (
        <div className="reg-req__empty">
          <UserPlus size={48} color="var(--color-text-tertiary)" />
          <h3>{t('admin.noRegistrations', { tab: activeTab })}</h3>
          <p>
            {activeTab === 'pending'
              ? t('admin.allProcessed')
              : t('admin.noRegistrationsFound', { tab: activeTab })}
          </p>
        </div>
      ) : (
        <div className="reg-req__list">
          {filtered.map((req) => (
            <div key={req.id} className="reg-req__card">
              <div className="reg-req__card-header">
                <div className="reg-req__avatar">
                  {(req.full_name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="reg-req__info">
                  <div className="reg-req__name">{req.full_name || 'Unknown'}</div>
                  <div className="reg-req__meta">
                    <span className="reg-req__badge" style={{ background: `${getStakeholderColor(req.stakeholder_type)}18`, color: getStakeholderColor(req.stakeholder_type) }}>
                      {getStakeholderLabel(req.stakeholder_type)}
                    </span>
                    {req.role && req.role !== 'client' && (
                      <span className="reg-req__role-badge">
                        {req.role === 'auditor' ? 'Auditor' : req.role === 'certification_body' ? 'Cert Body' : req.role}
                      </span>
                    )}
                  </div>
                </div>
                {activeTab === 'pending' && (
                  <div className="reg-req__actions">
                    <Button
                      size="sm"
                      variant="primary"
                      loading={actionLoading === req.id}
                      onClick={() => handleAction(req.id, 'approved')}
                    >
                      <CheckCircle2 size={14} /> {t('common.approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={actionLoading === req.id}
                      onClick={() => handleAction(req.id, 'rejected')}
                    >
                      <XCircle size={14} /> {t('common.reject')}
                    </Button>
                  </div>
                )}
                {activeTab === 'approved' && (
                  <div className="reg-req__status-pill reg-req__status-pill--approved">
                    <CheckCircle2 size={14} /> Approved
                  </div>
                )}
                {activeTab === 'rejected' && (
                  <div className="reg-req__status-pill reg-req__status-pill--rejected">
                    <XCircle size={14} /> Rejected
                  </div>
                )}
              </div>
              <div className="reg-req__details">
                {req.email && (
                  <div className="reg-req__detail">
                    <Mail size={14} /> {req.email}
                  </div>
                )}
                {req.company_name && (
                  <div className="reg-req__detail">
                    <Building2 size={14} /> {req.company_name}
                  </div>
                )}
                {(req.city || req.country) && (
                  <div className="reg-req__detail">
                    <MapPin size={14} /> {[req.city, req.country].filter(Boolean).join(', ')}
                  </div>
                )}
                {req.region && (
                  <div className="reg-req__detail">
                    <Globe2 size={14} /> {req.region}
                  </div>
                )}
              </div>
              {req.created_at && (
                <div className="reg-req__date">
                  {t('admin.registered', { date: new Date(req.created_at).toLocaleDateString(), time: new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
