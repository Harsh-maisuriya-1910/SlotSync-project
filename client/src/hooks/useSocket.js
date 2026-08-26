import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useDispatch } from "react-redux";
import { studentApi } from "../api/studentApi";
import { counsellorApi } from "../api/counsellorApi";
import { adminApi } from "../api/adminApi";

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";

export const useSocket = (role, id, subscriptions = []) => {
  const socketRef = useRef(null);
  const dispatch = useDispatch();

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      withCredentials: true,
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Socket connected");

      // Subscribe to appropriate rooms based on role
      if (role === "STUDENT") {
        subscriptions.forEach(slotId => socket.emit("subscribe:slot", slotId));
      } else if (role === "COUNSELLOR") {
        socket.emit("subscribe:counsellor", id);
      } else if (role === "ADMIN") {
        socket.emit("subscribe:admin");
      }
    });

    // Global Events
    socket.on("slot:created", () => {
      if (role === "STUDENT") {
        dispatch(studentApi.util.invalidateTags(["Slot"]));
      }
    });

    // Slot-specific updates (e.g., booking created, waitlist joined)
    socket.on("slot:update", () => {
      if (role === "STUDENT") {
        dispatch(studentApi.util.invalidateTags(["Slot", "Booking", "Waitlist"]));
      }
    });

    // Counsellor updates
    socket.on("counsellor:roster_update", () => {
      if (role === "COUNSELLOR") {
        dispatch(counsellorApi.util.invalidateTags(["Booking", "Slot", "Analytics"]));
      }
    });

    socket.on("counsellor:waitlist_update", () => {
      if (role === "COUNSELLOR") {
        dispatch(counsellorApi.util.invalidateTags(["Booking", "Waitlist", "Slot"]));
      }
    });

    // Admin updates
    socket.on("admin:analytics_update", () => {
      if (role === "ADMIN") {
        dispatch(adminApi.util.invalidateTags(["Analytics"]));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [role, id, subscriptions.join(","), dispatch]);

  return socketRef.current;
};
