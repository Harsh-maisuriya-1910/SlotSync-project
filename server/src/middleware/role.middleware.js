const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden",
        code: "ACCESS_FORBIDDEN",
      });
    }

    next();
  };
};

export default roleMiddleware;
