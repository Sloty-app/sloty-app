// config/socket.js — Socket.io server setup.
//
// DEV MODE: CORS accepts any origin (origin: true), so any device on
// your local network — laptop, phone, tablet — can connect during
// testing without needing to match specific IP patterns. Tighten this
// to a specific origin (or the LAN-regex version) before deploying to
// production, since accepting any origin is not safe for a public
// server.
const { Server } = require("socket.io");

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const configuredOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(o => o.trim()).filter(Boolean);
        if (configuredOrigins.length > 0) {
          return configuredOrigins.includes(origin) ? callback(null, true) : callback(new Error("Not allowed by Socket.io CORS"));
        }
        const isDevOrigin = origin === "http://localhost:5173"
          || /^http:\/\/192\.168\.\d+\.\d+:5173$/.test(origin)
          || /^http:\/\/10\.\d+\.\d+\.\d+:5173$/.test(origin);
        callback(null, isDevOrigin);
      },
      credentials: true,
    },
    // Explicitly allow both transports — some networks/proxies block
    // raw WebSocket upgrades, so polling is kept as a working fallback
    // rather than the connection failing outright.
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on("join", (room) => {
      if (!room) return;
      socket.join(room);
      console.log(`   ↳ ${socket.id} joined room: ${room}`);
    });

    socket.on("leave", (room) => {
      if (!room) return;
      socket.leave(room);
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log(`✅ Socket.io initialized — CORS accepts any origin (dev mode)`);
  return io;
}

function emitToRoom(room, event, payload) {
  if (!io) {
    console.warn("emitToRoom called before Socket.io was initialized — event dropped:", event);
    return;
  }
  io.to(room).emit(event, payload);
}

module.exports = { initSocket, emitToRoom };