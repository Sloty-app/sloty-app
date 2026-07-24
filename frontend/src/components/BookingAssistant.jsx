import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, Bot, User, CheckCircle, Ticket } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";
import { BottomSheet } from "./UI";

/** Extracts plain display text from an assistant message's content,
 *  which may be a string (older turns) or an array of content blocks
 *  (text + tool_use mixed together, from the Anthropic API shape). */
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter(b => b.type === "text").map(b => b.text).join(" ");
  }
  return "";
}

const SUGGESTIONS = [
  "Book a haircut for tomorrow",
  "I need a dentist this week",
  "Find a bike mechanic near me",
];

export default function BookingAssistant({ open, onClose }) {
  const [messages, setMessages] = useState([]); // raw Anthropic-shaped history sent back to the backend each turn
  const [displayMessages, setDisplayMessages] = useState([]); // simplified {role, text} for rendering
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookingDone, setBookingDone] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [displayMessages, loading]);

  useEffect(() => {
    if (open && displayMessages.length === 0) {
      setDisplayMessages([{ role: "assistant", text: "Hi! I can help you book a slot — just tell me what service you need and when. 😊" }]);
    }
  }, [open]);

  const send = async (text) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setInput("");
    setDisplayMessages(prev => [...prev, { role: "user", text: userText }]);
    setLoading(true);

    const nextMessages = [...messages, { role: "user", parts: [{ text: userText }] }];
    try {
      const res = await api("POST", "/assistant/chat", { messages: nextMessages });
      setMessages(res.messages || nextMessages);
      setDisplayMessages(prev => [...prev, { role: "assistant", text: res.reply || "..." }]);
      if (res.booking) setBookingDone(res.booking);
    } catch (e) {
      setDisplayMessages(prev => [...prev, { role: "assistant", text: e.message || "Sorry, I hit an error there. Could you try again?" }]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setDisplayMessages([{ role: "assistant", text: "Hi! I can help you book a slot — just tell me what service you need and when. 😊" }]);
    setBookingDone(null);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="">
      <div style={{ display:"flex", flexDirection:"column", height:"70vh", maxHeight:600 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:12, background:`linear-gradient(100deg,${C.pri},#DB2777)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize:14, fontWeight:900, color:C.text }}>Sloty Assistant</p>
              <p style={{ fontSize:10, color:C.muted }}>Book by chatting</p>
            </div>
          </div>
          {displayMessages.length > 1 && (
            <button onClick={reset} style={{ fontSize:11, color:C.muted, background:"none", border:"none", cursor:"pointer", fontWeight:700, fontFamily:"'Nunito',sans-serif" }}>
              New chat
            </button>
          )}
        </div>

        <div ref={scrollRef} style={{ flex:1, overflowY:"auto", paddingRight:2 }}>
          {displayMessages.map((m, i) => (
            <div key={i} style={{ display:"flex", gap:8, marginBottom:14, alignItems:"flex-start", flexDirection: m.role==="user" ? "row-reverse" : "row" }}>
              <div style={{ width:26, height:26, borderRadius:9, background: m.role==="user" ? C.sec : C.pri+"18", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {m.role==="user" ? <User size={13} color="#fff" /> : <Bot size={13} color={C.pri} />}
              </div>
              <div style={{
                maxWidth:"78%", padding:"10px 14px", borderRadius: m.role==="user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: m.role==="user" ? C.sec : "#F0F2F8", color: m.role==="user" ? "#fff" : C.text,
                fontSize:13, lineHeight:1.5,
              }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
              <div style={{ width:26, height:26, borderRadius:9, background:C.pri+"18", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Bot size={13} color={C.pri} />
              </div>
              <div style={{ padding:"10px 14px", borderRadius:"16px 16px 16px 4px", background:"#F0F2F8", display:"flex", gap:4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:C.muted, animation:`pulse 1s ${i*0.15}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          {bookingDone && (
            <div style={{ background:`linear-gradient(100deg,${C.pri}12,${C.pri}06)`, border:`1.5px solid ${C.pri}33`, borderRadius:16, padding:"14px 16px", marginBottom:14, textAlign:"center" }}>
              <CheckCircle size={22} color={C.green} style={{ marginBottom:6 }} />
              <p style={{ fontSize:13, fontWeight:800, color:C.text, marginBottom:6 }}>Booked at {bookingDone.storeName}!</p>
              <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.sec, borderRadius:10, padding:"6px 14px" }}>
                <Ticket size={13} color="#fff" />
                <span style={{ color:"#fff", fontWeight:900, fontSize:14 }}>{bookingDone.tokenNumber}</span>
              </div>
              <p style={{ fontSize:11, color:C.muted, marginTop:8 }}>Check My Bookings for your OTP</p>
            </div>
          )}
        </div>

        {displayMessages.length <= 1 && !loading && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10, flexShrink:0 }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)} style={{ padding:"7px 12px", borderRadius:20, border:`1.5px solid ${C.pri}33`, background:C.pri+"08", color:C.pri, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div style={{ display:"flex", gap:8, flexShrink:0, paddingTop:8, borderTop:"1px solid #F0F2F8" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Type a message..."
            disabled={loading}
            style={{ flex:1, padding:"12px 16px", border:"2px solid #E8ECF5", borderRadius:24, fontSize:13, outline:"none", fontFamily:"'Nunito',sans-serif", background:"#FAFBFF" }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} style={{ width:42, height:42, borderRadius:"50%", border:"none", background: loading||!input.trim() ? "#E0E4EF" : `linear-gradient(100deg,${C.pri},#DB2777)`, display:"flex", alignItems:"center", justifyContent:"center", cursor: loading||!input.trim() ? "not-allowed" : "pointer", flexShrink:0 }}>
            <Send size={16} color="#fff" />
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}