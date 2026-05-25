const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { validateCreateUser, validateParamId } = require('../middleware/validators');
const { getUsers, createUser, updateUser, toggleUserActive, resetPassword } = require('../controllers/userController');

router.get('/', authorize('manage_users'), getUsers);
router.post('/', authorize('manage_users'), validateCreateUser, createUser);
router.put('/:id', authorize('manage_users'), ...validateParamId, updateUser);
router.put('/:id/toggle-active', authorize('manage_users'), ...validateParamId, toggleUserActive);
router.put('/:id/reset-password', authorize('manage_users'), ...validateParamId, resetPassword);

module.exports = router;
