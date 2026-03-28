import { useState, useEffect, useRef } from "react";
import { LANGUAGES, useTranslation } from "./i18n";
import {
  getDeviceFingerprint,
  checkRateLimit,
  resetRateLimit,
  generateTOTPSecret,
  verifyTOTP,
  getTOTPQRUrl,
  createSession,
  getActiveSessions,
  terminateSession,
  terminateAllOtherSessions,
  generateBackupCodes,
  verifyBackupCode,
  detectAnomalies,
  sanitizeName,
  sanitizeUsername,
  setupPresence,
} from "./security";

// ─── Firebase Config ───────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyApF9k0_crAuhRhD5FbBWPNm_Q0JDENB-0",
  authDomain: "nextalk-4ef19.firebaseapp.com",
  projectId: "nextalk-4ef19",
  storageBucket: "nextalk-4ef19.firebasestorage.app",
  messagingSenderId: "446566340447",
  appId: "1:446566340447:web:533571f65218c20d1548ea",
  measurementId: "G-61H07K734D",
  databaseURL: "https://nextalk-4ef19-default-rtdb.firebaseio.com",
};

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#060a14",
  surface: "#0d1321",
  card: "#111827",
  border: "#1e2d45",
  borderGlow: "#00d4ff22",
  accent: "#00d4ff",
  accentDim: "#00d4ff18",
  accentGlow: "#00d4ff55",
  gold: "#ffd700",
  goldDim: "#ffd70018",
  goldGlow: "#ffd70044",
  green: "#00ff88",
  greenDim: "#00ff8818",
  red: "#ff3366",
  redDim: "#ff336618",
  purple: "#a855f7",
  purpleDim: "#a855f718",
  text: "#e2e8f0",
  muted: "#64748b",
  dim: "#334155",
};

let firebaseApp = null, firebaseAuth = null, firebaseDB = null;

// ─── NexTalk Logo SVG ──────────────────────────────────────────────────────────
function NexTalkLogo({ size = 80, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={style}>
      <defs>
        <linearGradient id="ntBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a6fff" />
          <stop offset="100%" stopColor="#0047cc" />
        </linearGradient>
        <linearGradient id="ntCircle" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2979ff" />
          <stop offset="100%" stopColor="#1565c0" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#ntBg)" />
      <circle cx="50" cy="50" r="36" fill="url(#ntCircle)" opacity="0.55" />
      {/* N shape */}
      <path d="M29 67 L29 34 L37 34 L53 56 L53 34 L61 34 L61 54"
        stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Chat bubble tail */}
      <path d="M27 71 Q25 80 18 83 Q29 80 35 74 Z" fill="white" opacity="0.9" />
      {/* Arrow up-right */}
      <path d="M57 44 L70 32 M64 32 L70 32 L70 39"
        stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Circular arrow bottom */}
      <path d="M63 59 Q69 71 58 76 Q46 80 37 72"
        stroke="white" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M35 68 L37 73 L42 70"
        stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ─── Particle Canvas ───────────────────────────────────────────────────────────
