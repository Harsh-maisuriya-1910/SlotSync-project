class ApiError extends Error {
  constructor(statusCode, message, code = null) {
    super(message);

    Error.captureStackTrace(this, this.constructor);

    this.success = false;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export default ApiError;
