import { useState, useEffect, useRef } from "react";
import { MessageCircle, ArrowLeft, User } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";
import ChatScreen from "./ChatScreen";
import { getSocket } from "../utils/socket";

/**
 * Owner-side Messages tab — list of every customer conversation across
 * the owner's store(s), tap one to open the thread.
 *
 * `activeId`/`setActiveId` are accepted as props so the parent
 * (OwnerApp) can hold this state — since OwnerMessages is conditionally
 * rendered per-tab, it fully unmounts when switching to another tab,
 * which would otherwise reset "which conversation is open" every time
 * you navigate away and back. Falls back to local state if no props
 * are passed, so this still works as a standalone component elsewhere.
 *
 * Reliability design: a short polling interval is the GUARANTEED
 * delivery mechanism for both the conversation list and the open
 * thread — messages will always show up within a few seconds no
 * matter what, regardless of any Socket.io connection quirk. The
 * socket listener is kept as a bonus for near-instant updates when
 * it's working, but nothing depends on it being perfectly reliable.
 * Thread state (and the resulting scroll-to-bottom) only updates when
 * the fetched data has actually changed, so a poll that comes back
 * identical never triggers an unnecessary re-render or scroll.
 */
export default function OwnerMessages({ activeId: activeIdProp, setActiveId: setActiveIdProp } = {}) {
  const [conversations, setConversations] = useState([]);
  const [listLoading,   setListLoading]   = useState(true);
  const [activeIdLocal, setActiveIdLocal] = useState(null);
  const activeId    = activeIdProp !== undefined ? activeIdProp : activeIdLocal;
  const setActiveId = setActiveIdProp || setActiveIdLocal;
  const [messages,      setMessages]      = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [input,         setInput]         = useState("");
  const [sending,       setSending]       = useState(false);
  const lastSignatureRef = useRef(""); // "<count>:<lastMessageId>" of the currently-shown thread

  const signatureOf = (msgs) => `${msgs.length}:${msgs[msgs.length-1]?._id || ""}`;

  const fetchList = async () => {
    try {
      const res = await api("GET", "/chat/owner/conversations");
      setConversations(res.conversations || []);
    } catch (e) { console.error("fetchList failed:", e.message); }
    finally { setListLoading(false); }
  };

  // `isExplicitOpen` = true only when the owner actually taps a
  // conversation (shows the loading spinner, resets the signature so
  // the fresh thread always applies). Background polling passes false
  // so it can silently update without flicker.
  const openThread = async (conversationId, isExplicitOpen = true) => {
    if (isExplicitOpen) {
      setActiveId(conversationId);
      setThreadLoading(true);
      lastSignatureRef.current = "";
    }
    try {
      const res = await api("GET", `/chat/owner/conversations/${conversationId}`);
      const fresh = res.conversation?.messages || [];
      const sig = signatureOf(fresh);
      if (sig !== lastSignatureRef.current) {
        lastSignatureRef.current = sig;
        setMessages(fresh);
      }
      if (isExplicitOpen) fetchList(); // refresh unread badges in the list
    } catch (e) { console.error("openThread failed:", e.message); }
    finally { if (isExplicitOpen) setThreadLoading(false); }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !activeId) return;
    setInput("");
    setSending(true);
    try {
      const res = await api("POST", `/chat/owner/conversations/${activeId}`, { text });
      const fresh = res.conversation?.messages || [];
      lastSignatureRef.current = signatureOf(fresh);
      setMessages(fresh);
    } catch (e) { console.error("send failed:", e.message); }
    finally { setSending(false); }
  };

  useEffect(() => { fetchList(); }, []);

  // If activeId was already set (e.g., the owner had a conversation
  // open, switched to another tab, then came back), the conversation
  // list persists via the lifted state, but this component's own
  // `messages` state was reset on remount — reload the thread content
  // so the conversation doesn't appear open-but-empty.
  useEffect(() => {
    if (activeId) openThread(activeId, true);
  }, []); // deliberately once on mount only

  // Guaranteed fallback — polls the list every 4s, and the active
  // thread (if one is open) every 3s. This is the primary reliability
  // mechanism; the socket listener below is purely a speed bonus.
  useEffect(() => {
    const listInterval = setInterval(fetchList, 4000);
    return () => clearInterval(listInterval);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const threadInterval = setInterval(() => openThread(activeId, false), 3000);
    return () => clearInterval(threadInterval);
  }, [activeId]);

  // Socket-based instant update — best-effort only. Even if this never
  // fires (dropped connection, blocked WebSocket, etc.), the polling
  // above still guarantees delivery within a few seconds.
  useEffect(() => {
    const socket = getSocket();
    socket.off("chat:message");
    const onMessage = () => {
      fetchList();
      if (activeId) openThread(activeId, false);
    };
    socket.on("chat:message", onMessage);
    return () => socket.off("chat:message", onMessage);
  }, [activeId]);

  const activeConvo = conversations.find(c => c._id === activeId);

  if (activeId) {
    return (
      <div style={{ height:"calc(100vh - 220px)", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexShrink:0 }}>
          <button onClick={() => setActiveId(null)} style={{ background:C.pri+"12", border:"none", borderRadius:10, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <ArrowLeft size={15} color={C.pri} />
          </button>
          <div style={{ width:32, height:32, borderRadius:"50%", background:C.sec, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <User size={14} color="#fff" />
          </div>
          <p style={{ fontSize:14, fontWeight:900, color:C.text }}>{activeConvo?.customerName || "Customer"}</p>
        </div>
        <ChatScreen
          messages={messages}
          myRole="owner"
          input={input}
          setInput={setInput}
          onSend={send}
          loading={threadLoading}
          sending={sending}
        />
      </div>
    );
  }

  return (
    <div>
      {listLoading ? (
        <div style={{ textAlign:"center", padding:"40px 0" }}>
          <div style={{ width:32, height:32, border:`3px solid ${C.pri}22`, borderTop:`3px solid ${C.pri}`, borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto" }} />
        </div>
      ) : conversations.length === 0 ? (
        <div style={{ textAlign:"center", padding:"50px 20px" }}>
          <div style={{ width:56, height:56, borderRadius:18, background:C.pri+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
            <MessageCircle size={24} color={C.pri} />
          </div>
          <p style={{ fontSize:13, color:C.muted, fontWeight:700 }}>No messages yet</p>
          <p style={{ fontSize:11, color:C.muted, marginTop:4 }}>Customer questions will show up here</p>
        </div>
      ) : conversations.map(c => (
        <div key={c._id} onClick={() => openThread(c._id, true)} style={{ background:C.card, borderRadius:16, padding:"14px 16px", marginBottom:10, display:"flex", alignItems:"center", gap:12, cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:C.sec, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <User size={17} color="#fff" />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <p style={{ fontSize:13, fontWeight:800, color:C.text }}>{c.customerName}</p>
              <p style={{ fontSize:10, color:C.muted }}>{new Date(c.lastMessageAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</p>
            </div>
            <p style={{ fontSize:12, color:C.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.lastMessageText}</p>
          </div>
          {c.ownerUnread > 0 && (
            <div style={{ minWidth:20, height:20, borderRadius:10, background:C.pri, color:"#fff", fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 6px", flexShrink:0 }}>
              {c.ownerUnread}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}