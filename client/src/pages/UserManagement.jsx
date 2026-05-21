import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Trash2, Shield, Mail, Key, User, Loader2, ToggleLeft, ToggleRight, Edit, Lock, RefreshCw, ChevronDown, Terminal, Activity } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

const ROLE_COLORS = {
  platform_admin: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30',
  platform_dev: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/30',
  school_owner: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-500/30',
  school_admin: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30',
  teacher: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30'
};

const ROLES = ['school_admin', 'school_owner', 'teacher', 'platform_admin', 'platform_dev'];

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'school_admin' });
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editData, setEditData] = useState({ name: '', email: '', role: '' });

  // Password reset modal
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data?.data || res.data || []);
    } catch (err) { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/users', formData);
      toast.success('User created');
      setShowCreate(false);
      setFormData({ name: '', email: '', password: '', role: 'school_admin' });
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  const handleEdit = async () => {
    try {
      await api.put(`/users/${editUser._id}`, editData);
      toast.success('User updated');
      setShowEdit(false);
      fetchUsers();
    } catch (err) { toast.error('Failed to update'); }
  };

  const handleToggle = async (id) => {
    try {
      await api.put(`/users/${id}/toggle-active`);
      toast.success('Status updated');
      fetchUsers();
    } catch (err) { toast.error('Failed'); }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Min 6 characters'); return; }
    try {
      await api.put(`/users/${resetUserId}/reset-password`, { newPassword });
      toast.success('Password reset');
      setShowResetPw(false);
      setNewPassword('');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) { toast.error('Failed'); }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditData({ name: u.name, email: u.email, role: u.role });
    setShowEdit(true);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [users, search, roleFilter]);

  const isPlatformUser = currentUser?.role === 'platform_admin' || currentUser?.role === 'platform_dev';

  if (loading) return (
    <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{users.length} total users · Manage accounts and permissions</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Add User
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." className="input-field pl-9 text-sm" />
        </div>
        <div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="select-field text-sm min-w-[150px]">
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <button onClick={fetchUsers} className="btn-secondary p-2.5"><RefreshCw size={16} /></button>
      </div>

      {/* User Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="p-3 text-left text-xs">User</th>
                <th className="p-3 text-left text-xs">Email</th>
                <th className="p-3 text-left text-xs">Role</th>
                <th className="p-3 text-center text-xs">Status</th>
                <th className="p-3 text-left text-xs hidden sm:table-cell">Joined</th>
                <th className="p-3 text-right text-xs w-36">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u._id} className="table-row group">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {u.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span className="font-medium text-slate-800 dark:text-dark-100 text-sm">{u.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-slate-600 dark:text-dark-300">{u.email}</td>
                  <td className="p-3">
                    <span className={`badge border text-[10px] ${ROLE_COLORS[u.role] || ROLE_COLORS.teacher}`}>
                      {u.role?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => handleToggle(u._id)} title={u.isActive !== false ? 'Active — Click to deactivate' : 'Inactive — Click to activate'}>
                      {u.isActive !== false
                        ? <ToggleRight size={22} className="text-emerald-500 hover:text-emerald-600 transition-colors" />
                        : <ToggleLeft size={22} className="text-slate-300 dark:text-dark-600 hover:text-slate-500 transition-colors" />}
                    </button>
                  </td>
                  <td className="p-3 text-xs text-slate-500 dark:text-dark-400 hidden sm:table-cell">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors" title="Edit">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => { setResetUserId(u._id); setShowResetPw(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors" title="Reset Password">
                        <Key size={14} />
                      </button>
                      <button onClick={() => handleDelete(u._id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={6} className="p-12 text-center text-slate-400 dark:text-dark-500">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Platform Dev Tools - ONLY visible to platform_admin and platform_dev */}
      {isPlatformUser && (
        <div className="glass-card p-5 border-l-4 border-l-orange-500">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-dark-100 flex items-center gap-2 mb-3">
            <Terminal size={16} className="text-orange-500" /> Development & Operations
          </h3>
          <p className="text-xs text-slate-500 dark:text-dark-400 mb-3">Platform-level tools — hidden from school users</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a href="/audit-logs" className="p-3 rounded-xl bg-slate-50 dark:bg-dark-800/50 border border-slate-200 dark:border-dark-700 hover:border-primary-500/30 transition-colors text-center">
              <Shield size={18} className="text-blue-500 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-700 dark:text-dark-200">Audit Logs</p>
              <p className="text-[10px] text-slate-400">Full system audit trail</p>
            </a>
            <a href="/diagnostics" className="p-3 rounded-xl bg-slate-50 dark:bg-dark-800/50 border border-slate-200 dark:border-dark-700 hover:border-primary-500/30 transition-colors text-center">
              <Activity size={18} className="text-emerald-500 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-700 dark:text-dark-200">Diagnostics</p>
              <p className="text-[10px] text-slate-400">System health & scheduler</p>
            </a>
            <a href="/reports" className="p-3 rounded-xl bg-slate-50 dark:bg-dark-800/50 border border-slate-200 dark:border-dark-700 hover:border-primary-500/30 transition-colors text-center">
              <RefreshCw size={18} className="text-purple-500 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-700 dark:text-dark-200">API & Reports</p>
              <p className="text-[10px] text-slate-400">Export & monitoring</p>
            </a>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add New User">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Name</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input-field" placeholder="Full name" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Email</label>
              <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="input-field" placeholder="user@school.edu" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Password</label>
              <input type="password" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="input-field" placeholder="Min 6 characters" minLength={6} />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Role</label>
              <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="select-field">
                {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary text-sm flex items-center gap-2">
                {creating ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEdit && editUser && (
        <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Edit: ${editUser.name}`}>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Name</label>
              <input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Email</label>
              <input value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Role</label>
              <select value={editData.role} onChange={e => setEditData({ ...editData, role: e.target.value })} className="select-field">
                {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowEdit(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleEdit} className="btn-primary text-sm">Save Changes</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Password Reset Modal */}
      {showResetPw && (
        <Modal isOpen={showResetPw} onClose={() => { setShowResetPw(false); setNewPassword(''); }} title="Reset Password">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-field" placeholder="Min 6 characters" minLength={6} />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowResetPw(false); setNewPassword(''); }} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleResetPassword} className="btn-primary text-sm flex items-center gap-2">
                <Key size={14} /> Reset Password
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
