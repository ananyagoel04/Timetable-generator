const validate = (requiredFields) => {
  return (req, res, next) => {
    const missing = requiredFields.filter(f => !req.body[f] && req.body[f] !== 0);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }
    next();
  };
};

module.exports = validate;
