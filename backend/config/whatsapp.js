// config/whatsapp.js — sends booking confirmations & reminders via
// WhatsApp using Meta's official WhatsApp Cloud API directly (no
// third-party BSP fees — just Meta's per-message rate, ~₹0.115 for
// utility-category messages like booking confirmations in India).
//
// IMPORTANT: Business-initiated WhatsApp messages MUST use a
// pre-approved template — you can't just send free-form text like a
// regular chat. Create these templates in Meta Business Manager
// (business.facebook.com > WhatsApp Manager > Message Templates)
// under category "Utility", and they're usually approved within
// a few hours.
//
// Until WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID are set in
// .env, this runs in DEV MODE: it logs to your terminal instead of
// sending a real message, so you can test the whole booking flow
// right now without waiting on Meta's business verification.
//
// To go live:
//   1. Create a Meta Business Account at business.facebook.com
//   2. Add a WhatsApp Business Account + phone number (WhatsApp Manager)
//   3. Create & submit these 2 templates for approval (category: Utility):
//        - booking_confirmation: "Hi {{1}}, your booking at {{2}} is confirmed
//          for {{3}} at {{4}}. Your token: {{5}}. Show OTP {{6}} at the shop."
//        - booking_reminder: "Hi {{1}}, reminder: your slot at {{2}} is at
//          {{3}} today. Token: {{4}}. See you soon!"
//   4. Get a permanent access token + phone number ID from
//      developers.facebook.com (Meta for Developers > your app > WhatsApp)
//   5. Add to backend/.env:
//        WHATSAPP_ACCESS_TOKEN=your_token
//        WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
//        WHATSAPP_API_VERSION=v21.0   (optional, defaults to latest stable)

const GRAPH_API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

/**
 * Sends a WhatsApp template message. `templateName` must exactly match
 * an approved template in Meta Business Manager. `params` is an
 * ordered array mapping to that template's {{1}}, {{2}}, etc.
 * placeholders — order matters, not just presence.
 */
async function sendWhatsAppTemplate(phone, templateName, params) {
  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    // Dev mode — no real message sent. Expected until Meta setup is done.
    console.log(`📱 [DEV MODE — WhatsApp not configured] Would send "${templateName}" to ${phone}:`, params);
    return { success: true, dev: true };
  }

  try {
    // Indian numbers need the country code with no leading zero or +
    // for the Graph API's "to" field, e.g. 919876543210.
    const toNumber = phone.startsWith("91") ? phone : `91${phone.replace(/^0+/, "")}`;

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNumber,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en" },
            components: [{
              type: "body",
              parameters: params.map(p => ({ type: "text", text: String(p) })),
            }],
          },
        }),
      }
    );

    const data = await res.json();
    if (data.error) {
      console.error("WhatsApp send error:", data.error.message);
      return { success: false, error: data.error.message };
    }
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error("WhatsApp send error:", err.message);
    return { success: false, error: err.message };
  }
}

/** Booking confirmed — sent right after a successful booking. */
exports.sendBookingConfirmationWhatsApp = (phone, customerName, storeName, date, timeSlot, tokenNumber, otp) =>
  sendWhatsAppTemplate(phone, "booking_confirmation", [customerName, storeName, date, timeSlot, tokenNumber, otp]);

/** Reminder — sent shortly before the customer's slot, same trigger as the push notification reminder job. */
exports.sendBookingReminderWhatsApp = (phone, customerName, storeName, timeSlot, tokenNumber) =>
  sendWhatsAppTemplate(phone, "booking_reminder", [customerName, storeName, timeSlot, tokenNumber]);