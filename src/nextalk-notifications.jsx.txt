// ─── Push Notifications + In-App Notification Center ──────────────────────────
import { useState, useEffect, useRef } from "react";

const C = {
  bg: "#060a14", surface: "#0d1321", card: "#111827",
  border: "#1e2d45", accent: "#00d4ff", accentDim: "#00d4ff15", accentGlow: "#00d4ff55",
  gold: "#ffd700", goldDim: "#ffd70015",
  green: "#00ff88", greenDim: "#00ff8815",
  red: "#ff3366", redDim: "#ff336615",
  purple: "#a855f7", purpleDim: "#a855f715",
  text: "#e2e8f0", muted: "#64748b",
};

// ─── Request Push Permission ──────────────────────────────────────────────────
export async function requestPushPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

// ─── Send Push Notification ───────────────────────────────────────────────────
export function sendPushNotification(title, body, options = {}) {
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && !options.force) return; // only when tab is hidden
  new Notification(title, {
    body,
    icon: "/public/favicon.svg",
    badge: "/public/favicon.svg",
    tag: options.tag || "nextalk",
    vibrate: [200, 100, 200],
    ...options,
  });
}

// ─── Save notification to Firebase ───────────────────────────────────────────
export async function saveNotification(uid, notif) {
  if (!window.firebase_ref || !window.firebase_set || !window._firebaseDB) return;
  const key = Date.now().toString();
  await window.firebase_set(
    window.firebase_ref(window._firebaseDB, `notifications/${uid}/${key}`),
    { ...notif, id: key, ts: Date.now(), read: false }
  );
}

// ─── Notification Bell Component ─────────────────────────────────────────────

export function NotificationBell({ currentUser }) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [permission, setPermission] = useState(Notification.permission || "default");
  const panelRef = useRef(null);

  const unread = notifs.filter(n => !n.read).length;

  useEffect(() => {
    // Load notifications from Firebase
    if (window.firebase_ref && window.firebase_onValue && window._firebaseDB && currentUser?.uid) {
      const ref = window.firebase_ref(window._firebaseDB, `notifications/${currentUser.uid}`);
      const unsub = window.firebase_onValue(ref, snap => {
        const data = snap.val() || {};
        const list = Object.values(data).sort((a, b) => b.ts - a.ts).slice(0, 50);
        setNotifs(list);
      });
      return () => unsub && unsub();
    } else {
      // Demo notifications
      setNotifs([
        { id: "1", type: "message", icon: "💬", title: "Ahmed Mohamed", body: "Hey! How are you?", ts: Date.now() - 300000, read: false },
        { id: "2", type: "premium", icon: "👑", title: "Premium Activated", body: "Sara Hassan upgraded to Premium", ts: Date.now() - 900000, read: false },
        { id: "3", type: "system", icon: "🔥", title: "NexTalk", body: "3 new users joined today!", ts: Date.now() - 3600000, read: true },
        { id: "4", type: "message", icon: "💬", title: "Nour Khaled", body: "NexTalk is amazing 🔥", ts: Date.now() - 7200000, read: true },
      ]);
    }
  }, [currentUser?.uid]);

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    if (window.firebase_ref && window._firebaseDB && currentUser?.uid) {
      const updates = {};
      notifs.forEach(n => { updates[`notifications/${currentUser.uid}/${n.id}/read`] = true; });
      await window.firebase_update(window.firebase_ref(window._firebaseDB, "/"), updates);
    }
  };

  const markRead = async (id) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    if (window.firebase_ref && window._firebaseDB && currentUser?.uid) {
      window.firebase_update(window.firebase_ref(window._firebaseDB, `notifications/${currentUser.uid}/${id}`), { read: true });
    }
  };

  const clearAll = async () => {
    setNotifs([]);
    if (window.firebase_ref && window._firebaseDB && currentUser?.uid) {
      window.firebase_set(window.firebase_ref(window._firebaseDB, `notifications/${currentUser.uid}`), null);
    }
  };

  const enablePush = async () => {
    const result = await requestPushPermission();
    setPermission(result);
  };

  const timeAgo = (ts) => {
    const d = Date.now() - ts;
    if (d < 60000) return "just now";
    if (d < 3600000) return Math.floor(d / 60000) + "m ago";
    if (d < 86400000) return Math.floor(d / 3600000) + "h ago";
    return Math.floor(d / 86400000) + "d ago";
  };

  const typeColor = (type) => {
    if (type === "message") return C.accent;
    if (type === "premium") return C.gold;
    if (type === "security") return C.red;
    return C.purple;
  };

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        style={{ position: "relative", background: open ? C.accentDim : "none", border: `1px solid ${open ? C.accent + "44" : "transparent"}`, borderRadius: 10, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, transition: "all 0.2s" }}
      >
        🔔
        {unread > 0 && (
          <div style={{ position: "absolute", top: -4, right: -4, background: C.red, color: "#fff", borderRadius: 10, padding: "1px 5px", fontSize: 9, fontWeight: 800, border: `2px solid ${C.surface}`, minWidth: 16, textAlign: "center" }}>{unread > 9 ? "9+" : unread}</div>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 340, maxHeight: 480,
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 18, overflow: "hidden",
          boxShadow: `0 16px 60px #00000088, 0 0 0 1px ${C.accentGlow}`,
          animation: "slideDown 0.2s ease", zIndex: 9999,
        }}>
          {/* Header */}
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surface }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>🔔 Notifications {unread > 0 && <span style={{ background: C.accent, color: "#000", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 800, marginLeft: 6 }}>{unread}</span>}</div>
            <div style={{ display: "flex", gap: 8 }}>
              {unread > 0 && <button onClick={markAllRead} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Mark all read</button>}
              {notifs.length > 0 && <button onClick={clearAll} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11 }}>Clear</button>}
            </div>
          </div>

          {/* Push permission banner */}
          {permission !== "granted" && (
            <div style={{ padding: "10px 16px", background: C.purpleDim, borderBottom: `1px solid ${C.purple}33`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>📲</span>
              <div style={{ flex: 1, fontSize: 11, color: C.muted }}>Enable push notifications to never miss a message</div>
              <button onClick={enablePush} style={{ background: `linear-gradient(135deg, ${C.purple}, #6d28d9)`, border: "none", borderRadius: 8, padding: "5px 10px", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Enable</button>
            </div>
          )}

          {/* Notifications list */}
          <div style={{ overflowY: "auto", maxHeight: 360 }}>
            {notifs.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 16px", color: C.muted }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
                <div style={{ fontSize: 13 }}>No notifications</div>
              </div>
            )}
            {notifs.map(n => (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "12px 16px", cursor: "pointer",
                  background: n.read ? "transparent" : `${typeColor(n.type)}08`,
                  borderBottom: `1px solid ${C.border}33`,
                  borderLeft: n.read ? "3px solid transparent" : `3px solid ${typeColor(n.type)}`,
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = `${C.accent}08`}
                onMouseLeave={e => e.currentTarget.style.background = n.read ? "transparent" : `${typeColor(n.type)}08`}
              >
                <div style={{ width: 38, height: 38, borderRadius: 12, background: `${typeColor(n.type)}15`, border: `1px solid ${typeColor(n.type)}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{n.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: n.read ? 500 : 700, fontSize: 13, marginBottom: 2 }}>{n.title}</div>
                  <div style={{ color: C.muted, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</div>
                  <div style={{ color: C.dim, fontSize: 10, marginTop: 3 }}>{timeAgo(n.ts)}</div>
                </div>
                {!n.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: typeColor(n.type), flexShrink: 0, marginTop: 4 }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
