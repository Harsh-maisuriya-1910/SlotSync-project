import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import slotRoutes from "./modules/slots/slot.routes.js";
import bookingRoutes from "./modules/bookings/booking.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import counsellorRoutes from "./modules/counsellor/counsellor.routes.js";
import waitlistRoutes from "./modules/waitlist/waitlist.routes.js";
import auditRoutes from "./modules/audit/audit.routes.js";
import errorMiddleware from "./middleware/error.middleware.js";
import env from "./config/env.js";

// App Initialization
const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

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
