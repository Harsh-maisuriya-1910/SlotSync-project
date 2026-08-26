import { Server } from "socket.io";
import env from "./config/env.js";

let io;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: env.CLIENT_URL || "http://localhost:8080",
      methods: ["GET", "POST", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join rooms for targeted updates
    socket.on("subscribe:slot", (slotId) => {
      socket.join(`slot:${slotId}`);
    });

    socket.on("subscribe:counsellor", (counsellorId) => {
      socket.join(`counsellor:${counsellorId}`);
    });

    socket.on("subscribe:admin", () => {
      socket.join("admin");
    });

    socket.on("unsubscribe:slot", (slotId) => {
      socket.leave(`slot:${slotId}`);
    });

    socket.on("unsubscribe:counsellor", (counsellorId) => {
      socket.leave(`counsellor:${counsellorId}`);
    });

    socket.on("unsubscribe:admin", () => {
      socket.leave("admin");
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
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

// Helper emit functions
export const emitSlotUpdate = (slotId, payload) => {
  if (io) io.to(`slot:${slotId}`).emit("slot:update", payload);
};

export const emitGlobalSlotCreated = (payload) => {
  if (io) io.emit("slot:created", payload);
};

export const emitCounsellorUpdate = (counsellorId, eventType, payload) => {
  if (io) io.to(`counsellor:${counsellorId}`).emit(eventType, payload);
};

export const emitAdminUpdate = (eventType, payload) => {
  if (io) io.to("admin").emit(eventType, payload);
};
