import express from "express";
import cookieParser from "cookie-parser";

import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import slotRoutes from "./modules/slots/slot.routes.js";
import bookingRoutes from "./modules/bookings/booking.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import counsellorRoutes from "./modules/counsellor/counsellor.routes.js";
import waitlistRoutes from "./modules/waitlist/waitlist.routes.js";
import auditRoutes from "./modules/audit/audit.routes.js";

import { helmetMiddleware, strictCorsMiddleware } from "./middleware/security.middleware.js";
import loginRateLimiter from "./middleware/rateLimit.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";

// App Initialization
const app = express();

// Trust proxy so express-rate-limit sees real client IPs behind reverses proxies
app.set("trust proxy", 1);

// Security headers
app.use(helmetMiddleware);

// Strict origin allowlist CORS
app.use(strictCorsMiddleware);

// Request body size limits
app.use(express.json({ limit: "10kb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "10kb",
  }),
);

app.use(cookieParser());

// Routes
app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "SlotSync API Running",
  });
});

// Brute-force protection on the credential endpoint (registered before
// authRoutes so it wraps the login route)
app.use("/api/auth/login", loginRateLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/counsellor", counsellorRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/admin/audit-logs", auditRoutes);

app.use(errorMiddleware);

// Export
export default app;
