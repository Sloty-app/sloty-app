// config/sms.js — sends the OTP text message.
//
// IMPORTANT (India-specific): by law, any SMS sent to an Indian mobile
// number — from ANY provider (MSG91, Twilio, Fast2SMS, etc.) — requires
// the message template to be registered on the government's DLT
// (Distributed Ledger Technology) platform first. This isn't a code
// limitation, it's a telecom regulation. Until that's set up, this
// file runs in DEV MODE: it logs the OTP to your backend terminal
// instead of sending a real text, so you can test the entire login
// flow right now without waiting on DLT approval.
//
// To go live with MSG91 once you have an authkey + DLT template_id:
//   1. Sign up at msg91.com, verify your business, complete DLT registration
//   2. Create an SMS template like: "Your Sloty code is {#var#}. Valid 5 min."
//   3. Add to backend/.env:
//        MSG91_AUTH_KEY=your_auth_key
//        MSG91_TEMPLATE_ID=your_template_id
//        MSG91_SENDER_ID=your_6_char_sender_id   (e.g. SLOTYY)

async function sendOtpSms(phone, otp) {
  const { MSG91_AUTH_KEY, MSG91_TEMPLATE_ID, MSG91_SENDER_ID } = process.env;

  if (!MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID) {
    // Dev mode — no real SMS sent. This is expected until DLT/MSG91 is set up.
    console.log(`📱 [DEV MODE — no SMS provider configured] OTP for ${phone}: ${otp}`);
    return { success: true, dev: true };
  }

  try {
    const res = await fetch(
      `https://control.msg91.com/api/v5/flow/`,
      {
        method: "POST",
        headers: { authkey: MSG91_AUTH_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          template_id: MSG91_TEMPLATE_ID,
          sender: MSG91_SENDER_ID || "SLOTYY",
          recipients: [{ mobiles: `91${phone}`, VAR1: otp }],
        }),
      }
    );
    const data = await res.json();
    if (data.type === "error") {
      console.error("❌ MSG91 SMS failed:", data.message);
      return { success: false, message: data.message };
    }
    console.log(`✅ OTP SMS sent to ${phone}`);
    return { success: true };
  } catch (err) {
    console.error("❌ SMS send error:", err.message);
    return { success: false, message: err.message };
  }
}

module.exports = { sendOtpSms };