function ParticlesBG() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    const pts = Array.from({ length: 80 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.3,
      hue: Math.random() > 0.7 ? 280 : 195,
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
        ctx.fillStyle = `hsla(${p.hue},100%,70%,0.5)`;
        ctx.fill();
      });
      pts.forEach((a, i) => pts.slice(i + 1).forEach(b => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 100) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(0,212,255,${0.07 * (1 - d / 100)})`;
          ctx.lineWidth = 0.5; ctx.stroke();
        }
      }));
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} />;
}

// ─── OTP Input ─────────────────────────────────────────────────────────────────
function OTPInput({ length = 6, onComplete, disabled }) {
  const [vals, setVals] = useState(Array(length).fill(""));
  const refsContainer = useRef(Array.from({ length }, () => ({ current: null })));
  const refs = refsContainer.current;
  const handle = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const n = [...vals]; n[i] = v; setVals(n);
    if (v && i < length - 1) refs[i + 1].current?.focus();
    if (n.every(x => x) && n.join("").length === length) onComplete(n.join(""));
  };
  const handleKey = (i, e) => {
    if (e.key === "Backspace" && !vals[i] && i > 0) refs[i - 1].current?.focus();
  };
  const handlePaste = (e) => {
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (paste.length === length) {
      const n = paste.split(""); setVals(n);
      refs[length - 1].current?.focus();
      onComplete(paste);
    }
    e.preventDefault();
  };
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      {vals.map((v, i) => (
        <input key={i} ref={refs[i]} value={v} maxLength={1} inputMode="numeric"
          disabled={disabled}
          onChange={e => handle(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          style={{
            width: 46, height: 54, textAlign: "center", fontSize: 20, fontWeight: 700,
            background: v ? C.accentDim : C.surface,
            border: `2px solid ${v ? C.accent : C.border}`,
            borderRadius: 12, color: C.text, outline: "none",
            fontFamily: "monospace", transition: "all 0.2s",
            boxShadow: v ? `0 0 16px ${C.accentGlow}` : "none",
            opacity: disabled ? 0.5 : 1,
          }} />
      ))}
    </div>
  );
}

// ─── Language Picker Screen ────────────────────────────────────────────────────
function LanguagePicker({ onSelect }) {
  const [selected, setSelected] = useState("en");
  const [search, setSearch] = useState("");
  const filtered = LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20, position: "relative",
    }}>
      <ParticlesBG />
      <div style={{ position: "fixed", top: "15%", left: "5%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(${C.accent}10, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "10%", right: "5%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(${C.purple}08, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 480, animation: "fadeUp 0.5s ease" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 88, height: 88, borderRadius: 26, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${C.accent}, #0066ff)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44,
            boxShadow: `0 0 60px ${C.accentGlow}, 0 0 120px ${C.accentGlow}44`,
            animation: "glowPulse 3s ease-in-out infinite",
          }}><NexTalkLogo size={56} /></div>
          <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: 4, color: C.text, fontFamily: "'Georgia', serif" }}>
            Nex<span style={{ color: C.accent }}>Talk</span>
          </div>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 6, letterSpacing: 3 }}>NEXT GENERATION MESSENGER</div>
        </div>

        <div style={{
          background: `linear-gradient(135deg, ${C.surface}, ${C.card})`,
          border: `1px solid ${C.border}`,
          borderRadius: 24, padding: "32px 28px",
          boxShadow: `0 32px 80px #00000088, 0 0 0 1px ${C.borderGlow}`,
        }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 6 }}>🌍 Select Your Language</div>
            <div style={{ color: C.muted, fontSize: 13 }}>Choose your preferred language to continue</div>
          </div>

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search language..."
            style={{
              width: "100%", background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: "10px 14px", color: C.text, fontSize: 14,
              outline: "none", marginBottom: 16, boxSizing: "border-box",
            }}
          />

          {/* Language Grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: 8, maxHeight: 300, overflowY: "auto", marginBottom: 20,
            paddingRight: 4,
          }}>
            {filtered.map(lang => (
              <button key={lang.code} onClick={() => setSelected(lang.code)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                background: selected === lang.code ? C.accentDim : C.surface,
                border: `2px solid ${selected === lang.code ? C.accent : C.border}`,
                color: selected === lang.code ? C.accent : C.text,
                fontWeight: selected === lang.code ? 700 : 400,
                fontSize: 13, textAlign: "left", transition: "all 0.15s",
                boxShadow: selected === lang.code ? `0 0 16px ${C.accentGlow}` : "none",
              }}>
                <span style={{ fontSize: 20 }}>{lang.flag}</span>
                <div style={{ overflow: "hidden" }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lang.name}</div>
                  <div style={{ fontSize: 10, opacity: 0.6, fontFamily: "monospace" }}>{lang.code.toUpperCase()}</div>
                </div>
                {selected === lang.code && (
                  <span style={{ marginLeft: "auto", color: C.accent, fontSize: 16 }}>✓</span>
                )}
              </button>
            ))}
          </div>

          <button onClick={() => onSelect(selected)} style={{
            width: "100%", padding: "14px", borderRadius: 14, border: "none",
            background: `linear-gradient(135deg, ${C.accent}, #0066ff)`,
            color: "#000", fontSize: 16, fontWeight: 800, cursor: "pointer",
            boxShadow: `0 8px 32px ${C.accentGlow}`,
            transition: "all 0.2s", letterSpacing: 1,
          }}>
            Continue →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 60px ${C.accentGlow},0 0 120px ${C.accentGlow}44} 50%{box-shadow:0 0 80px ${C.accent}88,0 0 160px ${C.accent}44} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:${C.bg}} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
      `}</style>
    </div>
  );
}

// ─── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, lang }) {
  const t = useTranslation(lang);
  const langObj = LANGUAGES.find(l => l.code === lang) || LANGUAGES[1];
  const dir = langObj.dir || "ltr";

  const [step, setStep] = useState("phone"); // phone | otp | twofa | name | register | login-email
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("+20");
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regGender, setRegGender] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmResult, setConfirmResult] = useState(null);
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFAPending, setTwoFAPending] = useState(false);
  const recaptchaRef = useRef(null);
  const deviceFP = useRef(getDeviceFingerprint());

  const countries = [
    { code: "+20", flag: "🇪🇬", name: "Egypt" },
    { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
    { code: "+971", flag: "🇦🇪", name: "UAE" },
    { code: "+965", flag: "🇰🇼", name: "Kuwait" },
    { code: "+974", flag: "🇶🇦", name: "Qatar" },
    { code: "+1", flag: "🇺🇸", name: "USA" },
    { code: "+44", flag: "🇬🇧", name: "UK" },
    { code: "+49", flag: "🇩🇪", name: "Germany" },
    { code: "+33", flag: "🇫🇷", name: "France" },
    { code: "+7", flag: "🇷🇺", name: "Russia" },
    { code: "+86", flag: "🇨🇳", name: "China" },
    { code: "+91", flag: "🇮🇳", name: "India" },
    { code: "+55", flag: "🇧🇷", name: "Brazil" },
    { code: "+90", flag: "🇹🇷", name: "Turkey" },
    { code: "+213", flag: "🇩🇿", name: "Algeria" },
    { code: "+216", flag: "🇹🇳", name: "Tunisia" },
    { code: "+212", flag: "🇲🇦", name: "Morocco" },
    { code: "+62", flag: "🇮🇩", name: "Indonesia" },
    { code: "+81", flag: "🇯🇵", name: "Japan" },
    { code: "+82", flag: "🇰🇷", name: "Korea" },
    { code: "+92", flag: "🇵🇰", name: "Pakistan" },
    { code: "+98", flag: "🇮🇷", name: "Iran" },
    { code: "+31", flag: "🇳🇱", name: "Netherlands" },
    { code: "+48", flag: "🇵🇱", name: "Poland" },
    { code: "+39", flag: "🇮🇹", name: "Italy" },
    { code: "+34", flag: "🇪🇸", name: "Spain" },
  ];

  const sendOTP = async () => {
    if (!phone || phone.length < 7) { setError(t("invalidPhone")); return; }
    const rl = checkRateLimit(`otp_send_${phone}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) { setError(rl.reason); return; }
    setLoading(true); setError("");
    try {
      // Strip ALL leading zeros then build E.164
      const cleaned = phone.replace(/^0+/, "");
      const fullPhone = country + cleaned;
      if (firebaseAuth && window.firebase_signInWithPhoneNumber) {
        // Always recreate verifier to avoid stale state
        if (window.recaptchaVerifier) {
          try { window.recaptchaVerifier.clear(); } catch (_) {}
          window.recaptchaVerifier = null;
        }
        // Create a fresh div for recaptcha to avoid container errors
        const container = document.createElement("div");
        container.id = "recaptcha-container-" + Date.now();
        document.body.appendChild(container);
        window.recaptchaVerifier = new window.firebase_RecaptchaVerifier(
          firebaseAuth, container, { size: "invisible" }
        );
        await window.recaptchaVerifier.render();
        const result = await window.firebase_signInWithPhoneNumber(firebaseAuth, fullPhone, window.recaptchaVerifier);
        setConfirmResult(result);
        // Clean up container
        try { document.body.removeChild(container); } catch (_) {}
      } else {
        await new Promise(r => setTimeout(r, 1200));
      }
      setStep("otp");
    } catch (e) {
      if (window.recaptchaVerifier) { try { window.recaptchaVerifier.clear(); } catch (_) {} window.recaptchaVerifier = null; }
      // Show friendly error messages
      if (e.code === "auth/internal-error") setError("خطأ في الإعدادات. تأكد أن Phone Auth مفعّل في Firebase Console");
      else if (e.code === "auth/invalid-phone-number") setError("رقم التليفون غلط، تأكد من الرقم");
      else if (e.code === "auth/too-many-requests") setError("كتير أوي، استنى شوية وحاول تاني");
      else if (e.code === "auth/quota-exceeded") setError("تجاوزت الحد اليومي لـ SMS، حاول بكره");
      else setError(e.message || "فشل إرسال الكود، حاول تاني");
    }
    setLoading(false);
  };

  const verifyOTP = async (code) => {
    const rl = checkRateLimit(`otp_verify_${phone}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) { setError(rl.reason); return; }
    setLoading(true); setError("");
    try {
      let uid;
      let fireUser = null;
      if (confirmResult) {
        const cred = await confirmResult.confirm(code);
        uid = cred.user.uid;
        fireUser = cred.user;
      } else {
        await new Promise(r => setTimeout(r, 800));
        uid = "demo_" + phone;
      }
      // Check if user already has account in DB
      if (firebaseDB && window.firebase_ref && window.firebase_get && window.firebase_set) {
        const userSnap = await window.firebase_get(window.firebase_ref(firebaseDB, `users/${uid}`));
        if (userSnap.exists()) {
          const userData = userSnap.val();
          // Check 2FA
          if (userData.twoFA?.enabled) {
            setTwoFAPending(uid);
            setStep("twofa");
            setLoading(false);
            return;
          }
          // User exists — login directly, no need for name step
          resetRateLimit(`otp_verify_${phone}`);
          await window.firebase_set(window.firebase_ref(firebaseDB, `users/${uid}/lastLogin`), Date.now());
          onLogin({ ...userData, lastLogin: Date.now() });
          setLoading(false);
          return;
        }
      }
      // New user — go to name step
      resetRateLimit(`otp_verify_${phone}`);
      setStep("name");
    } catch (e) {
      setError(t("invalidCode"));
    }
    setLoading(false);
  };

  const verify2FA = async () => {
    setLoading(true); setError("");
    try {
      const uid = twoFAPending;
      if (firebaseDB && window.firebase_ref && window.firebase_get) {
        const snap = await window.firebase_get(window.firebase_ref(firebaseDB, `users/${uid}/twoFA`));
        const { secret, backupCodes } = snap.val();
        const totpValid = await verifyTOTP(secret, twoFACode);
        if (totpValid) {
          // Load user and login directly
          const userSnap = await window.firebase_get(window.firebase_ref(firebaseDB, `users/${uid}`));
          if (userSnap.exists()) { onLogin(userSnap.val()); } else { setStep("name"); }
        } else {
          // Check backup codes
          const { valid, remaining } = verifyBackupCode(backupCodes || [], twoFACode);
          if (valid) {
            await window.firebase_update(window.firebase_ref(firebaseDB, `users/${uid}/twoFA`), { backupCodes: remaining });
            const userSnap = await window.firebase_get(window.firebase_ref(firebaseDB, `users/${uid}`));
            if (userSnap.exists()) { onLogin(userSnap.val()); } else { setStep("name"); }
          } else {
            setError("Invalid 2FA code or backup code.");
          }
        }
      } else {
        // Demo
        if (twoFACode === "000000") setStep("name");
        else setError("Invalid 2FA code. (Demo: use 000000)");
      }
    } catch (e) {
      setError("2FA verification failed.");
    }
    setLoading(false);
  };

  const handleGoogleUser = async (fireUser) => {
    let userData = null;
    if (firebaseDB && window.firebase_ref && window.firebase_get) {
      const snap = await window.firebase_get(window.firebase_ref(firebaseDB, `users/${fireUser.uid}`));
      if (snap.exists()) {
        userData = snap.val();
      }
    }
    if (!userData) {
      userData = {
        uid: fireUser.uid,
        name: fireUser.displayName || "User",
        phone: fireUser.phoneNumber || "",
        username: "@" + (fireUser.displayName || "user").replace(/\s+/g, "_").toLowerCase() + "_" + Math.floor(Math.random() * 9999),
        photoURL: fireUser.photoURL || null,
        email: fireUser.email || null,
        premium: false,
        badge: null,
        joinedAt: new Date().toISOString(),
        isAdmin: false,
        lang,
        lastLogin: Date.now(),
        twoFA: { enabled: false },
        authProvider: "google",
      };
      if (firebaseDB && window.firebase_ref && window.firebase_set) {
        await window.firebase_set(window.firebase_ref(firebaseDB, `users/${fireUser.uid}`), userData);
      }
    }
    onLogin(userData);
  };

  const signInWithGoogle = async () => {
    setLoading(true); setError("");
    try {
      // Wait up to 5s for Firebase to be ready
      let waited = 0;
      while ((!firebaseAuth || !window.firebase_GoogleAuthProvider) && waited < 5000) {
        await new Promise(r => setTimeout(r, 300));
        waited += 300;
      }
      if (firebaseAuth && window.firebase_GoogleAuthProvider) {
        const provider = new window.firebase_GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile && window.firebase_signInWithRedirect) {
          // Use redirect on mobile — page will reload and result handled below
          await window.firebase_signInWithRedirect(firebaseAuth, provider);
          return; // Page will redirect, no further action needed here
        } else if (window.firebase_signInWithPopup) {
          const result = await window.firebase_signInWithPopup(firebaseAuth, provider);
          await handleGoogleUser(result.user);
        } else {
          setError("Google Sign-In not available yet. Please wait and try again.");
        }
      } else {
        setError("Google Sign-In not available yet. Please wait and try again.");
      }
    } catch (e) {
      if (e.code === "auth/popup-closed-by-user") {
        setError("");
      } else if (e.code === "auth/popup-blocked") {
        setError("Popup was blocked. Please allow popups for this site.");
      } else {
        setError(e.message || "Google sign-in failed");
      }
    }
    setLoading(false);
  };

  const registerWithEmail = async () => {
    if (!name.trim()) { setError("من فضلك أدخل اسمك"); return; }
    if (!regUsername.trim()) { setError("من فضلك أدخل اسم المستخدم"); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(regUsername.trim())) { setError("اسم المستخدم: 3-20 حرف، أرقام أو _ فقط"); return; }
    if (!birthday) { setError("من فضلك أدخل تاريخ ميلادك"); return; }
    const today = new Date();
    const bday = new Date(birthday);
    const age = today.getFullYear() - bday.getFullYear() - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0);
    if (age < 13) { setError("يجب أن يكون عمرك 13 سنة على الأقل"); return; }
    if (!regGender) { setError("من فضلك اختر جنسك"); return; }
    if (!regEmail.trim() || !/\S+@\S+\.\S+/.test(regEmail)) { setError("من فضلك أدخل بريد إلكتروني صحيح"); return; }
    if (regPassword.length < 8) { setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }

    // Check Firebase is ready — wait up to 5s
    if (!firebaseAuth || !window.firebase_createUserWithEmailAndPassword) {
      setLoading(true);
      let waited = 0;
      while ((!firebaseAuth || !window.firebase_createUserWithEmailAndPassword) && waited < 5000) {
        await new Promise(r => setTimeout(r, 300));
        waited += 300;
      }
      setLoading(false);
      if (!firebaseAuth || !window.firebase_createUserWithEmailAndPassword) {
        setError("التطبيق لسه بيتحمل، استنى ثانية وحاول تاني");
        return;
      }
    }

    setLoading(true); setError("");
    try {
      // Check username not taken
      if (firebaseDB && window.firebase_ref && window.firebase_get) {
        const usernameSnap = await window.firebase_get(window.firebase_ref(firebaseDB, `usernames/${regUsername.toLowerCase()}`));
        if (usernameSnap.exists()) {
          setError("اسم المستخدم ده موجود بالفعل، جرب اسم تاني");
          setLoading(false);
          return;
        }
      }

      const result = await window.firebase_createUserWithEmailAndPassword(firebaseAuth, regEmail.trim(), regPassword);
      const fireUser = result.user;
      const userData = {
        uid: fireUser.uid,
        name: name.trim(),
        username: "@" + regUsername.trim().toLowerCase(),
        email: regEmail.trim(),
        birthday,
        age,
        gender: regGender,
        phone: "",
        photoURL: null,
        premium: false,
        badge: null,
        joinedAt: new Date().toISOString(),
        isAdmin: false,
        lang,
        lastLogin: Date.now(),
        twoFA: { enabled: false },
        authProvider: "email",
      };
      if (firebaseDB && window.firebase_ref && window.firebase_set) {
        await window.firebase_set(window.firebase_ref(firebaseDB, `users/${fireUser.uid}`), userData);
        await window.firebase_set(window.firebase_ref(firebaseDB, `usernames/${regUsername.trim().toLowerCase()}`), fireUser.uid);
      }
      onLogin(userData);
    } catch (e) {
      console.error("Register error:", e);
      if (e.code === "auth/email-already-in-use") setError("البريد الإلكتروني ده مستخدم بالفعل");
      else if (e.code === "auth/weak-password") setError("كلمة المرور ضعيفة جداً");
      else if (e.code === "auth/invalid-email") setError("البريد الإلكتروني غير صحيح");
      else if (e.code === "auth/network-request-failed") setError("مفيش إنترنت، تأكد من الاتصال");
      else setError("حدث خطأ: " + (e.message || "حاول مرة تانية"));
    }
    setLoading(false);
  };

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const loginWithEmail = async () => {
    if (!loginEmail.trim() || !/\S+@\S+\.\S+/.test(loginEmail)) { setError("من فضلك أدخل بريد إلكتروني صحيح"); return; }
    if (!loginPassword) { setError("من فضلك أدخل كلمة المرور"); return; }
    // Wait up to 5s for Firebase to be ready
    if (!firebaseAuth || !window.firebase_signInWithEmailAndPassword) {
      setLoading(true);
      let waited = 0;
      while ((!firebaseAuth || !window.firebase_signInWithEmailAndPassword) && waited < 5000) {
        await new Promise(r => setTimeout(r, 300));
        waited += 300;
      }
      setLoading(false);
      if (!firebaseAuth || !window.firebase_signInWithEmailAndPassword) {
        setError("التطبيق لسه بيتحمل، استنى ثانية وحاول تاني");
        return;
      }
    }
    setLoading(true); setError("");
    try {
      const result = await window.firebase_signInWithEmailAndPassword(firebaseAuth, loginEmail.trim(), loginPassword);
      const fireUser = result.user;
      let userData = null;
      if (firebaseDB && window.firebase_ref && window.firebase_get) {
        const snap = await window.firebase_get(window.firebase_ref(firebaseDB, `users/${fireUser.uid}`));
        if (snap.exists()) userData = snap.val();
      }
      if (!userData) {
        userData = {
          uid: fireUser.uid,
          name: fireUser.displayName || loginEmail.split("@")[0],
          username: "@user_" + Math.floor(Math.random() * 99999),
          email: fireUser.email,
          photoURL: fireUser.photoURL || null,
          premium: false,
          badge: null,
          joinedAt: new Date().toISOString(),
          isAdmin: false,
          lang,
          lastLogin: Date.now(),
          twoFA: { enabled: false },
          authProvider: "email",
        };
      } else {
        userData.lastLogin = Date.now();
        if (firebaseDB && window.firebase_ref && window.firebase_set) {
          await window.firebase_set(window.firebase_ref(firebaseDB, `users/${fireUser.uid}/lastLogin`), Date.now());
        }
      }
      onLogin(userData);
    } catch (e) {
      if (e.code === "auth/user-not-found" || e.code === "auth/invalid-credential" || e.code === "auth/wrong-password") setError("البريد الإلكتروني أو كلمة المرور غلط");
      else if (e.code === "auth/invalid-email") setError("البريد الإلكتروني غير صحيح");
      else if (e.code === "auth/too-many-requests") setError("كتير أوي، استنى شوية وحاول تاني");
      else if (e.code === "auth/network-request-failed") setError("مفيش إنترنت، تأكد من الاتصال");
      else setError("حدث خطأ: " + (e.message || "حاول مرة تانية"));
    }
    setLoading(false);
  };

  const saveName = async () => {
    if (!name.trim()) { setError(t("enterName")); return; }
    if (!birthday) { setError("من فضلك أدخل تاريخ ميلادك"); return; }
    // Check age >= 13
    const today = new Date();
    const bday = new Date(birthday);
    const age = today.getFullYear() - bday.getFullYear() - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0);
    if (age < 13) { setError("يجب أن يكون عمرك 13 سنة على الأقل"); return; }
    setLoading(true);
    try {
      const uid = firebaseAuth?.currentUser?.uid || "demo_" + Date.now();
      const user = {
        uid,
        name: name.trim(),
        phone: country + phone,
        username: "@user_" + Math.floor(Math.random() * 99999),
        photoURL: null,
        premium: false,
        badge: null,
        birthday,
        age,
        joinedAt: new Date().toISOString(),
        isAdmin: phone === "1128381838" || phone === "01128381838",
        lang,
        deviceFingerprint: deviceFP.current,
        lastLogin: Date.now(),
        twoFA: { enabled: false },
      };
      if (firebaseDB && window.firebase_ref && window.firebase_set) {
        await window.firebase_set(window.firebase_ref(firebaseDB, `users/${uid}`), user);
      }
      createSession(uid, { fingerprint: deviceFP.current });
      onLogin(user);
    } catch (e) {
      setError(t("errorSaving"));
    }
    setLoading(false);
  };

  const inputStyle = {
    width: "100%", background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: "13px 16px", color: C.text, fontSize: 15,
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
    fontFamily: "inherit",
  };

  const labelStyle = { color: C.muted, fontSize: 11, letterSpacing: 2, display: "block", marginBottom: 8, fontWeight: 700 };

  const btnPrimary = (extra = {}) => ({
    width: "100%", padding: "14px", borderRadius: 14, border: "none",
    background: `linear-gradient(135deg, ${C.accent}, #0066ff)`,
    color: "#000", fontSize: 15, fontWeight: 800, cursor: "pointer",
    boxShadow: `0 8px 32px ${C.accentGlow}`,
    transition: "all 0.2s", letterSpacing: 1,
    ...extra,
  });

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
      position: "relative", direction: dir,
    }}>
      <ParticlesBG />
      <div style={{ position: "fixed", top: "20%", left: "8%", width: 350, height: 350, borderRadius: "50%", background: `radial-gradient(${C.accent}10, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "15%", right: "8%", width: 450, height: 450, borderRadius: "50%", background: `radial-gradient(${C.purple}08, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, animation: "fadeUp 0.4s ease" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 84, height: 84, borderRadius: 24, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${C.accent}, #0066ff)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42,
            boxShadow: `0 0 60px ${C.accentGlow}, 0 0 120px ${C.accentGlow}44`,
            animation: "glowPulse 3s ease-in-out infinite",
          }}><NexTalkLogo size={52} /></div>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 4, color: C.text, fontFamily: "'Georgia', serif" }}>
            Nex<span style={{ color: C.accent }}>Talk</span>
          </div>
          <div style={{ color: C.muted, fontSize: 10, marginTop: 6, letterSpacing: 3 }}>{t("appTagline")}</div>
        </div>

        <div style={{
          background: `linear-gradient(145deg, ${C.surface}, ${C.card})`,
          border: `1px solid ${C.border}`,
          borderRadius: 24, padding: "32px 28px",
          boxShadow: `0 32px 80px #00000088, 0 0 0 1px ${C.borderGlow}`,
        }}>

          {/* METHOD SELECTION */}
          {step === "phone" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t("signIn")}</div>
                <div style={{ color: C.muted, fontSize: 13 }}>Choose how you want to sign in</div>
              </div>

              {/* Google Button */}
              <button onClick={signInWithGoogle} disabled={loading} style={{
                width: "100%", padding: "14px", borderRadius: 14,
                border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.04)",
                color: C.text, fontSize: 15, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                transition: "all 0.2s", opacity: loading ? 0.5 : 1,
                marginBottom: 12,
              }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.borderColor = "#ffffff44"; e.currentTarget.style.transform = "translateY(-2px)"; }}}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <svg width="22" height="22" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                  <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                </svg>
                {t("continueWithGoogle") || "Continue with Google"}
              </button>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0" }}>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <span style={{ color: C.muted, fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>OR</span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>

              {/* Phone Button */}
              <button onClick={() => setStep("phoneInput")} disabled={loading} style={{
                ...btnPrimary(),
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                marginBottom: 12,
              }}>
                <span style={{ fontSize: 18 }}>📱</span>
                {t("continueWithPhone") || "Continue with Phone"}
              </button>

              {/* Login with Email — دخول لحسابك (4th option, prominent) */}
              <button onClick={() => { setStep("login-email"); setError(""); }} disabled={loading} style={{
                width: "100%", padding: "14px", borderRadius: 14,
                border: `2px solid ${C.accent}66`,
                background: `linear-gradient(135deg, ${C.accentDim}, #00d4ff08)`,
                color: C.accent, fontSize: 15, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.2s", opacity: loading ? 0.5 : 1,
                marginBottom: 12,
              }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = `${C.accent}20`; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${C.accentGlow}`; }}}
                onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${C.accentDim}, #00d4ff08)`; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <span style={{ fontSize: 18 }}>🔑</span>
                دخول لحسابك
              </button>

              {/* Create Account Button */}
              <button onClick={() => { setStep("register"); setError(""); }} disabled={loading} style={{
                width: "100%", padding: "14px", borderRadius: 14, border: `1px solid ${C.purple}66`,
                background: `linear-gradient(135deg, ${C.purpleDim}, #a855f710)`,
                color: C.purple, fontSize: 15, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.2s", opacity: loading ? 0.5 : 1,
              }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = `${C.purple}25`; e.currentTarget.style.transform = "translateY(-2px)"; }}}
                onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${C.purpleDim}, #a855f710)`; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <span style={{ fontSize: 18 }}>✨</span>
                إنشاء حساب جديد
              </button>

              {error && <div style={{ color: C.red, fontSize: 13, marginTop: 16, padding: "10px 14px", background: C.redDim, borderRadius: 8, border: `1px solid ${C.red}44` }}>⚠ {error}</div>}
              <div ref={recaptchaRef} />
            </>
          )}

          {/* REGISTER STEP */}
          {step === "register" && (
            <>
              <button onClick={() => { setStep("phone"); setError(""); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
                ← رجوع
              </button>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✨</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>إنشاء حساب جديد</div>
                <div style={{ color: C.muted, fontSize: 13 }}>أدخل بياناتك عشان تبدأ</div>
              </div>

              {/* Name */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>👤 الاسم الكامل</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ahmed Mohamed" style={inputStyle} autoFocus />
              </div>

              {/* Username */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>🔖 اسم المستخدم</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.accent, fontWeight: 700, fontSize: 15 }}>@</span>
                  <input value={regUsername} onChange={e => setRegUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    placeholder="ahmed_dev" style={{ ...inputStyle, paddingLeft: 32 }} />
                </div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>حروف إنجليزية وأرقام و _ فقط</div>
              </div>

              {/* Birthday */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>📅 تاريخ الميلاد</label>
                <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 13)).toISOString().split("T")[0]}
                  style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>

              {/* Gender */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>⚧ الجنس</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[{ v: "male", label: "ذكر 👦" }, { v: "female", label: "أنثى 👧" }].map(g => (
                    <button key={g.v} onClick={() => setRegGender(g.v)} style={{
                      flex: 1, padding: "12px", borderRadius: 12, border: `2px solid ${regGender === g.v ? C.accent : C.border}`,
                      background: regGender === g.v ? C.accentDim : C.surface,
                      color: regGender === g.v ? C.accent : C.text, fontWeight: 700, cursor: "pointer", fontSize: 14,
                      transition: "all 0.2s",
                    }}>{g.label}</button>
                  ))}
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>📧 البريد الإلكتروني</label>
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  placeholder="ahmed@example.com" style={inputStyle} inputMode="email" />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>🔒 كلمة المرور</label>
                <div style={{ position: "relative" }}>
                  <input type={showPassword ? "text" : "password"} value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="8 أحرف على الأقل"
                    style={{ ...inputStyle, paddingRight: 44 }} />
                  <button onClick={() => setShowPassword(p => !p)} style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, padding: 0,
                  }}>{showPassword ? "🙈" : "👁"}</button>
                </div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
                  {regPassword.length > 0 && (
                    <span style={{ color: regPassword.length >= 8 ? C.green : C.red }}>
                      {regPassword.length >= 8 ? "✓ قوية" : `${8 - regPassword.length} أحرف كمان`}
                    </span>
                  )}
                </div>
              </div>

              {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 16, padding: "10px 14px", background: C.redDim, borderRadius: 8, border: `1px solid ${C.red}44` }}>⚠ {error}</div>}

              <button onClick={registerWithEmail} disabled={loading} style={{
                ...btnPrimary(),
                background: `linear-gradient(135deg, ${C.purple}, #7c3aed)`,
                boxShadow: `0 8px 32px ${C.purple}44`,
              }}>
                {loading ? "جاري إنشاء الحساب..." : "إنشاء الحساب ✨"}
              </button>
            </>
          )}

          {/* LOGIN WITH EMAIL STEP */}
          {step === "login-email" && (
            <>
              <button onClick={() => { setStep("phone"); setError(""); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
                {dir === "rtl" ? "رجوع →" : "← Back"}
              </button>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🔑</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>دخول لحسابك</div>
                <div style={{ color: C.muted, fontSize: 13 }}>أدخل بريدك الإلكتروني وكلمة المرور</div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>📧 البريد الإلكتروني</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && loginWithEmail()}
                  placeholder="ahmed@example.com"
                  style={inputStyle}
                  inputMode="email"
                  autoFocus
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>🔒 كلمة المرور</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && loginWithEmail()}
                    placeholder="كلمة المرور"
                    style={{ ...inputStyle, paddingRight: 44 }}
                    onFocus={e => e.target.style.borderColor = C.accent}
                    onBlur={e => e.target.style.borderColor = C.border}
                  />
                  <button onClick={() => setShowLoginPassword(p => !p)} style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, padding: 0,
                  }}>{showLoginPassword ? "🙈" : "👁"}</button>
                </div>
              </div>

              {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 16, padding: "10px 14px", background: C.redDim, borderRadius: 8, border: `1px solid ${C.red}44` }}>⚠ {error}</div>}

              <button onClick={loginWithEmail} disabled={loading} style={{
                ...btnPrimary(),
                background: `linear-gradient(135deg, ${C.accent}, #0066ff)`,
                boxShadow: `0 8px 32px ${C.accentGlow}`,
                color: "#000",
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}>
                {loading ? "⏳ جاري تسجيل الدخول..." : "🔑 دخول"}
              </button>

              <div style={{ textAlign: "center", marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ color: C.muted, fontSize: 13 }}>مش عندك حساب؟</span>
                <button onClick={() => { setStep("register"); setError(""); }} style={{
                  background: "none", border: "none", color: C.purple, cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0,
                }}>✨ إنشاء حساب جديد</button>
              </div>
            </>
          )}

          {/* PHONE INPUT STEP */}
          {step === "phoneInput" && (
            <>
              <button onClick={() => { setStep("phone"); setError(""); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
                ← Back
              </button>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t("signIn")}</div>
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>{t("enterPhone")}</div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{t("country")}</label>
                <select value={country} onChange={e => setCountry(e.target.value)} style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}>
                  {countries.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>{t("phoneNumber")}</label>
                <div style={{ display: "flex", alignItems: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "13px 14px", color: C.accent, fontWeight: 700, borderRight: `1px solid ${C.border}`, fontFamily: "monospace", flexShrink: 0 }}>{country}</div>
                  <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={e => e.key === "Enter" && sendOTP()}
                    placeholder="1128381838" inputMode="tel" autoFocus
                    style={{ flex: 1, background: "transparent", border: "none", padding: "13px 16px", color: C.text, fontSize: 16, outline: "none", fontFamily: "monospace" }} />
                </div>
              </div>

              {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 16, padding: "10px 14px", background: C.redDim, borderRadius: 8, border: `1px solid ${C.red}44` }}>⚠ {error}</div>}

              <button onClick={sendOTP} disabled={loading} style={btnPrimary(loading ? { opacity: 0.5, cursor: "not-allowed" } : {})}>
                {loading ? t("sending") : t("sendCode")}
              </button>
              <div ref={recaptchaRef} />
            </>
          )}

          {/* OTP STEP */}
          {step === "otp" && (
            <>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t("enterCode")}</div>
                <div style={{ color: C.muted, fontSize: 13, marginBottom: 28 }}>
                  {t("codeSentTo")} <span style={{ color: C.accent }}>{country} {phone}</span>
                </div>
              </div>
              <OTPInput length={6} onComplete={verifyOTP} disabled={loading} />
              {loading && <div style={{ textAlign: "center", color: C.muted, marginTop: 16, fontSize: 13 }}>{t("verifying")}</div>}
              {error && <div style={{ color: C.red, fontSize: 13, marginTop: 16, padding: "10px 14px", background: C.redDim, borderRadius: 8, textAlign: "center" }}>⚠ {error}</div>}
              <button onClick={() => { setStep("phoneInput"); setError(""); }} style={{
                width: "100%", marginTop: 20, padding: "12px", borderRadius: 12,
                border: `1px solid ${C.border}`, background: "transparent",
                color: C.muted, fontSize: 14, cursor: "pointer",
              }}>{t("changeNumber")}</button>
            </>
          )}

          {/* 2FA STEP */}
          {step === "twofa" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🔐</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t("twoFATitle")}</div>
                <div style={{ color: C.muted, fontSize: 13 }}>{t("twoFADesc")}</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>2FA CODE / BACKUP CODE</label>
                <input
                  value={twoFACode}
                  onChange={e => setTwoFACode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && verify2FA()}
                  placeholder="000000"
                  maxLength={10}
                  inputMode="numeric"
                  style={{ ...inputStyle, textAlign: "center", fontSize: 24, letterSpacing: 6, fontFamily: "monospace" }}
                />
              </div>
              {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 16, padding: "10px 14px", background: C.redDim, borderRadius: 8 }}>⚠ {error}</div>}
              <button onClick={verify2FA} disabled={loading} style={btnPrimary(loading ? { opacity: 0.5 } : {})}>
                {loading ? "⏳ Verifying..." : "🔓 Verify"}
              </button>
            </>
          )}

          {/* NAME STEP */}
          {step === "name" && (
            <>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t("almostThere")}</div>
                <div style={{ color: C.muted, fontSize: 13, marginBottom: 28 }}>{t("chooseDisplayName")}</div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>{t("yourName")}</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && document.getElementById("bdayInput").focus()}
                  placeholder="Ahmed Mohamed" autoFocus
                  style={inputStyle} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>📅 تاريخ الميلاد</label>
                <input
                  id="bdayInput"
                  type="date"
                  value={birthday}
                  onChange={e => setBirthday(e.target.value)}
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 13)).toISOString().split("T")[0]}
                  style={{ ...inputStyle, colorScheme: "dark" }}
                />
              </div>
              {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 16, padding: "10px 14px", background: C.redDim, borderRadius: 8 }}>⚠ {error}</div>}
              <button onClick={saveName} disabled={loading} style={btnPrimary(loading ? { opacity: 0.5 } : {})}>
                {loading ? t("saving") : t("startTalking")}
              </button>
            </>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 16, color: C.muted, fontSize: 11, letterSpacing: 0.5 }}>
          {t("terms")}
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 60px ${C.accentGlow},0 0 120px ${C.accentGlow}44} 50%{box-shadow:0 0 80px ${C.accent}88,0 0 160px ${C.accent}44} }
        * { box-sizing: border-box; }
        input::placeholder { color: ${C.muted}; }
        select option { background: ${C.card}; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: ${C.bg}; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────────
export default function NexTalkApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(null); // null = show language picker
  const [AdminDashboard, setAdminDashboard] = useState(null);
  const [ChatScreen, setChatScreen] = useState(null);

  useEffect(() => {
    // Safety net: release loading after 8s no matter what
    const safetyTimeout = setTimeout(() => setLoading(false), 8000);

    const loadFirebase = async () => {
      try {
        const [
          { initializeApp, getApps },
          { getAuth, onAuthStateChanged, signInWithPhoneNumber, RecaptchaVerifier, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, createUserWithEmailAndPassword, signInWithEmailAndPassword },
          { getDatabase, ref, set, get, update, onValue },
        ] = await Promise.all([
          import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"),
          import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"),
          import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"),
        ]);

        // Load UI modules in background (non-blocking)
        import("./nextalk-dashboard-v2").then(m => setAdminDashboard(() => m.default)).catch(() => {});
        import("./nextalk-chat").then(m => setChatScreen(() => m.default)).catch(() => {});

        if (!getApps().length) firebaseApp = initializeApp(FIREBASE_CONFIG);
        else firebaseApp = getApps()[0];
        firebaseAuth = getAuth(firebaseApp);
        firebaseDB = getDatabase(firebaseApp);
        window.firebase_signInWithPhoneNumber = signInWithPhoneNumber;
        window.firebase_RecaptchaVerifier = RecaptchaVerifier;
        window.firebase_ref = ref;
        window.firebase_set = set;
        window.firebase_get = get;
        window.firebase_update = update;
        window.firebase_onValue = onValue;
        window._firebaseDB = firebaseDB;
        window.firebase_GoogleAuthProvider = GoogleAuthProvider;
        window.firebase_signInWithPopup = signInWithPopup;
        window.firebase_signInWithRedirect = signInWithRedirect;
        window.firebase_getRedirectResult = getRedirectResult;
        window.firebase_createUserWithEmailAndPassword = createUserWithEmailAndPassword;
        window.firebase_signInWithEmailAndPassword = signInWithEmailAndPassword;

        // Handle redirect result after mobile Google sign-in
        try {
          const redirectResult = await getRedirectResult(firebaseAuth);
          if (redirectResult && redirectResult.user) {
            // Will be caught by onAuthStateChanged below
          }
        } catch (redirectErr) {
          console.warn("Redirect result error:", redirectErr);
        }

        onAuthStateChanged(firebaseAuth, async (fireUser) => {
          clearTimeout(safetyTimeout);
          // Release the splash screen immediately — Firebase auth state is known
          setLoading(false);
          if (fireUser) {
            try {
              let snap = await get(ref(firebaseDB, `users/${fireUser.uid}`));
              if (!snap.exists()) {
                // Wait briefly for DB write (registration race condition)
                await new Promise(r => setTimeout(r, 2000));
                snap = await get(ref(firebaseDB, `users/${fireUser.uid}`));
              }
              if (snap.exists()) {
                const userData = snap.val();
                setUser(prev => {
                  if (prev) return prev; // Already logged in via LoginScreen.onLogin
                  if (userData.lang) setLang(userData.lang);
                  setupPresence(fireUser.uid, firebaseDB, ref, set, null);
                  update(ref(firebaseDB, `users/${fireUser.uid}`), { lastLogin: Date.now(), status: "online" });
                  return userData;
                });
              } else if (fireUser.providerData?.[0]?.providerId === "google.com") {
                // New Google user - create profile
                const userData = {
                  uid: fireUser.uid,
                  name: fireUser.displayName || "User",
                  phone: fireUser.phoneNumber || "",
                  username: "@" + (fireUser.displayName || "user").replace(/\s+/g, "_").toLowerCase() + "_" + Math.floor(Math.random() * 9999),
                  photoURL: fireUser.photoURL || null,
                  email: fireUser.email || null,
                  premium: false, badge: null,
                  joinedAt: new Date().toISOString(),
                  isAdmin: false, lastLogin: Date.now(),
                  twoFA: { enabled: false }, authProvider: "google",
                };
                await set(ref(firebaseDB, `users/${fireUser.uid}`), userData);
                setUser(prev => prev || userData);
                setLang(prev => prev || "ar");
              }
              // For phone/email: onLogin() in LoginScreen already called setUser
            } catch (e) {
              console.warn("onAuthStateChanged DB error:", e);
            }
          } else {
            setUser(null);
          }
        });
      } catch (e) {
        clearTimeout(safetyTimeout);
        console.warn("Firebase load error:", e);
        setLoading(false);
      }
    };
    loadFirebase();
    return () => clearTimeout(safetyTimeout);
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20, animation: "glowPulse 1.5s ease-in-out infinite", padding: 8 }}><NexTalkLogo size={56} /></div>
        <div style={{ color: C.accent, fontSize: 26, fontWeight: 900, letterSpacing: 4, fontFamily: "Georgia, serif" }}>NEX<span style={{ color: C.text }}>TALK</span></div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 8, letterSpacing: 2 }}>LOADING...</div>
        <style>{`@keyframes glowPulse{0%,100%{box-shadow:0 0 40px ${C.accentGlow}}50%{box-shadow:0 0 70px ${C.accent}88}}`}</style>
      </div>
    );
  }

  // Step 1: Language selection
  if (!lang) return <LanguagePicker onSelect={setLang} />;

  // Step 2: Auth
  if (!user) return <LoginScreen onLogin={(userData) => { setUser(userData); setLang(userData.lang || lang); setLoading(false); }} lang={lang} />;

  // Step 3: Route based on role
  const onLogout = () => { if (firebaseAuth) firebaseAuth.signOut?.(); setUser(null); };

  if (user.isAdmin) {
    // Admin → Dashboard
    if (!AdminDashboard) {
      import("./nextalk-dashboard-v2").then(module => {
        setAdminDashboard(() => module.default);
      }).catch(() => {});
      return (
        <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20, animation: "glowPulse 1.5s ease-in-out infinite", padding: 8 }}><NexTalkLogo size={56} /></div>
          <div style={{ color: C.accent, fontSize: 26, fontWeight: 900, letterSpacing: 4, fontFamily: "Georgia, serif" }}>NEX<span style={{ color: C.text }}>TALK</span></div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 8, letterSpacing: 2 }}>LOADING DASHBOARD...</div>
          <style>{`@keyframes glowPulse{0%,100%{box-shadow:0 0 40px ${C.accentGlow}}50%{box-shadow:0 0 70px ${C.accent}88}}`}</style>
        </div>
      );
    }
    return <AdminDashboard currentUser={user} lang={lang} onLogout={onLogout} />;
  }

  // Regular user → Chat App
  if (!ChatScreen) {
    import("./nextalk-chat").then(module => {
      setChatScreen(() => module.default);
    }).catch(() => {});
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20, animation: "glowPulse 1.5s ease-in-out infinite", padding: 8 }}><NexTalkLogo size={56} /></div>
        <div style={{ color: C.accent, fontSize: 26, fontWeight: 900, letterSpacing: 4, fontFamily: "Georgia, serif" }}>NEX<span style={{ color: C.text }}>TALK</span></div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 8, letterSpacing: 2 }}>LOADING...</div>
        <style>{`@keyframes glowPulse{0%,100%{box-shadow:0 0 40px ${C.accentGlow}}50%{box-shadow:0 0 70px ${C.accent}88}}`}</style>
      </div>
    );
  }
  return <ChatScreen currentUser={user} lang={lang} onBack={onLogout} />;
}
