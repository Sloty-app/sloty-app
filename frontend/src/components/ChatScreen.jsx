import { useEffect, useRef } from "react";
import { Send, MessageCircle } from "lucide-react";
import { C } from "../constants";

/**
 * Presentational chat thread — pure UI, no data fetching. Used by both
 * the customer-side modal and the owner-side Messages tab, with the
 * actual fetch/send logic living in each of those wrappers.
 */
export default function ChatScreen({ messages, myRole, input, setInput, onSend, loading, sending, emptyLabel }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div ref={scrollRef} style={{ flex:1, overflowY:"auto", padding:"4px 2px" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:"40px 0" }}>
            <div style={{ width:32, height:32, border:`3px solid ${C.pri}22`, borderTop:`3px solid ${C.pri}`, borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto" }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign:"center", padding:"50px 20px" }}>
            <div style={{ width:56, height:56, borderRadius:18, background:C.pri+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
              <MessageCircle size={24} color={C.pri} />
            </div>
            <p style={{ fontSize:13, color:C.muted, fontWeight:700 }}>{emptyLabel || "Say hello — start the conversation"}</p>
          </div>
        ) : messages.map((m, i) => {
          const isMine = m.senderRole === myRole;
          return (
            <div key={i} style={{ display:"flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom:10 }}>
              <div style={{
                maxWidth:"75%", padding:"10px 14px",
                borderRadius: isMine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: isMine ? C.pri : "#F0F2F8",
                color: isMine ? "#fff" : C.text,
                fontSize:13, lineHeight:1.5,
              }}>
                {m.text}
                <div style={{ fontSize:9, marginTop:4, opacity:0.7, textAlign:"right" }}>
                  {new Date(m.createdAt).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display:"flex", gap:8, paddingTop:10, borderTop:"1px solid #F0F2F8", flexShrink:0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !sending && onSend()}
          placeholder="Type a message..."
          disabled={sending}
          style={{ flex:1, padding:"12px 16px", border:"2px solid #E8ECF5", borderRadius:24, fontSize:13, outline:"none", fontFamily:"'Nunito',sans-serif", background:"#FAFBFF" }}
        />
        <button
          onClick={onSend}
          disabled={sending || !input.trim()}
          style={{ width:42, height:42, borderRadius:"50%", border:"none", background: (sending||!input.trim()) ? "#E0E4EF" : C.pri, display:"flex", alignItems:"center", justifyContent:"center", cursor: (sending||!input.trim()) ? "not-allowed" : "pointer", flexShrink:0 }}
        >
          <Send size={16} color="#fff" />
        </button>
      </div>
    </div>
  );
}