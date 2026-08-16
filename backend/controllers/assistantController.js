// controllers/assistantController.js
//
// Conversational booking assistant, powered by Google's free Gemini API.
// The AI doesn't book anything on its own authority — every booking action
// goes through the SAME validated functions used by the regular app
// (search stores, check real slots, create a real booking with
// server-side price/availability checks). The AI's job is just to figure
// out WHAT the user wants and call the right function with the right
// arguments, asking clarifying questions along the way like a human
// booking agent would.
const { GoogleGenAI } = require("@google/genai");
const Store  = require("../models/Store");
const { getISTDateString } = require("../utils/date");
const bookingController = require("./bookingController");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// gemini-2.5-flash-lite: much higher free-tier daily quota than regular
// Flash (which caps at just 20 requests/day) — better fit for a chat
// assistant that makes several calls per conversation turn.
const MODEL = "gemini-2.5-flash-lite";

const SYSTEM_PROMPT = `You are Sloty's booking assistant. You help users find a local service business (salon, mechanic, doctor, dentist, etc.) and book a slot — entirely through conversation, end to end.

Today's date (IST) is ${getISTDateString()}.

How to behave:
- Ask ONE clarifying question at a time. Don't overwhelm the user with a checklist.
- Figure out, in roughly this order: what service/category they need → which store (search and present 2-3 options, don't just pick one) → which specific service(s) at that store → which staff member if the store has multiple → what date → what time slot.
- Always use the tools to get REAL data — store lists, real prices, real slot availability. Never invent a store name, price, or available time.
- If the user names a specific store, search for it directly rather than asking which category first.
- Users can book MULTIPLE services in one visit (e.g. "Haircut and Shaving") — support that naturally if they mention more than one.
- Before calling create_booking, briefly confirm what you're about to book ("Booking Haircut + Shaving at Style Studio for tomorrow 4:30 PM, total ₹450 — confirm?") and wait for a yes.
- After a successful booking, tell them their token number and that the OTP is in their app — don't read the OTP out loud since it's already shown in the booking confirmation UI.
- When presenting time options, list out a few exact slot strings from get_available_slots (e.g. "10:00 AM, 10:30 AM, 11:00 AM") so the user can just say one back to you. Never accept or guess a time format the user invents (like "10" or "10.00") — if their reply doesn't exactly match one of the available slots you listed, ask them to pick one of the exact options you showed.
- Keep replies short and conversational — 1-3 sentences, like texting a helpful friend, not a formal assistant.
- If something fails (slot taken, store closed), explain plainly and offer the next best option using the tools again.`;

const TOOLS = [
  {
    name: "search_stores",
    description: "Search for stores by category and/or name and/or city/area. Use this first to find options before booking.",
    parameters: {
      type: "OBJECT",
      properties: {
        category: { type: "STRING", enum: ["salon","mechanic_bike","mechanic_car","doctor","dentist","mobile_repair","medical_lab","optician","beauty_parlour","unisex_salon"], description: "Service category, if known" },
        search:   { type: "STRING", description: "Store name to search for, if the user named a specific store" },
        city:     { type: "STRING", description: "City or area to search in" },
      },
    },
  },
  {
    name: "get_store_details",
    description: "Get full details for one specific store by its ID — services with prices/durations, staff list, working hours. Call this once a store is chosen, before checking slots.",
    parameters: {
      type: "OBJECT",
      properties: { storeId: { type: "STRING", description: "The store's MongoDB _id" } },
      required: ["storeId"],
    },
  },
  {
    name: "get_available_slots",
    description: "Get real available time slots for a store on a specific date, given the total duration of the service(s) selected. Call this after the user has picked their service(s) and a date.",
    parameters: {
      type: "OBJECT",
      properties: {
        storeId:  { type: "STRING" },
        date:     { type: "STRING", description: "YYYY-MM-DD format" },
        duration: { type: "NUMBER", description: "Total combined duration in minutes of all selected services" },
        staffId:  { type: "STRING", description: "Staff member's _id, only if the store has multiple staff and one was chosen" },
      },
      required: ["storeId", "date", "duration"],
    },
  },
  {
    name: "create_booking",
    description: "Actually creates the booking. Only call this AFTER the user has explicitly confirmed the summary (store, service(s), date, time, total price).",
    parameters: {
      type: "OBJECT",
      properties: {
        storeId:  { type: "STRING" },
        services: {
          type: "ARRAY",
          items: { type: "OBJECT", properties: { name: { type: "STRING" } }, required: ["name"] },
          description: "Service name(s) exactly as listed by get_store_details — one or more.",
        },
        date:     { type: "STRING", description: "YYYY-MM-DD" },
        timeSlot: { type: "STRING", description: "Exact slot string as returned by get_available_slots, e.g. '4:30 PM'" },
        staffId:  { type: "STRING", description: "Only if a specific staff member was chosen" },
      },
      required: ["storeId", "services", "date", "timeSlot"],
    },
  },
];

