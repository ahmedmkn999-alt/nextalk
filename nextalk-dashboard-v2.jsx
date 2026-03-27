import { useState, useEffect, useRef } from "react";
import { useTranslation, LANGUAGES } from "./i18n";
import {
  generateTOTPSecret,
  getTOTPQRUrl,
  getActiveSessions,
  terminateSession,
  terminateAllOtherSessions,
  generateBackupCodes,
  getDeviceFingerprint,
} from "./security";
import ChatScreen from "./nextalk-chat";
import { NotificationBell, saveNotification, sendPushNotification } from "./nextalk-notifications";
import ProfileModal from "./nextalk-profile";

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#060a14",
  surface: "#0d1321",
  card: "#111827",
  cardHover: "#151e30",
  border: "#1e2d45",
  borderGlow: "#00d4ff18",
  accent: "#00d4ff",
  accentDim: "#00d4ff15",
  accentGlow: "#00d4ff55",
  gold: "#ffd700",
  goldDim: "#ffd70015",
  goldGlow: "#ffd70044",
  green: "#00ff88",
  greenDim: "#00ff8815",
  red: "#ff3366",
  redDim: "#ff336615",
  purple: "#a855f7",
  purpleDim: "#a855f715",
  orange: "#ff8c00",
  orangeDim: "#ff8c0015",
  text: "#e2e8f0",
  muted: "#64748b",
  dim: "#334155",
};

const BADGES = ["⭐", "💎", "🔥", "👑", "⚡", "🎯", "🏆", "💫", "🌟", "🦁", "🐉", "🌈", "🚀", "💜", "🎪"];

