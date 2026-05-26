import { useState, useEffect } from 'react';
import { Shield, Plus, Edit3, Trash2, Check, X, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const PERM_CATEGORIES = {
  timetable: { label: 'Timetable', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' },
  setup: { label: 'Setup', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400' },
  staff: { label: 'Staff', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  operations: { label: 'Operations', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  reports: { label: 'Reports', color: 'bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400' },
  system: { label: 'System', color: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
  platform: { label: 'Platform', color: 'bg-slate-100 text-slate-700 dark:bg-dark-700 dark:text-dark-300' }
};

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // role being edited
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedRole, setExpandedRole] = useState(null);
  const [form, setForm] = useState({ name: '', displayName: '', description: '', permissions: [] });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get('/roles'),
        api.get('/roles/permissions')
      ]);
      setRoles(rolesRes.data?.data || []);
      setPermissions(permsRes.data?.data || []);
    } catch (err) {
      toast.error('Failed to load roles');
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.displayName.trim()) return toast.error('Display name required');
    try {
      await api.post('/roles', {
        name: form.displayName.toLowerCase().replace(/\s+/g, '_'),
        displayName: form.displayName,
        description: form.description,
        permissions: form.permissions
      });
      toast.success('Role created');
      setShowCreate(false);
      setForm({ name: '', displayName: '', description: '', permissions: [] });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    try {
      await api.put(`/roles/${editing._id}`, {
        displayName: form.displayName,
        description: form.description,
        permissions: form.permissions
      });
      toast.success('Role updated');
      setEditing(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/roles/${deleteTarget._id}`);
      toast.success('Role deactivated');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const startEdit = (role) => {
    setEditing(role);
    setForm({ displayName: role.displayName, description: role.description || '', permissions: [...role.permissions] });
    setShowCreate(false);
  };

  const togglePerm = (code) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(code)
        ? prev.permissions.filter(p => p !== code)
        : [...prev.permissions, code]
    }));
  };

  const permsByCategory = permissions.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-slate-100 dark:bg-dark-800 rounded-lg animate-pulse w-48" />
        {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-dark-800 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-dark-50">Roles & Permissions</h1>
            <p className="text-sm text-slate-500 dark:text-dark-400">{roles.length} roles configured</p>
          </div>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditing(null); setForm({ name: '', displayName: '', description: '', permissions: [] }); }}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Custom Role
        </button>
      </div>

      {/* Create/Edit Form */}
      {(showCreate || editing) && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 p-6 shadow-lg">
          <h3 className="font-semibold text-slate-700 dark:text-dark-200 mb-4">
            {editing ? `Edit: ${editing.displayName}` : 'Create Custom Role'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-dark-400 mb-1">Display Name</label>
              <input
                type="text" value={form.displayName}
                onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                className="input w-full" placeholder="e.g. Vice Principal"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-dark-400 mb-1">Description</label>
              <input
                type="text" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="input w-full" placeholder="Optional description"
              />
            </div>
          </div>

          {/* Permission Matrix */}
          <h4 className="text-sm font-semibold text-slate-600 dark:text-dark-300 mb-3">Permissions</h4>
          <div className="space-y-4 mb-6">
            {Object.entries(permsByCategory).map(([cat, perms]) => (
              <div key={cat}>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PERM_CATEGORIES[cat]?.color || 'bg-slate-100 text-slate-600'}`}>
                  {PERM_CATEGORIES[cat]?.label || cat}
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {perms.map(p => (
                    <label key={p.code} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all border
                      ${form.permissions.includes(p.code)
                        ? 'bg-primary-50 dark:bg-primary-950/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400'
                        : 'bg-white dark:bg-dark-800 border-slate-200 dark:border-dark-700 text-slate-500 dark:text-dark-400 hover:border-slate-300'}`}
                    >
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(p.code)}
                        onChange={() => togglePerm(p.code)}
                        className="sr-only"
                      />
                      {form.permissions.includes(p.code) ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded border border-slate-300 dark:border-dark-600" />}
                      {p.displayName}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={editing ? handleUpdate : handleCreate} className="btn-primary text-sm">
              {editing ? 'Save Changes' : 'Create Role'}
            </button>
            <button onClick={() => { setEditing(null); setShowCreate(false); }} className="btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Role List */}
      <div className="space-y-3">
        {roles.map(role => (
          <div key={role._id} className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 overflow-hidden transition-shadow hover:shadow-md">
            <div
              className="flex items-center justify-between p-4 cursor-pointer"
              onClick={() => setExpandedRole(expandedRole === role._id ? null : role._id)}
            >
              <div className="flex items-center gap-3">
                {role.isSystem ? <Lock className="w-4 h-4 text-slate-400" /> : <Shield className="w-4 h-4 text-primary-500" />}
                <div>
                  <span className="font-semibold text-sm text-slate-700 dark:text-dark-200">{role.displayName}</span>
                  {role.description && <p className="text-xs text-slate-400 dark:text-dark-500">{role.description}</p>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ml-2
                  ${role.isSystem ? 'bg-slate-100 text-slate-500 dark:bg-dark-700 dark:text-dark-400' :
                    'bg-primary-100 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400'}`}>
                  {role.isSystem ? 'System' : 'Custom'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 dark:text-dark-500">{role.permissions?.length || 0} perms</span>
                {!role.isSystem && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); startEdit(role); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-dark-700 rounded-lg">
                      <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(role); }} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </>
                )}
                {expandedRole === role._id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </div>
            </div>
            {expandedRole === role._id && (
              <div className="px-4 pb-4 border-t border-slate-100 dark:border-dark-700 pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions?.map(p => (
                    <span key={p} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-700 text-slate-600 dark:text-dark-300">
                      {p.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {(!role.permissions || role.permissions.length === 0) && (
                    <span className="text-xs text-slate-400">No permissions assigned</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Role"
          message={`Are you sure you want to deactivate "${deleteTarget.displayName}"?`}
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
