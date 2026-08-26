import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useDispatch } from "react-redux";
import { studentApi } from "../api/studentApi";
import { counsellorApi } from "../api/counsellorApi";
import { adminApi } from "../api/adminApi";

const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";

export const useSocket = (role, id, subscriptions = []) => {
  const socketRef = useRef(null);
  const dispatch = useDispatch();
  // Store subscriptions in a ref to avoid re-creating the socket on every re-render
  const subscriptionsRef = useRef(subscriptions);
  subscriptionsRef.current = subscriptions;

  useEffect(() => {
    if (!role) return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    const onConnect = () => {
      console.log("[Socket] connected:", socket.id);

      // Subscribe to rooms based on role, converting IDs to strings
      if (role === "STUDENT") {
        subscriptionsRef.current.forEach((slotId) =>
          socket.emit("subscribe:slot", String(slotId))
        );
      } else if (role === "COUNSELLOR" && id) {
        socket.emit("subscribe:counsellor", String(id));
      } else if (role === "ADMIN") {
        socket.emit("subscribe:admin");
      }
    };

    const onSlotCreated = () => {
      if (role === "STUDENT") {
        dispatch(studentApi.util.invalidateTags(["Slot"]));
      }
    };

    const onSlotUpdate = () => {
      if (role === "STUDENT") {
        dispatch(studentApi.util.invalidateTags(["Slot", "Booking", "Waitlist"]));
      }
    };

    const onCounsellorRoster = () => {
      if (role === "COUNSELLOR") {
        dispatch(counsellorApi.util.invalidateTags(["Booking", "Slot", "Analytics"]));
      }
    };

    const onCounsellorWaitlist = () => {
      if (role === "COUNSELLOR") {
        dispatch(counsellorApi.util.invalidateTags(["Booking", "Waitlist", "Slot"]));
      }
    };

    const onAdminAnalytics = () => {
      if (role === "ADMIN") {
        dispatch(adminApi.util.invalidateTags(["Analytics"]));
      }
    };

    const onDisconnect = (reason) => {
      console.log("[Socket] disconnected:", reason);
    };

    const onConnectError = (err) => {
      console.warn("[Socket] connection error:", err.message);
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
      // Clean up all listeners before disconnecting
      socket.off("connect", onConnect);
      socket.off("slot:created", onSlotCreated);
      socket.off("slot:update", onSlotUpdate);
      socket.off("counsellor:roster_update", onCounsellorRoster);
      socket.off("counsellor:waitlist_update", onCounsellorWaitlist);
      socket.off("admin:analytics_update", onAdminAnalytics);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
    };
  }, [role, id, dispatch]); // Note: subscriptions handled via ref to avoid reconnects

  return socketRef.current;
};
