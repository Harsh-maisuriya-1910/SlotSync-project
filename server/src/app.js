import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import slotRoutes from "./modules/slots/slot.routes.js";
import bookingRoutes from "./modules/bookings/booking.routes.js";
import errorMiddleware from "./middleware/error.middleware.js";

// App Initialization
const app = express();

// Middlewares
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
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

app.use(errorMiddleware);

// Export
export default app;
