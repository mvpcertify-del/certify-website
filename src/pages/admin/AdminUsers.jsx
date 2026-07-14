import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Input, Select, Button } from '../../components/ui/FormElements';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { ROLES, ROLE_LABELS, getCreatableRoles, getDisplayRoleLabel } from '../../utils/roles';
import { STAKEHOLDER_TYPES } from '../../utils/stakeholderTypes';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import RowActions from '../../components/ui/RowActions';
import DetailModal from '../../components/ui/DetailModal';

// Client-role stakeholder variants an admin can pick when creating a client.
// 'client' is the default (regular company client). The rest reuse the `client`
// role but carry a distinguishing `stakeholder_type` on the profile.
const CLIENT_STAKEHOLDER_OPTIONS = Object.values(STAKEHOLDER_TYPES)
  .filter(st => st.role === 'client')
  .map(st => ({ value: st.id, label: st.singularTitle }));
import { UserPlus, AlertCircle, CheckCircle, Shield } from 'lucide-react';
import './AdminUsers.css';

export default function AdminUsers() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Optional stakeholder filter driven by the URL, e.g. the Main Dashboard
  // "Consultancies" box links here with ?stakeholder=consultancy.
  const stakeholderFilter = searchParams.get('stakeholder') || '';
  const [users, setUsers] = useState([]);
  const [fetchingUsers, setFetchingUsers] = useState(false);

  // Edit Role modal
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  // Delete User modal
  const [deletingUser, setDeletingUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // View User modal (read-only)
  const [viewingUser, setViewingUser] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Create User modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: '',
    country: '',
    stakeholder_type: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const allowedRoles = getCreatableRoles(user?.role);
  const isRegionalAdmin = user?.role === ROLES.REGIONAL_ADMIN;
  // Activate/Deactivate + Delete are Super-Admin-only (server enforces this too).
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;

  useEffect(() => {
    fetchUsers();
  }, [user]);

  const fetchUsers = async () => {
    setFetchingUsers(true);
    let query = supabase.from('profiles').select('*');
    // Regional Admin: only see users in their region. Fail-closed — a regional
    // admin with no resolved region sees nothing, never the full list.
    if (isRegionalAdmin) {
      query = query.eq('region', user?.region || '__no_region__');
    }
    const { data } = await query.order('created_at', { ascending: false });
    if (data) setUsers(data);
    setFetchingUsers(false);
  };

  // --- Create User ---
  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    setCreateForm(prev => {
      const next = { ...prev, [name]: value };
      // Clear stakeholder variant when switching away from client role.
      if (name === 'role' && value !== ROLES.CLIENT) next.stakeholder_type = '';
      return next;
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const { full_name, email, password, role, stakeholder_type, country } = createForm;

    if (!full_name || !email || !password || !role) {
      setError(t('admin.fillRequired'));
      return;
    }

    if (password.length < 6) {
      setError(t('admin.passwordMinLength'));
      return;
    }

    if (!allowedRoles.includes(role)) {
      setError(t('admin.noPermissionCreate'));
      return;
    }

    // Only send stakeholder_type for client role. Default to 'client' if
    // admin didn't pick a variant.
    const resolvedStakeholderType = role === ROLES.CLIENT
      ? (stakeholder_type || 'client')
      : undefined;

    setLoading(true);

    try {
      await apiPost('/api/create-user', {
        email,
        password,
        full_name,
        role,
        country,
        // A regional admin can only create users inside their own region, so we
        // force it here regardless of the country typed (the server prefers an
        // explicit region over the country-derived one).
        ...(isRegionalAdmin && user?.region ? { region: user.region } : {}),
        ...(resolvedStakeholderType ? { stakeholder_type: resolvedStakeholderType } : {}),
      });

      setSuccess(`${t('admin.successCreated')} ${ROLE_LABELS[role]}: ${full_name}`);
      setShowCreateModal(false);
      setCreateForm({ full_name: '', email: '', password: '', role: '', country: '', stakeholder_type: '' });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  // --- Edit Role ---
  const handleUpdateRole = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!allowedRoles.includes(newRole)) {
      setError(t('admin.noPermissionAssign'));
      return;
    }

    setLoading(true);

    try {
      await apiPost('/api/user', { action: 'update-role', userId: editingUser.id, newRole });

      setSuccess(t('admin.roleUpdated', { name: editingUser.full_name || editingUser.email, role: ROLE_LABELS[newRole] }));
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, role: newRole } : u));
      setShowEditModal(false);
    } catch (err) {
      setError(err.message || t('admin.errorOccurred'));
    }
    setLoading(false);
  };

  // --- Delete User ---
  const handleDeleteUser = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await apiPost('/api/delete-user', { userId: deletingUser.id });

      setSuccess(`${t('admin.successDeleted')} ${deletingUser.full_name || deletingUser.email}`);
      setUsers(prev => prev.filter(u => u.id !== deletingUser.id));
      setShowDeleteModal(false);
      setDeletingUser(null);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  // --- Activate / Deactivate User ---
  const handleToggleActive = async (userRow) => {
    setError('');
    setSuccess('');
    const next = !(userRow.is_active !== false); // treat null/undefined as active
    try {
      await apiPost('/api/user', { action: 'set-active', userId: userRow.id, isActive: next });
      setUsers(prev => prev.map(u => u.id === userRow.id ? { ...u, is_active: next } : u));
      setSuccess(
        `${next ? t('common.activate') : t('common.deactivate')}: ${userRow.full_name || userRow.email}`
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const columns = [
    { key: 'full_name', label: t('admin.name'), render: (val) => val || '—' },
    { key: 'email', label: t('auth.email') },
    { key: 'role', label: t('admin.systemRole'), render: (val, row) => {
      // For partner stakeholder types (referral/investor/consultancy), show the
      // stakeholder label instead of the generic "Client" role so admins can
      // distinguish them.
      const label = getDisplayRoleLabel(val, row?.stakeholder_type);
      return <StatusBadge status={val} label={label} />;
    }},
    { key: 'country', label: t('admin.country'), render: (val) => val || '—' },
    { key: 'created_at', label: t('admin.joined'), render: (val) => val ? new Date(val).toLocaleDateString() : '—' },
    {
      key: 'is_active', label: t('dashboard.status'), render: (val) => (
        <StatusBadge
          status={val === false ? 'inactive' : 'active'}
          label={val === false ? t('common.inactive') : t('common.active')}
        />
      )
    },
    {
      key: 'actions', label: t('dashboard.action'), render: (_, userRow) => {
        const openEditRole = () => {
          setEditingUser(userRow);
          setNewRole(userRow.role);
          setError('');
          setShowEditModal(true);
        };
        const openView = () => {
          setViewingUser(userRow);
          setShowViewModal(true);
        };
        // Super Admin gets the full action cluster: [View] [Deactivate] [Edit] [Delete]
        // (Edit opens the role editor). Destructive actions are server-enforced
        // and never offered on your own account.
        if (isSuperAdmin) {
          return (
            <RowActions
              isActive={userRow.is_active !== false}
              showView
              onView={openView}
              showToggle={userRow.id !== user?.id}
              showDelete={userRow.id !== user?.id}
              onToggle={() => handleToggleActive(userRow)}
              onEdit={openEditRole}
              onDelete={() => {
                setDeletingUser(userRow);
                setError('');
                setShowDeleteModal(true);
              }}
            />
          );
        }
        // Other admins (e.g. regional) keep View + their existing Edit-Role action.
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <RowActions showView onView={openView} showToggle={false} showEdit={false} showDelete={false} />
            <Button size="sm" variant="ghost" onClick={openEditRole}>
              {t('admin.editRole')}
            </Button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin.userManagement')}</h1>
          <p className="page-subtitle">{t('admin.userManagementDesc')}</p>
        </div>
        <Button variant="primary" size="md" onClick={() => {
          setError('');
          setCreateForm({ full_name: '', email: '', password: '', role: '', country: '', stakeholder_type: '' });
          setShowCreateModal(true);
        }}>
          <UserPlus size={18} /> {t('admin.createUser')}
        </Button>
      </div>

      {/* Role Info Banner */}
      <div className="admin-users__info">
        <Shield size={18} />
        <span>
          {t('admin.youCanCreate')} {allowedRoles.map(r => ROLE_LABELS[r]).join(', ')}
        </span>
      </div>

      {success && (
        <div className="admin-users__success">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Active URL filter chip (e.g. arriving from the Consultancies box) */}
      {stakeholderFilter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--spacing-md)' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 10px', borderRadius: 999,
            background: 'rgba(62,207,142,0.12)', color: 'var(--color-accent, #3ECF8E)',
            fontSize: '0.8rem', fontWeight: 600,
          }}>
            {t('admin.filteredBy')}: {getDisplayRoleLabel(ROLES.CLIENT, stakeholderFilter)}
            <button
              type="button"
              onClick={() => setSearchParams({})}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700, lineHeight: 1 }}
              aria-label={t('common.clear') || 'Clear'}
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Users Table */}
      {fetchingUsers ? (
        <p>{t('admin.loadingUsers')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={stakeholderFilter ? users.filter(u => u.stakeholder_type === stakeholderFilter) : users}
          emptyMessage={t('admin.noUsersFound')}
        />
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('admin.createNewUser')}
      >
        <form onSubmit={handleCreateUser} className="admin-users__form">
          {error && (
            <div className="auth-form__error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <Input
            label={t('admin.fullName')}
            id="create-user-name"
            name="full_name"
            placeholder={t('admin.fullNamePlaceholder')}
            value={createForm.full_name}
            onChange={handleCreateChange}
            required
          />

          <Input
            label={t('auth.emailRequired')}
            type="email"
            id="create-user-email"
            name="email"
            placeholder={t('admin.emailPlaceholder')}
            value={createForm.email}
            onChange={handleCreateChange}
            required
          />

          <Input
            label={t('auth.passwordRequired')}
            type="password"
            id="create-user-password"
            name="password"
            placeholder={t('admin.passwordPlaceholder')}
            value={createForm.password}
            onChange={handleCreateChange}
            required
          />

          <Select
            label={t('admin.roleRequired')}
            id="create-user-role"
            name="role"
            value={createForm.role}
            onChange={handleCreateChange}
            required
          >
            <option value="">{t('admin.selectRole')}</option>
            {allowedRoles.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </Select>

          {createForm.role === ROLES.CLIENT && (
            <Select
              label={t('admin.stakeholderTypeOptional')}
              id="create-user-stakeholder-type"
              name="stakeholder_type"
              value={createForm.stakeholder_type}
              onChange={handleCreateChange}
            >
              <option value="">{t('admin.selectStakeholderType')}</option>
              {CLIENT_STAKEHOLDER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          )}

          {/* Country replaces Region in the UI; the user's region is derived
              from it server-side. Regional admins create only within their own
              region (forced on submit), so this is display/record only. */}
          <Input
            label={isRegionalAdmin ? t('admin.country') : t('admin.countryOptional')}
            id="create-user-country"
            name="country"
            placeholder={t('admin.countryPlaceholder')}
            value={createForm.country}
            onChange={handleCreateChange}
          />

          <div className="admin-users__form-actions">
            <Button type="button" variant="ghost" size="md" onClick={() => setShowCreateModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" size="md" loading={loading}>
              {t('admin.createUser')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete User Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('admin.deleteUser')}
      >
        <div className="admin-users__form">
          {error && (
            <div className="auth-form__error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <p style={{ color: 'var(--color-text-secondary)' }}>
            {t('admin.deleteUserConfirm')} <strong>{deletingUser?.full_name || deletingUser?.email}</strong>?
          </p>
          <p style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.85rem', marginTop: '8px' }}>
            {t('admin.deleteUserWarning')}
          </p>

          <div className="admin-users__form-actions" style={{ marginTop: '16px' }}>
            <Button type="button" variant="ghost" size="md" onClick={() => setShowDeleteModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={loading}
              onClick={handleDeleteUser}
              style={{ background: 'var(--color-danger, #ef4444)' }}
            >
              {t('admin.deleteUser')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('admin.editUserRole')}
      >
        <form onSubmit={handleUpdateRole} className="admin-users__form">
          {error && (
            <div className="auth-form__error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <p style={{ marginBottom: '16px', color: 'var(--color-text-secondary)' }}>
            {t('admin.updatingRole')} <strong>{editingUser?.full_name || editingUser?.email}</strong> ({editingUser?.email})
          </p>

          <Select
            label={t('admin.newRole')}
            id="update-user-role"
            name="role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            required
          >
            <option value="">{t('admin.selectRole')}</option>
            {allowedRoles.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </Select>

          <div className="admin-users__form-actions">
            <Button type="button" variant="ghost" size="md" onClick={() => setShowEditModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" size="md" loading={loading}>
              {t('admin.updateRole')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View User Modal (read-only) */}
      <DetailModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={viewingUser ? (viewingUser.full_name || viewingUser.email) : t('common.view')}
        columns={columns}
        row={viewingUser}
      />
    </div>
  );
}
