// config/socket.js — Socket.io server setup.
//
// DEV MODE: CORS accepts any origin (origin: true), so any device on
// your local network — laptop, phone, tablet — can connect during
// testing without needing to match specific IP patterns. Tighten this
// to a specific origin (or the LAN-regex version) before deploying to
// production, since accepting any origin is not safe for a public
// server.
const { Server } = require("socket.io");
const jwt   = require("jsonwebtoken");
const User  = require("../models/User");
const Store = require("../models/Store");

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

  // Every socket must carry the same JWT the REST API uses. Before this,
  // anyone could connect without logging in and join any "user:<id>"
  // room — owner ids are public via the store API — and read that
  // user's live new-booking alerts, chat notices and booking updates.
  io.use((socket, next) => {
    try {
      const { id } = jwt.verify(socket.handshake.auth?.token || "", process.env.JWT_SECRET, { algorithms: ["HS256"] });
      socket.userId = String(id);
      next();
    } catch {
      next(new Error("Please login to continue"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Only your own user room, or a store room for a store you own.
    socket.on("join", async (room) => {
      if (typeof room !== "string") return;
      try {
        let allowed = room === `user:${socket.userId}`;
        const storeRoom = room.match(/^store:([0-9a-f]{24}):\d{4}-\d{2}-\d{2}$/);
        if (!allowed && storeRoom) {
          const user = await User.findById(socket.userId).select("role");
          allowed = user?.role === "admin" || !!(await Store.exists({ _id: storeRoom[1], owner: socket.userId }));
        }
        if (!allowed) return;
        socket.join(room);
        console.log(`   ↳ ${socket.id} joined room: ${room}`);
      } catch (err) {
        console.error("Socket join error:", err.message);
      }
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