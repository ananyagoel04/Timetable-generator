const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { getNotifications, getUnreadCount, markRead, markAllRead, deleteNotification } = require('../controllers/notificationController');

router.get('/', getNotifications); // Any authenticated user can see own notifications
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);
router.delete('/:id', deleteNotification);

module.exports = router;
