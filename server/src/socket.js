import { Server } from "socket.io";
import env from "./config/env.js";

let io;

export const initializeSocket = (server) => {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://slot-sync-project.vercel.app",
    env.CLIENT_URL,
  ].filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Socket CORS: Not allowed by CORS"));
      },
      methods: ["GET", "POST", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join rooms for targeted updates
    socket.on("subscribe:slot", (slotId) => {
      socket.join(`slot:${String(slotId)}`);
    });

    socket.on("subscribe:counsellor", (counsellorId) => {
      socket.join(`counsellor:${String(counsellorId)}`);
    });

    socket.on("subscribe:admin", () => {
      socket.join("admin");
    });

    socket.on("unsubscribe:slot", (slotId) => {
      socket.leave(`slot:${String(slotId)}`);
    });

    socket.on("unsubscribe:counsellor", (counsellorId) => {
      socket.leave(`counsellor:${String(counsellorId)}`);
    });

    socket.on("unsubscribe:admin", () => {
      socket.leave("admin");
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

// Helper emit functions (targeted + global broadcast for 100% reliability)
export const emitSlotUpdate = (slotId, payload) => {
  if (io) {
    io.to(`slot:${String(slotId)}`).emit("slot:update", payload);
    io.emit("slot:update", payload);
  }
};

export const emitGlobalSlotCreated = (payload) => {
  if (io) io.emit("slot:created", payload);
};

export const emitCounsellorUpdate = (counsellorId, eventType, payload) => {
  if (io) {
    io.to(`counsellor:${String(counsellorId)}`).emit(eventType, payload);
    io.emit(eventType, payload);
  }
};

export const emitAdminUpdate = (eventType, payload) => {
  if (io) {
    io.to("admin").emit(eventType, payload);
    io.emit(eventType, payload);
  }
};
