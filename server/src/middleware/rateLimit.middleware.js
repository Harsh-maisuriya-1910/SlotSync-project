import rateLimit from "express-rate-limit";

// Login rate limiting: brute-force protection on POST /api/auth/login.
// Limits are configurable via environment for different deployment profiles.
//
// Test-mode behavior: Jest runs with NODE_ENV=test; the limiter is disabled by
// default there so existing suites are never throttled. A suite that needs to
// verify rate limiting sets ENABLE_RATE_LIMIT_IN_TESTS=true before importing
// the app, which re-enables it for that module registry only.

const isTestRun = () => process.env.NODE_ENV === "test";

const loginRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // Preflight requests must not burn the credential-attempt budget
    if (req.method === "OPTIONS") {
      return true;
    }

    return isTestRun() && process.env.ENABLE_RATE_LIMIT_IN_TESTS !== "true";
  },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: "Too many login attempts. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    });
  },
});

export default loginRateLimiter;
