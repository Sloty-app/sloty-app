// config/seed.js
// Run: node config/seed.js
// Creates demo users and sample stores in the database

require("dotenv").config();
const mongoose = require("mongoose");

const User  = require("../models/User");
const Store = require("../models/Store");

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    await User.deleteMany({});
    await Store.deleteMany({});
    console.log("🗑️  Cleared existing data");

    // Create demo users — plain text here is intentional: the User
    // schema's own pre("save") hook hashes it on create. Pre-hashing it
    // here too (as this line previously did) would double-hash it,
    // silently making every demo account's real password unusable.
    const password = "demo123";

    const admin = await User.create({
      name: "Admin",
      email: "admin@demo.com",
      phone: "9000000001",
      password,
      role: "admin",
      city: "Coimbatore",
      isVerified: true,
    });

    const owner = await User.create({
      name: "Raja (Owner)",
      email: "owner@demo.com",
      phone: "9000000002",
      password,
      role: "owner",
      city: "Coimbatore",
      isVerified: true,
    });

    const customer = await User.create({
      name: "Demo Customer",
      email: "customer@demo.com",
      phone: "9000000003",
      password,
      role: "customer",
      city: "Coimbatore",
      isVerified: true,
    });

    console.log("👤 Demo users created");

    // Create approved demo stores
    await Store.create([
      {
        owner: owner._id,
        name: "Raja Hair Studio",
        category: "salon",
        phone: "9876543210",
        address: "12, RS Puram",
        city: "Coimbatore",
        pincode: "641002",
        services: [
          { name: "Haircut",    price: 80,   duration: 30 },
          { name: "Beard Trim", price: 50,   duration: 20 },
          { name: "Hair Color", price: 500,  duration: 90 },
          { name: "Shave",      price: 40,   duration: 15 },
        ],
        workingHours: { open: "09:00", close: "21:00", days: ["Mon","Tue","Wed","Thu","Fri","Sat"] },
        slotDuration: 30,
        isApproved: true,
        isOpen: true,
        rating: 4.8,
        totalReviews: 320,
        photos: ["https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80"],
      },
      {
        owner: owner._id,
        name: "Speed Garage",
        category: "mechanic_bike",
        phone: "9876543211",
        address: "45, Gandhipuram",
        city: "Coimbatore",
        pincode: "641012",
        services: [
          { name: "Full Service", price: 500, duration: 60 },
          { name: "Oil Change",   price: 200, duration: 30 },
          { name: "Tyre Repair",  price: 100, duration: 20 },
        ],
        workingHours: { open: "08:00", close: "19:00", days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] },
        slotDuration: 30,
        isApproved: true,
        isOpen: true,
        rating: 4.6,
        totalReviews: 189,
        photos: ["https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&q=80"],
      },
    ]);

    // Create a PENDING store (not approved yet — owner registered, waiting admin)
    await Store.create({
      owner: owner._id,
      name: "Ganesh Salon",
      category: "salon",
      phone: "9876543299",
      address: "10, RS Puram",
      city: "Coimbatore",
      pincode: "641002",
      services: [{ name: "Haircut", price: 60, duration: 30 }],
      workingHours: { open: "09:00", close: "20:00", days: ["Mon","Tue","Wed","Thu","Fri","Sat"] },
      slotDuration: 30,
      isApproved: false,  // ← Waiting for admin approval
      isOpen: false,
    });

    console.log("🏪 Demo stores created (2 approved + 1 pending)");
    console.log("\n✅ Seed complete! Demo accounts:");
    console.log("   Admin    → admin@demo.com    / demo123");
    console.log("   Owner    → owner@demo.com    / demo123");
    console.log("   Customer → customer@demo.com / demo123");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  }
};

seed();