// ── Tool implementations — thin wrappers around real, existing logic ───────
async function runTool(name, input, req) {
  try {
    switch (name) {
      case "search_stores": {
        const filter = { isApproved: true, isActive: true };
        // "salon", "unisex_salon", and "beauty_parlour" overlap heavily
        // in what they actually offer (a haircut request could
        // reasonably match any of the three) — searching by exact
        // category alone meant the AI picking "unisex_salon" for a
        // general "haircut" request would completely miss real,
        // relevant stores filed under plain "salon". Grouping these so
        // any one of them pulls in all three, rather than depending on
        // the AI guessing the one exact label a store happens to use.
        const HAIR_BEAUTY_GROUP = ["salon", "unisex_salon", "beauty_parlour"];
        if (input.category) {
          filter.category = HAIR_BEAUTY_GROUP.includes(input.category)
            ? { $in: HAIR_BEAUTY_GROUP }
            : input.category;
        }
        // Matches against BOTH city and area — "Kukatpally" is a
        // neighborhood inside Hyderabad (the actual city), stored in
        // the separate `area` field. Checking city alone meant any
        // area-level search term would never match a single store,
        // even when real, relevant stores genuinely existed there.
        if (input.city) {
          const cityRegex = new RegExp(input.city, "i");
          filter.$or = [{ city: cityRegex }, { area: cityRegex }];
        }
        if (input.search)   filter.name = new RegExp(input.search, "i");
        const stores = await Store.find(filter).select("name category city area rating totalReviews isOpen services").limit(6).lean();
        return { stores: stores.map(s => ({
          storeId: s._id.toString(), name: s.name, category: s.category, city: s.city, area: s.area,
          rating: s.rating, isOpen: s.isOpen,
          services: s.services.map(sv => ({ name: sv.name, price: sv.price, duration: sv.duration })),
        })) };
      }
      case "get_store_details": {
        if (!input.storeId || !/^[0-9a-fA-F]{24}$/.test(input.storeId)) {
          return { error: "That storeId looks invalid — call search_stores again and use the exact storeId field it returns." };
        }
        const store = await Store.findById(input.storeId).lean();
        if (!store) return { error: "Store not found" };
        return {
          storeId: store._id.toString(), name: store.name, category: store.category,
          address: store.address, city: store.city, area: store.area,
          workingHours: store.workingHours, isOpen: store.isOpen,
          services: store.services.map(s => ({ name: s.name, price: s.price, duration: s.duration })),
          hasStaff: store.hasStaff,
          staff: store.hasStaff ? store.staff.filter(s => s.isActive).map(s => ({ staffId: s._id.toString(), name: s.name, specialization: s.specialization })) : [],
        };
      }
      case "get_available_slots": {
        if (!input.storeId || !/^[0-9a-fA-F]{24}$/.test(input.storeId)) {
          return { error: "That storeId looks invalid — call get_store_details again first to confirm it." };
        }
        // Reuse the real controller logic via a minimal mock req/res so the
        // exact same break/blocked/booked-slot rules apply as the normal app.
        return await new Promise((resolve) => {
          const mockReq = { params: { storeId: input.storeId }, query: { date: input.date, duration: String(input.duration), staffId: input.staffId } };
          const mockRes = { status: () => mockRes, json: (data) => resolve(data) };
          bookingController.getAvailableSlots(mockReq, mockRes);
        }).then(data => {
          if (!data.success) return { error: data.message };
          return { date: data.date, availableSlots: data.slots.filter(s => s.available).map(s => s.time) };
        });
      }
      case "create_booking": {
        if (!input.storeId || !/^[0-9a-fA-F]{24}$/.test(input.storeId)) {
          return { error: "That storeId looks invalid — confirm it with get_store_details before booking." };
        }
        return await new Promise((resolve) => {
          const mockReq = {
            user: req.user,
            body: { storeId: input.storeId, services: input.services, date: input.date, timeSlot: input.timeSlot, staffId: input.staffId, paymentMode: "cash" },
          };
          const mockRes = { status: () => mockRes, json: (data) => resolve(data) };
          bookingController.createBooking(mockReq, mockRes);
        }).then(data => {
          if (!data.success) return { error: data.message };
          return {
            success: true, tokenNumber: data.booking.tokenNumber,
            storeName: data.booking.store?.name, date: data.booking.date, timeSlot: data.booking.timeSlot,
            totalPrice: data.booking.service.price, serviceName: data.booking.service.name,
          };
        });
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error(`Tool "${name}" threw an error:`, err.message);
    return { error: `Something went wrong looking that up (${err.message}). Please try again or rephrase.` };
  }
}

/** Pulls every functionCall part out of a Gemini response candidate's
 *  content.parts — done at the raw-parts level (not via SDK convenience
 *  getters) since that shape mirrors the REST API directly and is the
 *  most stable thing to depend on across SDK minor-version changes. */
function getFunctionCalls(parts) {
  return parts.filter(p => p.functionCall).map(p => p.functionCall);
}
function getTextReply(parts) {
  return parts.filter(p => p.text).map(p => p.text).join(" ");
}

const TURN_TIMEOUT_MS = 15000; // 15s ceiling per Gemini call

/** Races a promise against a timeout, so a hanging/slow Gemini call
 *  can't stall the whole chat response indefinitely — the user gets a
 *  clear "took too long" error instead of a spinner that never resolves. */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { isTimeout: true })), ms)
    ),
  ]);
}

