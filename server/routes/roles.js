const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/roleController');

router.get('/', ctrl.listRoles);
router.get('/permissions', ctrl.listPermissions);
router.post('/', authorize('manage_roles', 'manage_users'), ctrl.createRole);
router.put('/:id', authorize('manage_roles', 'manage_users'), ctrl.updateRole);
router.delete('/:id', authorize('manage_roles', 'manage_users'), ctrl.deleteRole);

module.exports = router;
