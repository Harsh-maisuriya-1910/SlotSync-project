import React, { createContext, useContext, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useDispatch } from "react-redux";
import { studentApi } from "../api/studentApi";
import { counsellorApi } from "../api/counsellorApi";
import { adminApi } from "../api/adminApi";

const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";

const SocketContext = createContext(null);

export function SocketProvider({ role, id, children }) {
  const socketRef = useRef(null);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!role) return;
    if (socketRef.current?.connected) return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    const onConnect = () => {
      console.log(`[Socket.IO Client] Connected (${socket.id}) with role: ${role}`);
      if (role === "COUNSELLOR" && id) {
        socket.emit("subscribe:counsellor", String(id));
      } else if (role === "ADMIN") {
        socket.emit("subscribe:admin");
      }
    };

    const onSlotCreated = () => {
      console.log("[Socket.IO Client] Event: slot:created");
      if (role === "STUDENT") {
        dispatch(studentApi.util.invalidateTags(["Slot"]));
      }
    };

    const onSlotUpdate = () => {
      console.log("[Socket.IO Client] Event: slot:update");
      if (role === "STUDENT") {
        dispatch(studentApi.util.invalidateTags(["Slot", "Booking", "Waitlist"]));
      }
      if (role === "COUNSELLOR") {
        dispatch(counsellorApi.util.invalidateTags(["Booking", "Slot", "Analytics"]));
      }
      if (role === "ADMIN") {
        dispatch(adminApi.util.invalidateTags(["Analytics", "AuditLog"]));
      }
    };

    const onCounsellorRoster = () => {
      console.log("[Socket.IO Client] Event: counsellor:roster_update");
      if (role === "COUNSELLOR") {
        dispatch(counsellorApi.util.invalidateTags(["Booking", "Slot", "Analytics"]));
      }
    };

    const onCounsellorWaitlist = () => {
      console.log("[Socket.IO Client] Event: counsellor:waitlist_update");
      if (role === "COUNSELLOR") {
        dispatch(counsellorApi.util.invalidateTags(["Booking", "Waitlist", "Slot"]));
      }
    };

    const onAdminAnalytics = () => {
      console.log("[Socket.IO Client] Event: admin:analytics_update");
      if (role === "ADMIN") {
        dispatch(adminApi.util.invalidateTags(["Analytics", "AuditLog"]));
      }
    };

    const onDisconnect = (reason) => {
      console.warn(`[Socket.IO Client] Disconnected: ${reason}`);
    };

    const onConnectError = (err) => {
      console.warn(`[Socket.IO Client] Connection error: ${err.message}`);
    };

    socket.on("connect", onConnect);
    socket.on("slot:created", onSlotCreated);
    socket.on("slot:update", onSlotUpdate);
    socket.on("counsellor:roster_update", onCounsellorRoster);
    socket.on("counsellor:waitlist_update", onCounsellorWaitlist);
    socket.on("admin:analytics_update", onAdminAnalytics);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("slot:created", onSlotCreated);
      socket.off("slot:update", onSlotUpdate);
      socket.off("counsellor:roster_update", onCounsellorRoster);
      socket.off("counsellor:waitlist_update", onCounsellorWaitlist);
      socket.off("admin:analytics_update", onAdminAnalytics);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [role, id, dispatch]);

  return React.createElement(SocketContext.Provider, { value: socketRef }, children);
}

export function useSocketRef() {
  return useContext(SocketContext);
}

export function useSocket(role, id, subscriptions = []) {
  const socketRef = useContext(SocketContext);
  const subscriptionsRef = useRef(subscriptions);
  subscriptionsRef.current = subscriptions;

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket || role !== "STUDENT" || !subscriptionsRef.current.length) return;

    const emitSubs = () => {
      subscriptionsRef.current.forEach((slotId) =>
        socket.emit("subscribe:slot", String(slotId))
      );
    };

    if (socket.connected) emitSubs();
    socket.on("connect", emitSubs);

    return () => {
      socket.off("connect", emitSubs);
    };
  }, [socketRef, role]);
}
