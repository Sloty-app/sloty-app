// utils/socket.js — singleton Socket.io client connection.
//
// CRITICAL FIX: Socket.io does NOT remember room memberships across a
// reconnect — a dropped-and-restored connection gets a fresh socket ID
// with zero rooms joined. Since joinRoom() was previously only called
// once on component mount, any reconnect (common when the underlying
// WebSocket upgrade is being blocked and falls back/retries) silently
// left the socket in no rooms at all, meaning it stopped receiving any
// server-pushed events until something remounted the component.
//
// Fix: track every room the app wants to be in, and automatically
// rejoin ALL of them every time the socket fires "connect" — which
// fires on the initial connection AND every reconnect. Room membership
// is now durable across connection drops instead of one-shot.
import { io } from "socket.io-client";

const SOCKET_URL = (import.meta.env.VITE_API_URL || "http://localhost:5001/api").replace(/\/api\/?$/, "");

let socket = null;
const desiredRooms = new Set(); // every room the app currently wants to be in

export function getSocket() {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    transports: ["polling", "websocket"], // start on polling (works everywhere), upgrade to websocket when the network allows it
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    withCredentials: true,
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id);
    // Rejoin every room the app wants — critical after a reconnect,
    // harmless (idempotent) on the very first connect too.
    desiredRooms.forEach(room => socket.emit("join", room));
    if (desiredRooms.size > 0) {
      console.log(`   ↳ rejoined ${desiredRooms.size} room(s):`, [...desiredRooms]);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 Socket disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("❌ Socket connection error:", err.message);
  });

  return socket;
}

export function joinRoom(room) {
  if (!room) return;
  desiredRooms.add(room);
  getSocket().emit("join", room);
}

export function leaveRoom(room) {
  if (!room) return;
  desiredRooms.delete(room);
  getSocket().emit("leave", room);
}