const errorMiddleware = (err, req, res, next) => {
  console.error("ERROR =>", err);

  // MongoDB Duplicate Key Error
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate resource",
      code: "DUPLICATE_RESOURCE",
    });
  }

  // Invalid MongoDB ObjectId
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid resource id",
      code: "INVALID_ID",
    });
  }

  // JWT Errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
      code: "INVALID_TOKEN",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
      code: "TOKEN_EXPIRED",
    });
  }

  const response = {
    success: false,
    message: err.message || "Internal Server Error",
    code: err.code || "INTERNAL_SERVER_ERROR",
  };

  // Show stack only in development
  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
  }

  return res.status(err.statusCode || 500).json(response);
};

export default errorMiddleware;
