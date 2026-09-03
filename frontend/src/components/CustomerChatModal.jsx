import { useState, useEffect, useRef } from "react";
import { C } from "../constants";
import { api } from "../api";
import { BottomSheet } from "./UI";
import ChatScreen from "./ChatScreen";
import { getSocket } from "../utils/socket";

/**
 * Customer-side chat — fetches/sends messages for one conversation with
 * a specific store, hosted inside a BottomSheet. Opened from the Store
 * Detail page's "Message" button.
 *
 * Reliability design: a short polling interval is the GUARANTEED
 * delivery mechanism — messages will always show up within a few
 * seconds no matter what, regardless of any Socket.io connection
 * quirk. The socket listener is kept as a bonus for near-instant
 * updates when it's working, but nothing here depends on it being
 * perfectly reliable. State (and the resulting scroll-to-bottom) is
 * only updated when the fetched data has actually changed — comparing
 * the last message's id/timestamp and total count — so a poll that
 * comes back identical never touches state and never triggers a scroll.
 */
export default function CustomerChatModal({ open, onClose, store }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const lastSignatureRef = useRef(""); // "<count>:<lastMessageId>" of what's currently shown

  const signatureOf = (msgs) => `${msgs.length}:${msgs[msgs.length-1]?._id || ""}`;

  const fetchThread = async (isInitial = false) => {
    if (!store?._id) return;
    if (isInitial) setLoading(true);
    try {
      const res = await api("GET", `/chat/${store._id}`);
      const fresh = res.conversation?.messages || [];
      const sig = signatureOf(fresh);
      // Only update state (and thus only trigger ChatScreen's
      // scroll-to-bottom effect) if something genuinely changed.
      if (sig !== lastSignatureRef.current) {
        lastSignatureRef.current = sig;
        setMessages(fresh);
      }
    } catch (e) { console.error("fetchThread failed:", e.message); }
    finally { if (isInitial) setLoading(false); }
  };

  useEffect(() => {
    if (!open) return;
    lastSignatureRef.current = ""; // reset so the first fetch always applies
    fetchThread(true);
  }, [open, store?._id]);

  // Safety-net fallback — polls every 3s while the chat is open. Chat is
  // the one place where delivery lag is directly felt by two people
  // mid-conversation, so this stays fast even though the socket (see
  // utils/socket.js) is now a reliable real websocket and handles the
  // common case instantly on its own — this interval only matters when
  // that socket event is missed, and even then the gap shouldn't be
  // noticeable.
  useEffect(() => {
    if (!open || !store?._id) return;
    const interval = setInterval(() => fetchThread(false), 3000);
    return () => clearInterval(interval);
  }, [open, store?._id]);

  // Socket-based instant update — the primary delivery path. The
  // polling above is just a backstop in case an event is missed.
  useEffect(() => {
    if (!open || !store?._id) return;
    const socket = getSocket();
    socket.off("chat:message");
    const onMessage = () => fetchThread(false);
    socket.on("chat:message", onMessage);
    return () => socket.off("chat:message", onMessage);
  }, [open, store?._id]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    try {
      const res = await api("POST", `/chat/${store._id}`, { text });
      const fresh = res.conversation?.messages || [];
      lastSignatureRef.current = signatureOf(fresh);
      setMessages(fresh);
    } catch (e) { console.error("send failed:", e.message); }
    finally { setSending(false); }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="">
      <div style={{ height:"65vh", maxHeight:560, display:"flex", flexDirection:"column" }}>
        <div style={{ marginBottom:10, flexShrink:0 }}>
          <p style={{ fontSize:15, fontWeight:900, color:C.text }}>{store?.name}</p>
          <p style={{ fontSize:11, color:C.muted }}>Message the store directly</p>
        </div>
        <ChatScreen
          messages={messages}
          myRole="customer"
          input={input}
          setInput={setInput}
          onSend={send}
          loading={loading}
          sending={sending}
          emptyLabel="Ask about parking, timing, or anything else before you book"
        />
      </div>
    </BottomSheet>
  );
}