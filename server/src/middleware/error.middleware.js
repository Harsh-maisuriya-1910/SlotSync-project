// Centralized error mapping.
//
// Every error leaving the API passes through this middleware and is rendered
// into one consistent envelope:
//
//   { success: false, message: <human readable>, code: <machine readable> }
//
// Canonical status/code classes (kept consistent across the entire API):
//   401 -> UNAUTHENTICATED / INVALID_TOKEN / TOKEN_EXPIRED
//   403 -> ACCESS_FORBIDDEN
//   409 -> conflicts (duplicate resource, slot full, stale write, ...)
//   422 -> semantic rule violations (validation, invalid transitions, closed windows)

const ERROR_CODES = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  ACCESS_FORBIDDEN: "ACCESS_FORBIDDEN",
  VALIDATION_ERROR: "VALIDATION_ERROR",
};

const sendError = (res, statusCode, message, code) => {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
  });
};

const mapFrameworkError = (err) => {
  // MongoDB duplicate key
  if (err.code === 11000) {
    return { statusCode: 409, message: "Duplicate resource", code: "DUPLICATE_RESOURCE" };
  }

  // Invalid MongoDB ObjectId
  if (err.name === "CastError") {
    return { statusCode: 400, message: "Invalid resource id", code: "INVALID_ID" };
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return { statusCode: 401, message: "Invalid token", code: ERROR_CODES.INVALID_TOKEN };
  }

  if (err.name === "TokenExpiredError") {
    return { statusCode: 401, message: "Token expired", code: ERROR_CODES.TOKEN_EXPIRED };
  }

  // Body-parser: payload exceeds configured JSON body limit
  if (
    err.type === "entity.too.large" ||
    err.statusCode === 413 ||
    err.status === 413
  ) {
    return {
      statusCode: 413,
      message: "Request body too large",
      code: "REQUEST_ENTITY_TOO_LARGE",
    };
  }

  // Body-parser: malformed JSON or wrong content type
  if (
    err.type === "entity.parse.failed" ||
    err instanceof SyntaxError
  ) {
    if (err.status === 400 || err.statusCode === 400 || err.type === "entity.parse.failed") {
      return {
        statusCode: 400,
        message: "Malformed request body",
        code: "INVALID_JSON_BODY",
      };
    }
  }

  return null;
};

const errorMiddleware = (err, req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.error("ERROR =>", err);
  }

  const mapped = mapFrameworkError(err);
  if (mapped) {
    return sendError(res, mapped.statusCode, mapped.message, mapped.code);
  }

  // ApiError instances carry their own canonical status + code
  const response = {
    success: false,
    message: err.message || "Internal Server Error",
    code: err.code || "INTERNAL_SERVER_ERROR",
  };

  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
  }

  return res.status(err.statusCode || 500).json(response);
};

export default errorMiddleware;
