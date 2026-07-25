const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Forces IPv4 for the SMTP connection specifically — Render's network
  // can't route to Gmail's IPv6 address (confirmed via the exact
  // "ENETUNREACH" error in the logs), even though the same connection
  // works fine locally. The global IPv4 DNS preference already set at
  // the top of server.js doesn't extend to nodemailer's own internal
  // connection logic, so this needs to be set here specifically too.
  family: 4,
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"Sloty App 📍" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (err) {
    console.error(`❌ Email failed: ${err.message}`);
  }
};

// Email Templates
const emailTemplates = {

  bookingConfirmedCustomer: (name, storeName, date, time, token, service, price) => ({
    subject: `✅ Slot Confirmed at ${storeName} — Sloty`,
    html: `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#FF5E7D,#E0406A);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:28px">📍 Sloty</h1>
        <p style="color:rgba(255,255,255,0.8);margin:8px 0 0">Skip the wait. Book your slot.</p>
      </div>
      <div style="padding:32px">
        <h2 style="color:#1A1A2E;margin:0 0 8px">Slot Confirmed! 🎉</h2>
        <p style="color:#8892A4">Hi ${name}, your booking is confirmed!</p>
        <div style="background:#FFF5F7;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #FF5E7D">
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>🏪 Store:</strong> ${storeName}</p>
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>🛠️ Service:</strong> ${service}</p>
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>📅 Date:</strong> ${date}</p>
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>⏰ Time:</strong> ${time}</p>
          <p style="margin:0;color:#1A1A2E"><strong>💰 Price:</strong> ₹${price}</p>
        </div>
        <div style="background:linear-gradient(135deg,#FF5E7D,#E0406A);border-radius:16px;padding:24px;text-align:center;margin:20px 0">
          <p style="color:rgba(255,255,255,0.8);margin:0 0 8px;font-size:12px;letter-spacing:2px">YOUR TOKEN NUMBER</p>
          <h1 style="color:#fff;margin:0;font-size:48px;font-weight:900">${token}</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:12px">Show this token at the shop</p>
        </div>
        <p style="color:#8892A4;font-size:13px;text-align:center">Pay via UPI or Cash at the store</p>
      </div>
      <div style="background:#F0F2F8;padding:20px;text-align:center">
        <p style="color:#8892A4;margin:0;font-size:12px">© 2026 Sloty · Skip the wait · Made for India 🇮🇳</p>
      </div>
    </div>`,
  }),

  newBookingOwner: (ownerName, customerName, customerPhone, storeName, date, time, token, service, price) => ({
    subject: `🔔 New Booking at ${storeName} — Sloty`,
    html: `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#1A1A2E,#2D1B4E);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:28px">📍 Sloty</h1>
        <p style="color:rgba(255,255,255,0.6);margin:8px 0 0">Owner Dashboard</p>
      </div>
      <div style="padding:32px">
        <h2 style="color:#1A1A2E;margin:0 0 8px">New Booking! 🔔</h2>
        <p style="color:#8892A4">Hi ${ownerName}, you have a new booking at ${storeName}!</p>
        <div style="background:#F0F2F8;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #1A1A2E">
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>👤 Customer:</strong> ${customerName}</p>
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>📞 Phone:</strong> ${customerPhone}</p>
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>🛠️ Service:</strong> ${service}</p>
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>📅 Date:</strong> ${date}</p>
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>⏰ Time:</strong> ${time}</p>
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>💰 Price:</strong> ₹${price}</p>
          <p style="margin:0;color:#1A1A2E"><strong>🎫 Token:</strong> <span style="background:#1A1A2E;color:#fff;padding:4px 12px;border-radius:8px;font-weight:700">${token}</span></p>
        </div>
        <p style="color:#8892A4;font-size:13px;text-align:center">Login to Sloty dashboard to manage this booking</p>
      </div>
      <div style="background:#F0F2F8;padding:20px;text-align:center">
        <p style="color:#8892A4;margin:0;font-size:12px">© 2026 Sloty · Skip the wait · Made for India 🇮🇳</p>
      </div>
    </div>`,
  }),

  bookingStatusUpdate: (name, storeName, status, token) => ({
    subject: `${status === "completed" ? "✅ Service Complete" : status === "in_progress" ? "🎯 Your Turn!" : "❌ Booking Update"} — Sloty`,
    html: `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#FF5E7D,#E0406A);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:28px">📍 Sloty</h1>
      </div>
      <div style="padding:32px;text-align:center">
        <div style="font-size:64px;margin-bottom:16px">
          ${status === "completed" ? "✅" : status === "in_progress" ? "🎯" : "❌"}
        </div>
        <h2 style="color:#1A1A2E">
          ${status === "completed" ? "Service Complete!" : status === "in_progress" ? "Your Turn!" : "Booking Update"}
        </h2>
        <p style="color:#8892A4">Hi ${name},</p>
        <p style="color:#1A1A2E">
          ${status === "completed" ? `Your visit to <strong>${storeName}</strong> is complete. Thank you!` :
            status === "in_progress" ? `Your service at <strong>${storeName}</strong> has started!` :
            `Your booking at <strong>${storeName}</strong> has been updated.`}
        </p>
        <div style="background:#F0F2F8;border-radius:12px;padding:16px;margin:20px 0">
          <p style="margin:0;color:#1A1A2E"><strong>Token:</strong> ${token}</p>
        </div>
      </div>
      <div style="background:#F0F2F8;padding:20px;text-align:center">
        <p style="color:#8892A4;margin:0;font-size:12px">© 2026 Sloty · Made for India 🇮🇳</p>
      </div>
    </div>`,
  }),

  bookingCancelled: (name, storeName, date, time) => ({
    subject: `❌ Booking Cancelled — Sloty`,
    html: `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#FF5E7D,#E0406A);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:28px">📍 Sloty</h1>
      </div>
      <div style="padding:32px;text-align:center">
        <div style="font-size:64px;margin-bottom:16px">❌</div>
        <h2 style="color:#1A1A2E">Booking Cancelled</h2>
        <p style="color:#8892A4">Hi ${name}, your booking has been cancelled.</p>
        <div style="background:#FFF5F7;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #FF5E7D">
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>🏪 Store:</strong> ${storeName}</p>
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>📅 Date:</strong> ${date}</p>
          <p style="margin:0;color:#1A1A2E"><strong>⏰ Time:</strong> ${time}</p>
        </div>
        <p style="color:#8892A4;font-size:13px">Book another slot anytime on Sloty!</p>
      </div>
      <div style="background:#F0F2F8;padding:20px;text-align:center">
        <p style="color:#8892A4;margin:0;font-size:12px">© 2026 Sloty · Made for India 🇮🇳</p>
      </div>
    </div>`,
  }),

  storeApproved: (ownerName, storeName) => ({
    subject: `✅ Your Store is Approved! — Sloty`,
    html: `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#1A1A2E,#2D1B4E);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:28px">📍 Sloty</h1>
      </div>
      <div style="padding:32px;text-align:center">
        <div style="font-size:64px;margin-bottom:16px">🎉</div>
        <h2 style="color:#1A1A2E">Store Approved!</h2>
        <p style="color:#8892A4">Hi ${ownerName},</p>
        <p style="color:#1A1A2E">Your store <strong>${storeName}</strong> has been approved and is now live on Sloty!</p>
        <div style="background:#F0FDF4;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #00C9A7">
          <p style="margin:0;color:#1A1A2E">🟢 Customers in your area can now find and book your store!</p>
        </div>
        <p style="color:#8892A4;font-size:13px">Login to your owner dashboard to manage bookings.</p>
      </div>
      <div style="background:#F0F2F8;padding:20px;text-align:center">
        <p style="color:#8892A4;margin:0;font-size:12px">© 2026 Sloty · Made for India 🇮🇳</p>
      </div>
    </div>`,
  }),
};

module.exports = { sendEmail, emailTemplates };