/** Google's free-tier models occasionally return a transient 503
 *  "high demand" error that clears up within seconds — retry a couple
 *  times with a short backoff before giving up, instead of immediately
 *  surfacing it as a hard failure to the user. Each individual attempt
 *  is capped at TURN_TIMEOUT_MS so a hung request doesn't block retries
 *  (or the overall response) indefinitely. */
async function generateWithRetry(params, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(ai.models.generateContent(params), TURN_TIMEOUT_MS, "Gemini call");
    } catch (err) {
      const isTransient = err.status === 503 || err.status === 429 || err.isTimeout;
      if (!isTransient || attempt === maxAttempts) throw err;
      const delayMs = attempt * 1500;
      console.warn(`Gemini call failed (attempt ${attempt}/${maxAttempts}, ${err.isTimeout ? "timeout" : `status ${err.status}`}) — retrying in ${delayMs}ms`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

// POST /api/assistant/chat  { messages: [{role, parts}], conversationId? }
// `messages` is the running conversation history in Gemini's own shape
// (role: "user"|"model", parts: [...]) — stateless on the backend by
// design, simplest to reason about and scale. The frontend just stores
// and round-trips whatever this endpoint returns, without needing to
// understand its internal structure.
exports.chat = async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ success:false, message:"AI assistant isn't configured yet. Add GEMINI_API_KEY to the backend .env." });
    }
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success:false, message:"messages array is required" });
    }

    let conversation = [...messages];
    let bookingResult = null; // surfaced to the frontend if a booking was actually made this turn

    // Agentic loop: the model may call several tools in sequence (search →
    // details → slots → book) before producing its final text reply.
    for (let turn = 0; turn < 6; turn++) {
      const response = await generateWithRetry({
        model: MODEL,
        contents: conversation,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: TOOLS }],
          maxOutputTokens: 1024,
        },
      });

      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const functionCalls = getFunctionCalls(parts);

      if (functionCalls.length === 0) {
        conversation.push({ role: "model", parts });
        return res.status(200).json({
          success: true,
          reply: getTextReply(parts) || "I'm not sure how to respond to that — could you rephrase?",
          messages: conversation,
          booking: bookingResult,
        });
      }

      conversation.push({ role: "model", parts });

      const responseParts = [];
      for (const call of functionCalls) {
        const result = await runTool(call.name, call.args || {}, req);
        if (call.name === "create_booking" && result.success) bookingResult = result;
        responseParts.push({ functionResponse: { name: call.name, response: result } });
      }
      conversation.push({ role: "user", parts: responseParts });
    }

    // Safety valve — shouldn't normally hit this many tool round-trips.
    res.status(200).json({ success:true, reply: "Let me know if you'd like to try that again — I got a bit stuck.", messages: conversation, booking: bookingResult });
  } catch (err) {
    console.error("ASSISTANT CHAT ERROR:", err);
    const isOverloaded = err.status === 503;
    const isTimeout = err.isTimeout;
    res.status(500).json({
      success: false,
      message: isTimeout
        ? "The assistant took too long to respond — please try again."
        : isOverloaded
        ? "Google's AI service is briefly overloaded right now — please try again in a few seconds."
        : "The assistant hit an error. Please try again.",
    });
  }
};