const Role = require('../models/Role');
const Permission = require('../models/Permission');

// ─── System role/permission seed data ────────────────────────────
const SYSTEM_PERMISSIONS = [
  { code: 'view_timetable', displayName: 'View Timetable', category: 'timetable' },
  { code: 'generate_timetable', displayName: 'Generate Timetable', category: 'timetable' },
  { code: 'edit_timetable', displayName: 'Edit Timetable', category: 'timetable' },
  { code: 'publish_timetable', displayName: 'Publish Timetable', category: 'timetable' },
  { code: 'edit_setup', displayName: 'Edit Setup', category: 'setup' },
  { code: 'manage_teachers', displayName: 'Manage Teachers', category: 'staff' },
  { code: 'manage_rules', displayName: 'Manage Rules', category: 'setup' },
  { code: 'approve_substitutions', displayName: 'Approve Substitutions', category: 'operations' },
  { code: 'manage_absences', displayName: 'Manage Absences', category: 'operations' },
  { code: 'manage_replacements', displayName: 'Manage Replacements', category: 'operations' },
  { code: 'view_audit', displayName: 'View Audit Logs', category: 'system' },
  { code: 'manage_users', displayName: 'Manage Users', category: 'system' },
  { code: 'manage_school', displayName: 'Manage School', category: 'system' },
  { code: 'export_reports', displayName: 'Export Reports', category: 'reports' },
  { code: 'view_analytics', displayName: 'View Analytics', category: 'reports' },
  { code: 'manage_roles', displayName: 'Manage Roles', category: 'system' },
  { code: 'manage_snapshots', displayName: 'Manage Snapshots', category: 'timetable' }
];

const SYSTEM_ROLES = [
  { name: 'platform_owner', displayName: 'Platform Owner', category: 'platform', priority: 100,
    permissions: SYSTEM_PERMISSIONS.map(p => p.code) },
  { name: 'platform_support', displayName: 'Platform Support', category: 'platform', priority: 90,
    permissions: ['view_timetable', 'view_audit', 'view_analytics', 'export_reports'] },
  { name: 'platform_developer', displayName: 'Platform Developer', category: 'platform', priority: 90,
    permissions: SYSTEM_PERMISSIONS.map(p => p.code) },
  { name: 'school_owner', displayName: 'School Owner', category: 'school_admin', priority: 80,
    permissions: SYSTEM_PERMISSIONS.map(p => p.code) },
  { name: 'school_admin', displayName: 'School Admin', category: 'school_admin', priority: 70,
    permissions: ['view_timetable', 'generate_timetable', 'edit_timetable', 'publish_timetable', 'edit_setup',
      'manage_teachers', 'manage_rules', 'approve_substitutions', 'manage_absences', 'manage_replacements',
      'view_audit', 'manage_users', 'manage_school', 'export_reports', 'view_analytics', 'manage_roles', 'manage_snapshots'] },
  { name: 'principal', displayName: 'Principal', category: 'school_admin', priority: 60,
    permissions: ['view_timetable', 'approve_substitutions', 'manage_absences', 'view_audit', 'export_reports', 'view_analytics'] },
  { name: 'timetable_manager', displayName: 'Timetable Manager', category: 'school_staff', priority: 50,
    permissions: ['view_timetable', 'generate_timetable', 'edit_timetable', 'publish_timetable', 'edit_setup',
      'manage_teachers', 'manage_rules', 'export_reports', 'view_analytics', 'manage_snapshots'] },
  { name: 'teacher', displayName: 'Teacher', category: 'school_staff', priority: 20,
    permissions: ['view_timetable'] },
  { name: 'office_staff', displayName: 'Office Staff', category: 'school_staff', priority: 30,
    permissions: ['view_timetable', 'manage_absences', 'export_reports'] },
  { name: 'viewer', displayName: 'Viewer', category: 'viewer', priority: 10,
    permissions: ['view_timetable'] }
];

/**
 * Seed system roles and permissions (idempotent)
 */
exports.seedSystemData = async () => {
  try {
    // Seed permissions
    for (const p of SYSTEM_PERMISSIONS) {
      await Permission.findOneAndUpdate(
        { code: p.code },
        { ...p, isActive: true },
        { upsert: true, new: true }
      );
    }

    // Seed system roles
    for (const r of SYSTEM_ROLES) {
      await Role.findOneAndUpdate(
        { name: r.name, school: null },
        { ...r, isSystem: true, isActive: true },
        { upsert: true, new: true }
      );
    }
    console.log('✅ System roles & permissions seeded');
  } catch (err) {
    console.warn('⚠️  Role seed warning:', err.message);
  }
};

/**
 * GET /api/roles
 */
exports.listRoles = async (req, res, next) => {
  try {
    const roles = await Role.find({
      $or: [
        { school: null, isSystem: true },
        { school: req.schoolId }
      ],
      isActive: true
    }).sort({ priority: -1 });

    res.json({ success: true, data: roles });
  } catch (err) { next(err); }
};

/**
 * GET /api/roles/permissions
 */
exports.listPermissions = async (req, res, next) => {
  try {
    const permissions = await Permission.find({ isActive: true }).sort({ category: 1, code: 1 });
    res.json({ success: true, data: permissions });
  } catch (err) { next(err); }
};

/**
 * POST /api/roles
 */
exports.createRole = async (req, res, next) => {
  try {
    const { displayName, description, permissions } = req.body;
    const name = req.body.name || displayName?.toLowerCase().replace(/\s+/g, '_');
    if (!displayName) {
      return res.status(400).json({ success: false, error: 'displayName required' });
    }

    const role = await Role.create({
      name: name.toLowerCase().replace(/\s+/g, '_'),
      displayName,
      description,
      permissions: permissions || [],
      school: req.schoolId,
      isSystem: false,
      category: 'custom'
    });

    res.status(201).json({ success: true, data: role });
  } catch (err) { next(err); }
};

/**
 * PUT /api/roles/:id
 */
exports.updateRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, error: 'Role not found' });
    if (role.isSystem) return res.status(403).json({ success: false, error: 'Cannot modify system roles' });

    const { displayName, description, permissions } = req.body;
    if (displayName) role.displayName = displayName;
    if (description !== undefined) role.description = description;
    if (permissions) role.permissions = permissions;
    await role.save();

    res.json({ success: true, data: role });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/roles/:id
 */
exports.deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, error: 'Role not found' });
    if (role.isSystem) return res.status(403).json({ success: false, error: 'Cannot delete system roles' });

    role.isActive = false;
    await role.save();
    res.json({ success: true, message: 'Role deactivated' });
  } catch (err) { next(err); }
};
