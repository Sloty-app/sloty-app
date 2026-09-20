// config/mailer.js
//
// Sends email via Twilio SendGrid's v3 HTTP API instead of raw SMTP.
// This exists because Gmail SMTP proved genuinely unreliable on
// Render's network (forcing IPv4, port 465, port 587 all hit the same
// connection failures), and the Resend setup that replaced it only
// ever delivered to the single address the account was registered
// with. SendGrid sends over regular HTTPS (the same port everything
// else in this app already uses), and can deliver to any recipient once
// the sender address is verified in SendGrid.
//
// Uses Node's built-in fetch — no new package needed.
//
// Required env vars (both must be set, or nothing is sent):
//   SENDGRID_API_KEY     — SendGrid dashboard > Settings > API Keys
//                          (needs at least "Mail Send" permission)
//   SENDGRID_FROM_EMAIL  — must be a VERIFIED sender in SendGrid
//                          (Settings > Sender Authentication — either
//                          Single Sender Verification or a verified
//                          domain). SendGrid rejects any other address.
// Optional:
//   SENDGRID_FROM_NAME   — display name, defaults to "Sloty"
const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

// Never throws — callers fire this off alongside the main action (a
// booking, an approval) and must not fail that action just because an
// email couldn't go out. Failures are logged with SendGrid's own error
// detail instead.
const sendEmail = async (to, subject, html) => {
  const apiKey    = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    console.error("❌ Email not sent — SENDGRID_API_KEY and SENDGRID_FROM_EMAIL must both be set");
    return;
  }
  try {
    const res = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: process.env.SENDGRID_FROM_NAME || "Sloty" },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });
    // SendGrid answers 202 Accepted (empty body) on success.
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`SendGrid API returned ${res.status}: ${errBody}`);
    }
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
        <div style="background:#FFF9E6;border-radius:12px;padding:14px 18px;margin:0 0 20px;border-left:4px solid #FFD23F">
          <p style="margin:0;color:#1A1A2E;font-size:13px">⏰ <strong>Please arrive at least 15 minutes before your slot time.</strong></p>
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

  // Restored — was missing from the file at time of this rebuild, but
  // storeController.js's createStore function calls this directly when
  // a new store registers. Without it present, that call would throw
  // (emailTemplates.newStorePendingAdmin is not a function) the moment
  // a real store registration happened.
  newStorePendingAdmin: (storeName, ownerName, category, city) => ({
    subject: `🆕 New Store Pending Approval — ${storeName}`,
    html: `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#1A1A2E,#2D1B4E);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:28px">📍 Sloty</h1>
        <p style="color:rgba(255,255,255,0.6);margin:8px 0 0">Admin Dashboard</p>
      </div>
      <div style="padding:32px">
        <h2 style="color:#1A1A2E;margin:0 0 8px">New Store Pending Approval 🆕</h2>
        <p style="color:#8892A4">A new store has been submitted and is waiting for your review.</p>
        <div style="background:#F0F2F8;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #1A1A2E">
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>🏪 Store:</strong> ${storeName}</p>
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>👤 Owner:</strong> ${ownerName}</p>
          <p style="margin:0 0 8px;color:#1A1A2E"><strong>🏷️ Category:</strong> ${category}</p>
          <p style="margin:0;color:#1A1A2E"><strong>📍 City:</strong> ${city}</p>
        </div>
        <p style="color:#8892A4;font-size:13px;text-align:center">Login to the Sloty admin dashboard to review and approve.</p>
      </div>
      <div style="background:#F0F2F8;padding:20px;text-align:center">
        <p style="color:#8892A4;margin:0;font-size:12px">© 2026 Sloty · Made for India 🇮🇳</p>
      </div>
    </div>`,
  }),
};

module.exports = { sendEmail, emailTemplates };