// ─── Particle Mini BG ──────────────────────────────────────────────────────────
function MiniParticles() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = canvas.width = canvas.offsetWidth;
    let h = canvas.height = canvas.offsetHeight;
    const pts = Array.from({ length: 30 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() * 1 + 0.3,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,212,255,0.4)";
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ title, value, sub, color, icon, trend, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? C.cardHover : C.card,
        border: `1px solid ${hov ? color + "55" : C.border}`,
        borderRadius: 18, padding: 22, flex: 1, minWidth: 160,
        position: "relative", overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.25s",
        transform: hov ? "translateY(-5px)" : "translateY(0)",
        boxShadow: hov ? `0 16px 48px ${color}22, 0 0 0 1px ${color}22` : "none",
      }}
    >
      <div style={{ position: "absolute", top: -30, right: -30, fontSize: 110, opacity: 0.04, pointerEvents: "none" }}>{icon}</div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, ${color}44, transparent)`, transition: "opacity 0.25s", opacity: hov ? 1 : 0.6 }} />
      <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
      <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, fontWeight: 700, marginBottom: 6, fontFamily: "monospace" }}>{title}</div>
      <div style={{ color, fontSize: 32, fontWeight: 900, fontFamily: "monospace", letterSpacing: -1, marginBottom: 4 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {trend && <span style={{ color: trend > 0 ? C.green : C.red, fontSize: 11, fontWeight: 700 }}>{trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%</span>}
        {sub && <span style={{ color: C.muted, fontSize: 11 }}>{sub}</span>}
      </div>
    </div>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, gradient = `linear-gradient(135deg, ${C.accent}, ${C.purple})` }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: size * 0.42, color: "#000", flexShrink: 0,
      boxShadow: `0 0 12px ${C.accentGlow}44`,
    }}>{(name || "U").charAt(0).toUpperCase()}</div>
  );
}

// ─── Status Dot ────────────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const color = status === "online" ? C.green : status === "away" ? C.gold : C.dim;
  return (
    <div style={{
      width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0,
      boxShadow: status === "online" ? `0 0 8px ${C.green}` : "none",
    }} />
  );
}

// ─── Notif Toast ───────────────────────────────────────────────────────────────
function NotifToast({ notif }) {
  if (!notif) return null;
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 99999,
      background: C.card, border: `1px solid ${notif.color}44`,
      borderRadius: 14, padding: "14px 20px",
      color: notif.color, fontWeight: 700, fontSize: 14,
      boxShadow: `0 8px 40px ${notif.color}33`,
      animation: "slideIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      display: "flex", alignItems: "center", gap: 10,
      backdropFilter: "blur(20px)",
    }}>
      <span style={{ fontSize: 18 }}>✓</span> {notif.msg}
    </div>
  );
}

// ─── Badge Modal ───────────────────────────────────────────────────────────────
function BadgeModal({ onAssign, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div style={{
        background: C.card, border: `1px solid ${C.gold}44`,
        borderRadius: 24, padding: "28px 24px", maxWidth: 360, width: "90%",
        boxShadow: `0 0 80px ${C.goldGlow}`,
        animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ color: C.gold, fontWeight: 900, fontSize: 18, marginBottom: 20, textAlign: "center", letterSpacing: 2 }}>
          👑 CHOOSE BADGE
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {BADGES.map(b => (
            <button key={b} onClick={() => onAssign(b)} style={{
              background: C.surface, border: `2px solid ${C.border}`, borderRadius: 14,
              padding: "12px 4px", fontSize: 24, cursor: "pointer", transition: "all 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.transform = "scale(1.2)"; e.currentTarget.style.boxShadow = `0 0 16px ${C.goldGlow}`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
            >{b}</button>
          ))}
        </div>
        <button onClick={onClose} style={{ width: "100%", marginTop: 16, padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 13 }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Security Tab ──────────────────────────────────────────────────────────────
function SecurityTab({ currentUser, notify }) {
  const [sessions, setSessions] = useState(getActiveSessions());
  const [showQR, setShowQR] = useState(false);
  const [totpSecret, setTotpSecret] = useState(null);
  const [backupCodes, setBackupCodes] = useState([]);
  const [enabling2FA, setEnabling2FA] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const fp = getDeviceFingerprint();

  const setup2FA = async () => {
    const secret = await generateTOTPSecret();
    const codes = generateBackupCodes(8);
    setTotpSecret(secret);
    setBackupCodes(codes);
    setEnabling2FA(true);
    setShowQR(true);
  };

  const confirm2FA = async () => {
    const { verifyTOTP } = await import("./security");
    const valid = await verifyTOTP(totpSecret, verifyCode);
    if (valid) {
      if (window.firebase_ref && window.firebase_update && window.firebase_get) {
        await window.firebase_update(window.firebase_ref(window._firebaseDB, `users/${currentUser.uid}/twoFA`), {
          enabled: true, secret: totpSecret, backupCodes,
        });
      }
      setShowQR(false); setEnabling2FA(false);
      notify("✅ Two-Factor Auth enabled successfully!", C.green);
    } else {
      notify("❌ Invalid code. Check your authenticator app.", C.red);
    }
  };

  const revokeSession = (id) => {
    terminateSession(id);
    setSessions(getActiveSessions());
    notify("Session terminated.", C.orange);
  };

  const revokeAllOthers = () => {
    terminateAllOtherSessions(fp);
    setSessions(getActiveSessions());
    notify("All other sessions terminated!", C.red);
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, color: C.accent, letterSpacing: 1 }}>🔒 Security Center</div>

      {/* 2FA Section */}
      <div style={{
        background: C.card, border: `1px solid ${C.purple}33`,
        borderRadius: 18, padding: 24, marginBottom: 20,
        boxShadow: `0 0 40px ${C.purple}11`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>🔐</span> Two-Factor Authentication
            </div>
            <div style={{ color: C.muted, fontSize: 13 }}>Extra layer of protection beyond just a phone number</div>
          </div>
          {!currentUser.twoFA?.enabled && !enabling2FA && (
            <button onClick={setup2FA} style={{
              background: `linear-gradient(135deg, ${C.purple}, #6d28d9)`,
              border: "none", borderRadius: 12, padding: "10px 18px",
              color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13,
              boxShadow: `0 4px 20px ${C.purple}44`,
            }}>Enable 2FA</button>
          )}
          {currentUser.twoFA?.enabled && (
            <div style={{ background: C.greenDim, border: `1px solid ${C.green}44`, borderRadius: 10, padding: "6px 14px", color: C.green, fontWeight: 700, fontSize: 12 }}>✓ ACTIVE</div>
          )}
        </div>

        {/* Features list */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { icon: "📱", text: "TOTP Authenticator App" },
            { icon: "🔑", text: "8 Backup Recovery Codes" },
            { icon: "🌍", text: "Device Fingerprinting" },
            { icon: "🚫", text: "Rate Limiting (5 attempts)" },
          ].map(f => (
            <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 8, color: C.muted, fontSize: 12 }}>
              <span>{f.icon}</span> {f.text}
            </div>
          ))}
        </div>

        {/* QR Setup */}
        {showQR && totpSecret && (
          <div style={{ marginTop: 20, padding: 20, background: C.surface, borderRadius: 14, border: `1px solid ${C.purple}44`, textAlign: "center" }}>
            <div style={{ fontWeight: 700, color: C.purple, marginBottom: 12, fontSize: 13, letterSpacing: 1 }}>
              SCAN WITH YOUR AUTHENTICATOR APP
            </div>
            <img src={getTOTPQRUrl(totpSecret, currentUser.phone)} alt="QR Code" style={{ width: 180, height: 180, borderRadius: 12, background: "#fff", padding: 8 }} />
            <div style={{ marginTop: 12, fontFamily: "monospace", fontSize: 12, color: C.muted, wordBreak: "break-all", padding: "8px 12px", background: C.card, borderRadius: 8 }}>
              {totpSecret}
            </div>
            <div style={{ marginTop: 16, marginBottom: 8, color: C.muted, fontSize: 12 }}>Enter the 6-digit code to verify:</div>
            <input
              value={verifyCode}
              onChange={e => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 16px", color: C.text, fontSize: 18, textAlign: "center", letterSpacing: 8, fontFamily: "monospace", outline: "none", width: "100%", marginBottom: 12, boxSizing: "border-box" }}
            />
            <button onClick={confirm2FA} style={{
              width: "100%", padding: "12px", borderRadius: 10, border: "none",
              background: `linear-gradient(135deg, ${C.purple}, #6d28d9)`,
              color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14,
            }}>✓ Activate 2FA</button>

            {backupCodes.length > 0 && (
              <div style={{ marginTop: 16, padding: 16, background: C.card, borderRadius: 12, border: `1px solid ${C.gold}33` }}>
                <div style={{ color: C.gold, fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: 1 }}>⚠️ SAVE THESE BACKUP CODES (ONE-TIME USE)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {backupCodes.map((code, i) => (
                    <div key={i} style={{ fontFamily: "monospace", fontSize: 12, color: C.text, background: C.surface, padding: "6px 10px", borderRadius: 6, letterSpacing: 1 }}>
                      {i + 1}. {code.slice(0, 5)}-{code.slice(5)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Device Sessions */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
            <span>📱</span> Active Sessions
          </div>
          <button onClick={revokeAllOthers} style={{
            background: C.redDim, border: `1px solid ${C.red}44`, borderRadius: 10,
            padding: "8px 14px", color: C.red, cursor: "pointer", fontSize: 12, fontWeight: 700,
          }}>Terminate All Others</button>
        </div>

        {sessions.length === 0 ? (
          <div style={{ color: C.muted, textAlign: "center", padding: 20 }}>No active sessions found</div>
        ) : sessions.map(s => (
          <div key={s.id} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "14px 0",
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: s.fingerprint === fp ? C.accentDim : C.surface, border: `1px solid ${s.fingerprint === fp ? C.accent : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
              {s.deviceName?.includes("iPhone") || s.deviceName?.includes("Android") ? "📱" : "💻"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                {s.deviceName}
                {s.fingerprint === fp && <span style={{ background: C.accentDim, color: C.accent, fontSize: 10, padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>CURRENT</span>}
              </div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                🌍 {s.location} · 🕐 {new Date(s.lastActive).toLocaleDateString()}
              </div>
            </div>
            {s.fingerprint !== fp && (
              <button onClick={() => revokeSession(s.id)} style={{
                background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 8,
                padding: "6px 12px", color: C.red, cursor: "pointer", fontSize: 11, fontWeight: 700,
              }}>Revoke</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function NexTalkDashboard({ currentUser, lang = "en", onLogout }) {
  const t = useTranslation(lang);
  const langObj = LANGUAGES.find(l => l.code === lang) || LANGUAGES[1];

  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [badgeModal, setBadgeModal] = useState(null);
  const [notif, setNotif] = useState(null);
  const [time, setTime] = useState(new Date());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState(currentUser);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (window.firebase_ref && window.firebase_onValue && window._firebaseDB) {
      const ref = window.firebase_ref(window._firebaseDB, "users");
      window.firebase_onValue(ref, snap => {
        const data = snap.val() || {};
        setUsers(Object.values(data));
      });
    } else {
      setUsers([
        { uid: "1", name: "Ahmed Mohamed", phone: "+201128381838", username: "@Ahmedddd50", premium: true, badge: "👑", status: "online", joinedAt: "2024-01-15", isAdmin: true },
        { uid: "2", name: "Sara Hassan", phone: "+201002345678", username: "@sara_h", premium: true, badge: "💎", status: "online", joinedAt: "2024-02-20" },
        { uid: "3", name: "Mohamed Ali", phone: "+201113456789", username: "@moh_ali", premium: false, badge: null, status: "away", joinedAt: "2024-03-05" },
        { uid: "4", name: "Nour Khaled", phone: "+201204567890", username: "@nour_k", premium: true, badge: "🔥", status: "offline", joinedAt: "2024-03-18" },
        { uid: "5", name: "Omar Farouk", phone: "+201155678901", username: "@omar_f", premium: false, badge: null, status: "online", joinedAt: "2024-04-01" },
        { uid: "6", name: "Layla Ibrahim", phone: "+201096789012", username: "@layla_i", premium: true, badge: "⭐", status: "online", joinedAt: "2024-04-10" },
        { uid: "7", name: "Karim Samy", phone: "+201227890123", username: "@karim_s", premium: false, badge: null, status: "offline", joinedAt: "2024-04-22" },
        { uid: "8", name: "Dina Magdy", phone: "+201018901234", username: "@dina_m", premium: true, badge: "⚡", status: "away", joinedAt: "2024-05-01" },
      ]);
    }
  }, []);

  // Save push notification when new user joins
  useEffect(() => {
    if (users.length > 0) setTotalUnread(0); // reset on load
  }, []);

  const handleUserUpdate = (updated) => {
    setUser(updated);
  };

  const notify = (msg, color = C.green) => {
    setNotif({ msg, color });
    setTimeout(() => setNotif(null), 3000);
  };

  const togglePremium = async (uid) => {
    const user = users.find(u => u.uid === uid);
    if (!user) return;
    const updated = { ...user, premium: !user.premium, badge: !user.premium ? "⭐" : null };
    setUsers(prev => prev.map(u => u.uid === uid ? updated : u));
    if (window.firebase_ref && window.firebase_update && window._firebaseDB) {
      await window.firebase_update(window.firebase_ref(window._firebaseDB, `users/${uid}`), { premium: updated.premium, badge: updated.badge });
    }
    notify(`${user.name} ${user.premium ? "removed from" : "upgraded to"} Premium!`, user.premium ? C.red : C.gold);
  };

  const assignBadge = async (badge) => {
    const user = users.find(u => u.uid === badgeModal);
    if (!user) return;
    setUsers(prev => prev.map(u => u.uid === badgeModal ? { ...u, badge, premium: true } : u));
    if (window.firebase_ref && window.firebase_update && window._firebaseDB) {
      await window.firebase_update(window.firebase_ref(window._firebaseDB, `users/${badgeModal}`), { badge, premium: true });
    }
    setBadgeModal(null);
    notify(`${badge} assigned to ${user.name}!`, C.gold);
  };

  const filteredUsers = users.filter(u => {
    const s = search.toLowerCase();
    const match = (u.name || "").toLowerCase().includes(s) || (u.username || "").includes(s) || (u.phone || "").includes(s);
    const f = filter === "all" || (filter === "premium" && u.premium) || (filter === "free" && !u.premium) || (filter === "online" && u.status === "online");
    return match && f;
  });

  const premiumCount = users.filter(u => u.premium).length;
  const onlineCount = users.filter(u => u.status === "online").length;
  const totalRevenue = users.filter(u => u.premium).length * 49.99;

  const TABS = [
    { id: "overview", icon: "📊", label: t("overview") },
    { id: "chat", icon: "💬", label: "Chat", badge: totalUnread || null },
    { id: "users", icon: "👥", label: t("users"), badge: users.length },
    { id: "bots", icon: "🤖", label: t("bots") },
    { id: "marketing", icon: "💰", label: t("marketing") },
    { id: "security", icon: "🔒", label: t("security") },
    { id: "settings", icon: "⚙️", label: t("settings") },
  ];

  const SIDEBAR_W = sidebarCollapsed ? 60 : 220;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", flexDirection: "column", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", direction: langObj.dir || "ltr" }}>
      <NotifToast notif={notif} />
      {badgeModal && <BadgeModal onAssign={assignBadge} onClose={() => setBadgeModal(null)} />}
      {showProfile && <ProfileModal currentUser={user} onUpdate={handleUserUpdate} onClose={() => setShowProfile(false)} />}

      {/* Top Bar */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 56, position: "sticky", top: 0, zIndex: 200,
        boxShadow: `0 2px 30px #00000055`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Hamburger for mobile */}
          {isMobile && (
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20, padding: 4 }}>☰</button>
          )}
          {!isMobile && (
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, padding: 4, opacity: 0.7 }}>◀</button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.accent}, #0066ff)`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
              boxShadow: `0 0 16px ${C.accentGlow}`,
            }}>💬</div>
            {!isMobile && <div style={{ fontWeight: 900, color: C.accent, letterSpacing: 3, fontSize: 15 }}>NEX<span style={{ color: C.text }}>TALK</span></div>}
          </div>
        </div>

        {/* Center: Live clock + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: C.greenDim, border: `1px solid ${C.green}33`, borderRadius: 20, padding: "4px 12px", fontSize: 11, color: C.green, fontWeight: 700, fontFamily: "monospace" }}>
            ● LIVE · {onlineCount} online
          </div>
          {!isMobile && (
            <div style={{ fontFamily: "monospace", fontSize: 13, color: C.muted }}>
              {time.toLocaleTimeString(lang, { hour12: false })}
            </div>
          )}
        </div>

        {/* Right: Notifications + User + Logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NotificationBell currentUser={user} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setShowProfile(true)}>
            {user.photoURL
              ? <img src={user.photoURL} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.accent}` }} />
              : <Avatar name={user.name} size={30} />
            }
            {!isMobile && <div style={{ fontSize: 13, fontWeight: 600, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>}
          </div>
          <button onClick={onLogout} style={{
            background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 10,
            padding: "6px 12px", color: C.red, cursor: "pointer", fontSize: 12, fontWeight: 700,
          }}>⏻</button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        {(!isMobile || !sidebarCollapsed) && (
          <div style={{
            width: isMobile ? "100%" : SIDEBAR_W,
            background: C.surface, borderRight: `1px solid ${C.border}`,
            display: "flex", flexDirection: isMobile ? "row" : "column",
            padding: isMobile ? "8px 12px" : "16px 0",
            overflowX: isMobile ? "auto" : "visible",
            overflowY: !isMobile ? "auto" : "visible",
            flexShrink: 0,
            position: isMobile ? "sticky" : "relative",
            top: isMobile ? 56 : "auto",
            zIndex: isMobile ? 100 : "auto",
            transition: "width 0.2s",
          }}>
            {TABS.map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)} style={{
                display: "flex", alignItems: "center", gap: sidebarCollapsed ? 0 : 10,
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                padding: isMobile ? "8px 14px" : sidebarCollapsed ? "14px" : "13px 20px",
                background: tab === tb.id ? C.accentDim : "transparent",
                border: `1px solid ${tab === tb.id ? C.accent + "44" : "transparent"}`,
                borderRadius: isMobile ? 10 : 0,
                borderLeft: !isMobile && !sidebarCollapsed && tab === tb.id ? `3px solid ${C.accent}` : !isMobile ? "3px solid transparent" : "none",
                color: tab === tb.id ? C.accent : C.muted,
                cursor: "pointer", fontSize: isMobile ? 12 : 13,
                fontWeight: tab === tb.id ? 700 : 400,
                width: isMobile ? "auto" : "100%", textAlign: "left",
                transition: "all 0.15s", whiteSpace: "nowrap",
                position: "relative",
              }}>
                <span style={{ fontSize: 16 }}>{tb.icon}</span>
                {!sidebarCollapsed && !isMobile && <span>{tb.label}</span>}
                {!sidebarCollapsed && tb.badge && (
                  <span style={{ marginLeft: "auto", background: C.accentDim, border: `1px solid ${C.accent}44`, color: C.accent, borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{tb.badge}</span>
                )}
              </button>
            ))}

            {!isMobile && !sidebarCollapsed && (
              <div style={{ marginTop: "auto", padding: "16px 20px", borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>ADMIN ACCOUNT</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setShowProfile(true)}>
                  {user.photoURL
                    ? <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.accent}` }} />
                    : <Avatar name={user.name} size={32} />
                  }
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
                    <div style={{ color: C.gold, fontSize: 10, fontWeight: 700 }}>👑 ADMIN</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div style={{ flex: 1, overflow: "auto", padding: isMobile ? 16 : 28 }}>

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, letterSpacing: 1 }}>
                    System <span style={{ color: C.accent }}>Overview</span>
                  </div>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                    {time.toLocaleDateString(lang, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </div>
                </div>
                <div style={{ background: C.accentDim, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: "8px 16px", fontSize: 12, color: C.accent, fontWeight: 700, fontFamily: "monospace" }}>
                  v2.0 · Firebase
                </div>
              </div>

              {/* Stat Cards */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
                <StatCard title={t("totalUsers").toUpperCase()} value={users.length} icon="👥" color={C.accent} sub="registered" trend={12} onClick={() => setTab("users")} />
                <StatCard title={t("premium").toUpperCase()} value={premiumCount} icon="👑" color={C.gold} sub={`${users.length ? Math.round(premiumCount / users.length * 100) : 0}% rate`} trend={8} onClick={() => setTab("marketing")} />
                <StatCard title={t("onlineNow").toUpperCase()} value={onlineCount} icon="🟢" color={C.green} sub="active users" />
                <StatCard title={t("revenue").toUpperCase()} value={`$${totalRevenue.toFixed(0)}`} icon="💰" color={C.purple} sub="monthly est." trend={5} onClick={() => setTab("marketing")} />
              </div>

              {/* Recent Users + Quick Links */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 16 }}>
                {/* Recent Users */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 22, position: "relative", overflow: "hidden" }}>
                  <MiniParticles />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div style={{ fontWeight: 800, color: C.accent, fontSize: 12, letterSpacing: 2, marginBottom: 18 }}>⚡ RECENT USERS</div>
                    {users.slice(0, 6).map((u, i) => (
                      <div key={u.uid} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                        borderBottom: i < 5 ? `1px solid ${C.border}` : "none",
                        transition: "background 0.15s", borderRadius: 8, cursor: "pointer",
                      }}
                        onClick={() => setTab("users")}
                        onMouseEnter={e => e.currentTarget.style.background = `${C.accent}05`}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <Avatar name={u.name} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                            {u.name}
                            {u.badge && <span style={{ fontSize: 14 }}>{u.badge}</span>}
                            {u.premium && <span style={{ background: C.goldDim, color: C.gold, fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>PRO</span>}
                          </div>
                          <div style={{ color: C.accent, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.username}</div>
                        </div>
                        <StatusDot status={u.status} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { icon: "👥", label: "Manage Users", sub: `${users.length} total`, color: C.accent, id: "users" },
                    { icon: "💰", label: "View Revenue", sub: `$${totalRevenue.toFixed(0)} MRR`, color: C.gold, id: "marketing" },
                    { icon: "🔒", label: "Security", sub: "2FA · Sessions", color: C.purple, id: "security" },
                    { icon: "🤖", label: "Manage Bots", sub: "4 active", color: C.green, id: "bots" },
                  ].map(q => (
                    <button key={q.id} onClick={() => setTab(q.id)} style={{
                      background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                      padding: "14px 18px", cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 14, transition: "all 0.2s", color: C.text,
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = q.color + "55"; e.currentTarget.style.transform = "translateX(4px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateX(0)"; }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${q.color}15`, border: `1px solid ${q.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{q.icon}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{q.label}</div>
                        <div style={{ color: q.color, fontSize: 11, marginTop: 2 }}>{q.sub}</div>
                      </div>
                      <span style={{ marginLeft: "auto", color: C.muted }}>→</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* USERS */}
          {tab === "users" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900 }}>
                  User <span style={{ color: C.accent }}>Management</span>
                </div>
                <div style={{ background: C.accentDim, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: "6px 14px", fontSize: 12, color: C.accent, fontWeight: 700 }}>{users.length} users</div>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name, username, phone..."
                  style={{ flex: 1, minWidth: 160, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", color: C.text, fontSize: 13, outline: "none" }} />
                <div style={{ display: "flex", gap: 6 }}>
                  {["all", "premium", "free", "online"].map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                      background: filter === f ? C.accentDim : C.card,
                      border: `1px solid ${filter === f ? C.accent : C.border}`,
                      borderRadius: 10, padding: "8px 14px",
                      color: filter === f ? C.accent : C.muted,
                      cursor: "pointer", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
                      transition: "all 0.15s",
                    }}>{f}</button>
                  ))}
                </div>
              </div>

              {/* Mobile Cards */}
              {isMobile ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filteredUsers.map(u => (
                    <div key={u.uid} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                        <Avatar name={u.name} size={44} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 14 }}>
                            {u.name}
                            {u.badge && <span>{u.badge}</span>}
                            {u.premium && <span style={{ background: C.goldDim, color: C.gold, fontSize: 9, padding: "2px 7px", borderRadius: 8, fontWeight: 700 }}>PREMIUM</span>}
                          </div>
                          <div style={{ color: C.accent, fontSize: 12 }}>{u.username}</div>
                          <div style={{ color: C.muted, fontSize: 11 }}>{u.phone}</div>
                        </div>
                        <StatusDot status={u.status} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => togglePremium(u.uid)} style={{
                          flex: 1, padding: "8px", borderRadius: 10,
                          border: `1px solid ${u.premium ? C.red : C.gold}44`,
                          background: u.premium ? C.redDim : C.goldDim,
                          color: u.premium ? C.red : C.gold,
                          cursor: "pointer", fontSize: 11, fontWeight: 700,
                        }}>{u.premium ? "Remove Premium" : "✨ Upgrade"}</button>
                        {u.premium && (
                          <button onClick={() => setBadgeModal(u.uid)} style={{
                            padding: "8px 14px", borderRadius: 10,
                            border: `1px solid ${C.purple}44`, background: C.purpleDim,
                            color: C.purple, cursor: "pointer", fontSize: 11, fontWeight: 700,
                          }}>Badge</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Desktop Table */
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: C.surface }}>
                        {["User", "Phone", "Username", "Status", "Badge", "Plan", "Actions"].map(h => (
                          <th key={h} style={{ padding: "14px 16px", textAlign: "left", color: C.muted, fontSize: 10, letterSpacing: 2, fontWeight: 800 }}>{h.toUpperCase()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.uid}
                          style={{ borderTop: `1px solid ${C.border}`, transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = `${C.accent}05`}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Avatar name={u.name} size={34} />
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", color: C.muted, fontSize: 12, fontFamily: "monospace" }}>{u.phone}</td>
                          <td style={{ padding: "14px 16px", color: C.accent, fontSize: 12 }}>{u.username}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <StatusDot status={u.status} />
                              <span style={{ fontSize: 11, color: u.status === "online" ? C.green : u.status === "away" ? C.gold : C.muted, fontWeight: 600 }}>{u.status || "offline"}</span>
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", fontSize: 20 }}>{u.badge || <span style={{ color: C.dim }}>—</span>}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ background: u.premium ? C.goldDim : `${C.muted}15`, color: u.premium ? C.gold : C.muted, borderRadius: 20, padding: "4px 12px", fontSize: 10, fontWeight: 700 }}>{u.premium ? "👑 PREMIUM" : "FREE"}</span>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => togglePremium(u.uid)} style={{ background: u.premium ? C.redDim : C.goldDim, border: `1px solid ${u.premium ? C.red : C.gold}44`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: u.premium ? C.red : C.gold, fontSize: 11, fontWeight: 700 }}>
                                {u.premium ? "Remove" : "Upgrade"}
                              </button>
                              {u.premium && (
                                <button onClick={() => setBadgeModal(u.uid)} style={{ background: C.purpleDim, border: `1px solid ${C.purple}44`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: C.purple, fontSize: 11, fontWeight: 700 }}>Badge</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.muted }}>No users found</div>}
                </div>
              )}
            </div>
          )}

          {/* BOTS */}
          {tab === "bots" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900 }}>Bot <span style={{ color: C.accent }}>Management</span></div>
                <button style={{ background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, border: "none", borderRadius: 12, padding: "10px 20px", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 800, boxShadow: `0 4px 20px ${C.accentGlow}` }}
                  onClick={() => notify("Bot creation coming soon!", C.accent)}>+ Create Bot</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {[
                  { id: 1, name: "NexBot AI", username: "@nexbot_ai", status: "active", users: 1240, commands: 45, type: "AI Assistant", icon: "🤖" },
                  { id: 2, name: "Shop Bot", username: "@nextalk_shop", status: "active", users: 890, commands: 30, type: "E-Commerce", icon: "🛍" },
                  { id: 3, name: "News Bot", username: "@nexnews", status: "inactive", users: 320, commands: 15, type: "News Feed", icon: "📰" },
                  { id: 4, name: "Crypto Bot", username: "@nexcrypto", status: "active", users: 2100, commands: 60, type: "Finance", icon: "📈" },
                ].map(bot => (
                  <div key={bot.id} style={{
                    background: C.card, border: `1px solid ${bot.status === "active" ? C.green + "33" : C.border}`,
                    borderRadius: 18, padding: 22, transition: "all 0.2s",
                    boxShadow: bot.status === "active" ? `0 0 30px ${C.green}11` : "none",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-5px)"; e.currentTarget.style.boxShadow = `0 16px 40px ${bot.status === "active" ? C.green : C.accent}18`; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = bot.status === "active" ? `0 0 30px ${C.green}11` : "none"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div style={{ width: 50, height: 50, borderRadius: 16, background: `linear-gradient(135deg, ${C.purple}, ${C.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: `0 4px 20px ${C.purple}44` }}>{bot.icon}</div>
                      <span style={{ background: bot.status === "active" ? C.greenDim : `${C.muted}15`, color: bot.status === "active" ? C.green : C.muted, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, border: `1px solid ${bot.status === "active" ? C.green + "44" : C.border}` }}>● {bot.status}</span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{bot.name}</div>
                    <div style={{ color: C.accent, fontSize: 12, marginBottom: 10 }}>{bot.username}</div>
                    <div style={{ color: C.muted, fontSize: 12, marginBottom: 16, display: "flex", gap: 16 }}>
                      <span>👥 {bot.users.toLocaleString()}</span>
                      <span>⚙️ {bot.commands} cmds</span>
                    </div>
                    <div style={{ display: "inline-block", background: C.purpleDim, border: `1px solid ${C.purple}33`, borderRadius: 8, padding: "3px 10px", fontSize: 11, color: C.purple, marginBottom: 14 }}>{bot.type}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => notify(`${bot.name} ${bot.status === "active" ? "paused" : "started"}!`, bot.status === "active" ? C.red : C.green)} style={{ flex: 1, background: bot.status === "active" ? C.redDim : C.greenDim, border: `1px solid ${bot.status === "active" ? C.red : C.green}44`, borderRadius: 10, padding: "8px", cursor: "pointer", color: bot.status === "active" ? C.red : C.green, fontSize: 12, fontWeight: 700 }}>{bot.status === "active" ? "⏸ Pause" : "▶ Start"}</button>
                      <button onClick={() => notify("Opening editor...", C.accent)} style={{ flex: 1, background: C.accentDim, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: "8px", cursor: "pointer", color: C.accent, fontSize: 12, fontWeight: 700 }}>⚙ Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MARKETING */}
          {tab === "marketing" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900, marginBottom: 24 }}>
                Marketing <span style={{ color: C.gold }}>& Revenue</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
                <StatCard title="MONTHLY REVENUE" value={`$${totalRevenue.toFixed(2)}`} icon="💰" color={C.gold} sub="from premium" trend={15} />
                <StatCard title="CONVERSION RATE" value={`${users.length ? Math.round(premiumCount / users.length * 100) : 0}%`} icon="📈" color={C.green} sub="free → premium" trend={3} />
                <StatCard title="AVG PER USER" value={premiumCount ? `$49.99` : "$0"} icon="💎" color={C.purple} sub="per premium user" />
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 24 }}>
                <div style={{ fontWeight: 800, color: C.gold, fontSize: 12, letterSpacing: 2, marginBottom: 20 }}>👑 PREMIUM MEMBERS</div>
                {users.filter(u => u.premium).length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 24 }}>No premium users yet</div>}
                {users.filter(u => u.premium).map((u, i, arr) => (
                  <div key={u.uid} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <Avatar name={u.name} size={40} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                        {u.name} {u.badge && <span>{u.badge}</span>}
                      </div>
                      <div style={{ color: C.muted, fontSize: 12 }}>{u.username}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: C.gold, fontWeight: 800, fontSize: 15 }}>$49.99</div>
                      <div style={{ color: C.muted, fontSize: 11 }}>per month</div>
                    </div>
                    <div style={{ width: 80, height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: "75%", background: `linear-gradient(90deg, ${C.gold}, ${C.accent})`, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
                {users.filter(u => u.premium).length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ color: C.muted, fontSize: 13 }}>Estimated Monthly Revenue</div>
                    <div style={{ color: C.gold, fontWeight: 900, fontSize: 22, fontFamily: "monospace" }}>${totalRevenue.toFixed(2)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CHAT */}
          {tab === "chat" && (
            <div style={{ height: "calc(100vh - 56px)", margin: "-28px", overflow: "hidden" }}>
              <ChatScreen currentUser={user} lang={lang} onBack={() => setTab("overview")} />
            </div>
          )}

          {/* SECURITY */}
          {tab === "security" && <SecurityTab currentUser={currentUser} notify={notify} />}

          {/* SETTINGS */}
          {tab === "settings" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900, marginBottom: 24 }}>
                App <span style={{ color: C.accent }}>Settings</span>
              </div>

              {/* Language */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "14px 20px", background: C.surface, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: 3, fontWeight: 700 }}>INTERFACE LANGUAGE</div>
                <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{langObj.flag}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{langObj.name}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>{langObj.code.toUpperCase()} · {langObj.dir === "rtl" ? "Right-to-Left" : "Left-to-Right"}</div>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden", marginBottom: 16 }}>
                {[
                  { label: "App Name", value: "NexTalk", icon: "💬" },
                  { label: "Firebase Project", value: "nextalk-4ef19", icon: "🔥" },
                  { label: "Admin Account", value: currentUser.phone || currentUser.name, icon: "👤" },
                  { label: "Version", value: "2.0.0", icon: "📦" },
                  { label: "Region", value: "Global · Multi-language", icon: "🌍" },
                  { label: "Security", value: "2FA · Rate Limit · Fingerprint", icon: "🔒" },
                ].map((s, i, arr) => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <span style={{ fontSize: 20 }}>{s.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1 }}>{s.label.toUpperCase()}</div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>{s.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Danger Zone */}
              <div style={{ padding: 20, background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 18 }}>
                <div style={{ color: C.red, fontWeight: 800, marginBottom: 10, fontSize: 14 }}>⚠️ Danger Zone</div>
                <button onClick={onLogout} style={{ background: `linear-gradient(135deg, ${C.red}, #cc0000)`, border: "none", borderRadius: 12, padding: "12px 24px", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, boxShadow: `0 4px 20px ${C.red}44` }}>Sign Out of Admin</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes popIn { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
        * { box-sizing: border-box; }
        input::placeholder { color: ${C.muted}; }
        select option { background: ${C.card}; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${C.accent}44; }
      `}</style>
    </div>
  );
}
