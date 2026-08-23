import helmet from "helmet";
import cors from "cors";

// Security headers (XSS filtering, content-type sniffing protection, frameguard,
// HSTS in production, etc.)
const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // API server; CSP is owned by the SPA host
  crossOriginResourcePolicy: { policy: "same-site" },
});

const parseAllowedOrigins = () => {
  const configured = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Local development defaults are always permitted so the Vite dev server
  // works out of the box; production deployments override CLIENT_URL.
  const defaults = ["http://localhost:5173", "http://localhost:3000"];

  return [...new Set([...configured, ...defaults])];
};

// Strict CORS: only explicitly allowlisted origins may call the API.
// Disallowed origins receive no Access-Control-* headers, which browsers
// treat as a hard block. Non-browser clients without an Origin header are
// unaffected.
const strictCorsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const allowed = parseAllowedOrigins();

    if (allowed.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  methods: ["GET", "POST", "PATCH", "PUT", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  credentials: true,
  maxAge: 86400,
});

export { helmetMiddleware, strictCorsMiddleware };
