const Notification = require('../models/Notification');
const School = require('../models/School');

/**
 * Get notifications for a user (paginated)
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const userId = req.query.userId || req.user?._id;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const filter = { user: userId };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === 'true';

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('school', 'name')
        .populate('user', 'name email'),
      Notification.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: notifications.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: notifications
    });
  } catch (err) { next(err); }
};

/**
 * Get unread notification count
 */
exports.getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.query.userId || req.user?._id;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const count = await Notification.countDocuments({ user: userId, isRead: false });
    res.json({ success: true, data: { unreadCount: count } });
  } catch (err) { next(err); }
};

/**
 * Mark a single notification as read
 */
exports.markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, error: 'Notification not found' });
    res.json({ success: true, data: notification });
  } catch (err) { next(err); }
};

/**
 * Mark all notifications as read for a user
 */
exports.markAllRead = async (req, res, next) => {
  try {
    const userId = req.body.userId || req.user?._id;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.json({ success: true, data: { modifiedCount: result.modifiedCount } });
  } catch (err) { next(err); }
};

/**
 * Delete a notification
 */
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) return res.status(404).json({ success: false, error: 'Notification not found' });
    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};

/**
 * Internal helper — create a notification (not route-bound)
 * Usage: const { createNotification } = require('./notificationController');
 *        await createNotification({ school, user, type, title, message, severity });
 */
exports.createNotification = async (data) => {
  try {
    const notification = await Notification.create({
      school: data.school,
      session: data.session,
      user: data.user,
      type: data.type,
      title: data.title,
      message: data.message || '',
      severity: data.severity || 'info',
      relatedEntity: data.relatedEntity,
      actionUrl: data.actionUrl,
      expiresAt: data.expiresAt
    });
    return notification;
  } catch (err) {
    console.error('Failed to create notification:', err.message);
    return null;
  }
};
