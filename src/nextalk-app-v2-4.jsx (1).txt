import { useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, onAuthStateChanged,
  signInWithPhoneNumber, RecaptchaVerifier,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
} from "firebase/auth";
import { getDatabase, ref, set, get, update, onValue } from "firebase/database";
import { LANGUAGES, useTranslation } from "./i18n";
import {
  getDeviceFingerprint, checkRateLimit, resetRateLimit,
  verifyTOTP, createSession,
  generateBackupCodes, verifyBackupCode, setupPresence,
} from "./security";

// ─── Firebase Config ───────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyApF9k0_crAuhRhD5FbBWPNm_Q0JDENB-0",
  authDomain: "nextalk-4ef19.firebaseapp.com",
  projectId: "nextalk-4ef19",
  storageBucket: "nextalk-4ef19.firebasestorage.app",
  messagingSenderId: "446566340447",
  appId: "1:446566340447:web:533571f65218c20d1548ea",
  databaseURL: "https://nextalk-4ef19-default-rtdb.firebaseio.com",
};

// Init Firebase once
const firebaseApp = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const firebaseAuth = getAuth(firebaseApp);
const firebaseDB = getDatabase(firebaseApp);

// Make firebase available globally for other modules (chat, dashboard, notifications)
window._firebaseDB = firebaseDB;
window.firebase_ref = ref;
window.firebase_set = set;
window.firebase_get = get;
window.firebase_update = update;
window.firebase_onValue = onValue;
window.firebase_signInWithPhoneNumber = signInWithPhoneNumber;
window.firebase_RecaptchaVerifier = RecaptchaVerifier;
window.firebase_GoogleAuthProvider = GoogleAuthProvider;
window.firebase_signInWithPopup = signInWithPopup;
window.firebase_signInWithRedirect = signInWithRedirect;
window.firebase_getRedirectResult = getRedirectResult;
window.firebase_createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.firebase_signInWithEmailAndPassword = signInWithEmailAndPassword;

// ─── Colors ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#060a14", surface: "#0d1321", card: "#111827",
  border: "#1e2d45", borderGlow: "#00d4ff22",
  accent: "#00d4ff", accentDim: "#00d4ff18", accentGlow: "#00d4ff55",
  gold: "#ffd700", goldDim: "#ffd70018",
  green: "#00ff88", greenDim: "#00ff8818",
  red: "#ff3366", redDim: "#ff336618",
  purple: "#a855f7", purpleDim: "#a855f718",
  text: "#e2e8f0", muted: "#64748b", dim: "#334155",
};

// ─── Logo ──────────────────────────────────────────────────────────────────────
function NexTalkLogo({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ntBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a6fff" />
          <stop offset="100%" stopColor="#0047cc" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#ntBg)" />
      <circle cx="50" cy="50" r="36" fill="#2979ff" opacity="0.55" />
      <path d="M29 67 L29 34 L37 34 L53 56 L53 34 L61 34 L61 54"
        stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M27 71 Q25 80 18 83 Q29 80 35 74 Z" fill="white" opacity="0.9" />
      <path d="M57 44 L70 32 M64 32 L70 32 L70 39"
        stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M63 59 Q69 71 58 76 Q46 80 37 72"
        stroke="white" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M35 68 L37 73 L42 70"
        stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ─── Loading Screen ────────────────────────────────────────────────────────────
function LoadingScreen({ text = "LOADING..." }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: 22, background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, padding: 8, animation: "glow 1.5s ease-in-out infinite" }}>
        <NexTalkLogo size={56} />
      </div>
      <div style={{ color: C.accent, fontSize: 26, fontWeight: 900, letterSpacing: 4, fontFamily: "Georgia, serif" }}>
        NEX<span style={{ color: C.text }}>TALK</span>
      </div>
      <div style={{ color: C.muted, fontSize: 12, marginTop: 8, letterSpacing: 2 }}>{text}</div>
      <style>{`@keyframes glow{0%,100%{box-shadow:0 0 40px ${C.accentGlow}}50%{box-shadow:0 0 70px ${C.accent}88}}`}</style>
    </div>
  );
}

// ─── Particles Background ──────────────────────────────────────────────────────
function ParticlesBG() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener("resize", resize);
    const pts = Array.from({ length: 60 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.3, hue: Math.random() > 0.7 ? 280 : 195,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},100%,70%,0.5)`; ctx.fill();
      });
      pts.forEach((a, i) => pts.slice(i + 1).forEach(b => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 100) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(0,212,255,${0.07 * (1 - d / 100)})`; ctx.lineWidth = 0.5; ctx.stroke();
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
  const refs = useRef(Array.from({ length }, () => ({ current: null }))).current;
  const handle = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const n = [...vals]; n[i] = v; setVals(n);
    if (v && i < length - 1) refs[i + 1].current?.focus();
    if (n.every(x => x)) onComplete(n.join(""));
  };
  const handleKey = (i, e) => { if (e.key === "Backspace" && !vals[i] && i > 0) refs[i - 1].current?.focus(); };
  const handlePaste = (e) => {
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (p.length === length) { setVals(p.split("")); refs[length - 1].current?.focus(); onComplete(p); }
    e.preventDefault();
  };
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      {vals.map((v, i) => (
        <input key={i} ref={refs[i]} value={v} maxLength={1} inputMode="numeric" disabled={disabled}
          onChange={e => handle(i, e.target.value)} onKeyDown={e => handleKey(i, e)} onPaste={handlePaste}
          style={{ width: 46, height: 54, textAlign: "center", fontSize: 20, fontWeight: 700, background: v ? C.accentDim : C.surface, border: `2px solid ${v ? C.accent : C.border}`, borderRadius: 12, color: C.text, outline: "none", fontFamily: "monospace", opacity: disabled ? 0.5 : 1 }} />
      ))}
    </div>
  );
}

// ─── Language Picker ───────────────────────────────────────────────────────────
function LanguagePicker({ onSelect }) {
  const [selected, setSelected] = useState("ar");
  const [search, setSearch] = useState("");
  const filtered = LANGUAGES.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.code.includes(search.toLowerCase()));
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative" }}>
      <ParticlesBG />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, margin: "0 auto 16px", background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 60px ${C.accentGlow}` }}>
            <NexTalkLogo size={52} />
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 4, color: C.text }}>Nex<span style={{ color: C.accent }}>Talk</span></div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, padding: "28px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>🌍 اختار لغتك</div>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ابحث..." style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", color: C.text, fontSize: 14, outline: "none", marginBottom: 14, boxSizing: "border-box" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: 280, overflowY: "auto", marginBottom: 18 }}>
            {filtered.map(lang => (
              <button key={lang.code} onClick={() => setSelected(lang.code)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, cursor: "pointer", background: selected === lang.code ? C.accentDim : C.card, border: `2px solid ${selected === lang.code ? C.accent : C.border}`, color: selected === lang.code ? C.accent : C.text, fontWeight: selected === lang.code ? 700 : 400, fontSize: 13, textAlign: "left" }}>
                <span style={{ fontSize: 18 }}>{lang.flag}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lang.name}</span>
                {selected === lang.code && <span style={{ marginLeft: "auto" }}>✓</span>}
              </button>
            ))}
          </div>
          <button onClick={() => onSelect(selected)} style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, color: "#000", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
            متابعة →
          </button>
        </div>
      </div>
      <style>{`::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}`}</style>
    </div>
  );
}

// ─── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, lang }) {
  const t = useTranslation(lang);
  const langObj = LANGUAGES.find(l => l.code === lang) || LANGUAGES[1];
  const dir = langObj.dir || "ltr";

  const [step, setStep] = useState("main");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("+20");
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regGender, setRegGender] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmResult, setConfirmResult] = useState(null);
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFAPending, setTwoFAPending] = useState(null);
  const deviceFP = useRef(getDeviceFingerprint());

  const countries = [
    { code: "+20", flag: "🇪🇬", name: "Egypt" }, { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
    { code: "+971", flag: "🇦🇪", name: "UAE" }, { code: "+965", flag: "🇰🇼", name: "Kuwait" },
    { code: "+974", flag: "🇶🇦", name: "Qatar" }, { code: "+1", flag: "🇺🇸", name: "USA" },
    { code: "+44", flag: "🇬🇧", name: "UK" }, { code: "+49", flag: "🇩🇪", name: "Germany" },
    { code: "+33", flag: "🇫🇷", name: "France" }, { code: "+7", flag: "🇷🇺", name: "Russia" },
    { code: "+86", flag: "🇨🇳", name: "China" }, { code: "+91", flag: "🇮🇳", name: "India" },
    { code: "+55", flag: "🇧🇷", name: "Brazil" }, { code: "+90", flag: "🇹🇷", name: "Turkey" },
    { code: "+213", flag: "🇩🇿", name: "Algeria" }, { code: "+216", flag: "🇹🇳", name: "Tunisia" },
    { code: "+212", flag: "🇲🇦", name: "Morocco" }, { code: "+81", flag: "🇯🇵", name: "Japan" },
    { code: "+82", flag: "🇰🇷", name: "Korea" }, { code: "+92", flag: "🇵🇰", name: "Pakistan" },
  ];

  const inp = { width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px 16px", color: C.text, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const lbl = { color: C.muted, fontSize: 11, letterSpacing: 2, display: "block", marginBottom: 8, fontWeight: 700 };
  const btnBlue = { width: "100%", padding: 14, borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, color: "#000", fontSize: 15, fontWeight: 800, cursor: "pointer" };
  const errEl = error ? <div style={{ color: C.red, fontSize: 13, marginBottom: 14, padding: "10px 14px", background: C.redDim, borderRadius: 8, border: `1px solid ${C.red}44` }}>⚠ {error}</div> : null;
  const backBtn = (to = "main") => <button onClick={() => { setStep(to); setError(""); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0 }}>← رجوع</button>;

  const sendOTP = async () => {
    if (!phone || phone.length < 7) { setError("رقم التليفون قصير جداً"); return; }
    const rl = checkRateLimit(`otp_${phone}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) { setError(rl.reason); return; }
    setLoading(true); setError("");
    try {
      const cleaned = phone.replace(/^0+/, "");
      const fullPhone = country + cleaned;
      if (window.recaptchaVerifier) { try { window.recaptchaVerifier.clear(); } catch (_) {} window.recaptchaVerifier = null; }
      const container = document.createElement("div");
      container.id = "rc_" + Date.now();
      document.body.appendChild(container);
      window.recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, container, { size: "invisible" });
      await window.recaptchaVerifier.render();
      const result = await signInWithPhoneNumber(firebaseAuth, fullPhone, window.recaptchaVerifier);
      setConfirmResult(result);
      try { document.body.removeChild(container); } catch (_) {}
      setStep("otp");
    } catch (e) {
      if (window.recaptchaVerifier) { try { window.recaptchaVerifier.clear(); } catch (_) {} window.recaptchaVerifier = null; }
      if (e.code === "auth/invalid-phone-number") setError("رقم التليفون غلط");
      else if (e.code === "auth/too-many-requests") setError("كتير أوي، استنى شوية");
      else setError(e.message || "فشل إرسال الكود");
    }
    setLoading(false);
  };

  const verifyOTP = async (code) => {
    setLoading(true); setError("");
    try {
      let uid;
      if (confirmResult) {
        const cred = await confirmResult.confirm(code);
        uid = cred.user.uid;
      } else {
        uid = "demo_" + phone;
      }
      const snap = await get(ref(firebaseDB, `users/${uid}`));
      if (snap.exists()) {
        const userData = snap.val();
        if (userData.twoFA?.enabled) { setTwoFAPending(uid); setStep("twofa"); setLoading(false); return; }
        await set(ref(firebaseDB, `users/${uid}/lastLogin`), Date.now());
        onLogin({ ...userData, lastLogin: Date.now() });
      } else {
        setStep("name");
      }
      resetRateLimit(`otp_${phone}`);
    } catch (e) { setError("كود غلط، حاول تاني"); }
    setLoading(false);
  };

  const verify2FA = async () => {
    if (!twoFAPending) return;
    setLoading(true); setError("");
    try {
      const snap = await get(ref(firebaseDB, `users/${twoFAPending}/twoFA`));
      const { secret, backupCodes } = snap.val();
      if (await verifyTOTP(secret, twoFACode)) {
        const userSnap = await get(ref(firebaseDB, `users/${twoFAPending}`));
        if (userSnap.exists()) onLogin(userSnap.val());
      } else {
        const { valid, remaining } = verifyBackupCode(backupCodes || [], twoFACode);
        if (valid) {
          await update(ref(firebaseDB, `users/${twoFAPending}/twoFA`), { backupCodes: remaining });
          const userSnap = await get(ref(firebaseDB, `users/${twoFAPending}`));
          if (userSnap.exists()) onLogin(userSnap.val());
        } else { setError("كود غلط"); }
      }
    } catch (e) { setError("فشل التحقق"); }
    setLoading(false);
  };

  const signInGoogle = async () => {
    setLoading(true); setError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      let fireUser;
      if (isMobile) {
        await signInWithRedirect(firebaseAuth, provider);
        return;
      } else {
        const result = await signInWithPopup(firebaseAuth, provider);
        fireUser = result.user;
      }
      const snap = await get(ref(firebaseDB, `users/${fireUser.uid}`));
      if (snap.exists()) {
        onLogin(snap.val());
      } else {
        const userData = {
          uid: fireUser.uid, name: fireUser.displayName || "User",
          phone: "", username: "@" + (fireUser.displayName || "user").replace(/\s+/g, "_").toLowerCase() + "_" + Math.floor(Math.random() * 9999),
          photoURL: fireUser.photoURL || null, email: fireUser.email || null,
          premium: false, badge: null, joinedAt: new Date().toISOString(),
          isAdmin: false, lang, lastLogin: Date.now(),
          twoFA: { enabled: false }, authProvider: "google",
        };
        await set(ref(firebaseDB, `users/${fireUser.uid}`), userData);
        onLogin(userData);
      }
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") setError(e.message || "فشل تسجيل الدخول بـ Google");
    }
    setLoading(false);
  };

  const registerWithEmail = async () => {
    if (!name.trim()) { setError("أدخل اسمك"); return; }
    if (!regUsername.trim() || !/^[a-zA-Z0-9_]{3,20}$/.test(regUsername)) { setError("اسم المستخدم: 3-20 حرف إنجليزي"); return; }
    if (!birthday) { setError("أدخل تاريخ ميلادك"); return; }
    const age = new Date().getFullYear() - new Date(birthday).getFullYear();
    if (age < 13) { setError("يجب أن يكون عمرك 13 سنة على الأقل"); return; }
    if (!regGender) { setError("اختر جنسك"); return; }
    if (!regEmail.trim() || !/\S+@\S+\.\S+/.test(regEmail)) { setError("بريد إلكتروني غير صحيح"); return; }
    if (regPassword.length < 8) { setError("كلمة المرور 8 أحرف على الأقل"); return; }
    setLoading(true); setError("");
    try {
      const usernameSnap = await get(ref(firebaseDB, `usernames/${regUsername.toLowerCase()}`));
      if (usernameSnap.exists()) { setError("اسم المستخدم موجود، جرب تاني"); setLoading(false); return; }
      const result = await createUserWithEmailAndPassword(firebaseAuth, regEmail.trim(), regPassword);
      const fireUser = result.user;
      const userData = {
        uid: fireUser.uid, name: name.trim(),
        username: "@" + regUsername.trim().toLowerCase(),
        email: regEmail.trim(), birthday, age, gender: regGender,
        phone: "", photoURL: null, premium: false, badge: null,
        joinedAt: new Date().toISOString(), isAdmin: false, lang,
        lastLogin: Date.now(), twoFA: { enabled: false }, authProvider: "email",
      };
      await set(ref(firebaseDB, `users/${fireUser.uid}`), userData);
      await set(ref(firebaseDB, `usernames/${regUsername.trim().toLowerCase()}`), fireUser.uid);
      onLogin(userData);
    } catch (e) {
      if (e.code === "auth/email-already-in-use") setError("البريد الإلكتروني مستخدم بالفعل");
      else if (e.code === "auth/weak-password") setError("كلمة المرور ضعيفة جداً");
      else setError(e.message || "حدث خطأ");
    }
    setLoading(false);
  };

  const loginWithEmail = async () => {
    if (!loginEmail.trim() || !/\S+@\S+\.\S+/.test(loginEmail)) { setError("بريد إلكتروني غير صحيح"); return; }
    if (!loginPassword) { setError("أدخل كلمة المرور"); return; }
    setLoading(true); setError("");
    try {
      const result = await signInWithEmailAndPassword(firebaseAuth, loginEmail.trim(), loginPassword);
      const fireUser = result.user;
      const snap = await get(ref(firebaseDB, `users/${fireUser.uid}`));
      if (snap.exists()) {
        const userData = snap.val();
        await set(ref(firebaseDB, `users/${fireUser.uid}/lastLogin`), Date.now());
        onLogin({ ...userData, lastLogin: Date.now() });
      } else {
        const userData = {
          uid: fireUser.uid, name: fireUser.displayName || loginEmail.split("@")[0],
          username: "@user_" + Math.floor(Math.random() * 99999), email: fireUser.email,
          photoURL: null, premium: false, badge: null,
          joinedAt: new Date().toISOString(), isAdmin: false, lang,
          lastLogin: Date.now(), twoFA: { enabled: false }, authProvider: "email",
        };
        await set(ref(firebaseDB, `users/${fireUser.uid}`), userData);
        onLogin(userData);
      }
    } catch (e) {
      if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") setError("البريد أو كلمة المرور غلط");
      else if (e.code === "auth/too-many-requests") setError("كتير أوي، استنى شوية");
      else setError(e.message || "حدث خطأ");
    }
    setLoading(false);
  };

  const saveName = async () => {
    if (!name.trim()) { setError("أدخل اسمك"); return; }
    if (!birthday) { setError("أدخل تاريخ ميلادك"); return; }
    const age = new Date().getFullYear() - new Date(birthday).getFullYear();
    if (age < 13) { setError("يجب أن يكون عمرك 13 سنة على الأقل"); return; }
    setLoading(true);
    try {
      const uid = firebaseAuth.currentUser?.uid || "demo_" + Date.now();
      const userData = {
        uid, name: name.trim(), phone: country + phone,
        username: "@user_" + Math.floor(Math.random() * 99999),
        photoURL: null, premium: false, badge: null, birthday, age,
        joinedAt: new Date().toISOString(),
        isAdmin: phone === "1128381838" || phone === "01128381838",
        lang, lastLogin: Date.now(), twoFA: { enabled: false },
      };
      await set(ref(firebaseDB, `users/${uid}`), userData);
      createSession(uid, { fingerprint: deviceFP.current });
      onLogin(userData);
    } catch (e) { setError("حدث خطأ في الحفظ"); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", direction: dir }}>
      <ParticlesBG />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, margin: "0 auto 14px", background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 60px ${C.accentGlow}` }}>
            <NexTalkLogo size={52} />
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 4, color: C.text }}>Nex<span style={{ color: C.accent }}>Talk</span></div>
          <div style={{ color: C.muted, fontSize: 10, marginTop: 4, letterSpacing: 3 }}>{t("appTagline")}</div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, padding: "28px 24px" }}>

          {step === "main" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{t("signIn")}</div>
                <div style={{ color: C.muted, fontSize: 13 }}>اختار طريقة تسجيل الدخول</div>
              </div>
              <button onClick={signInGoogle} disabled={loading} style={{ width: "100%", padding: 14, borderRadius: 14, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10, opacity: loading ? 0.5 : 1 }}>
                <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" /><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" /><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" /><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" /></svg>
                Continue with Google
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0" }}>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <span style={{ color: C.muted, fontSize: 12 }}>أو</span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>
              <button onClick={() => { setStep("login-email"); setError(""); }} disabled={loading} style={{ width: "100%", padding: 14, borderRadius: 14, border: `2px solid ${C.accent}66`, background: C.accentDim, color: C.accent, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
                <span>🔑</span> دخول بالبريد الإلكتروني
              </button>
              <button onClick={() => { setStep("register"); setError(""); }} disabled={loading} style={{ width: "100%", padding: 14, borderRadius: 14, border: `1px solid ${C.purple}66`, background: C.purpleDim, color: C.purple, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span>✨</span> إنشاء حساب جديد
              </button>
              {errEl}
            </>
          )}

          {step === "phoneInput" && (
            <>
              {backBtn()}
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{t("signIn")}</div>
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>{t("enterPhone")}</div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{t("country")}</label>
                <select value={country} onChange={e => setCountry(e.target.value)} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
                  {countries.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>{t("phoneNumber")}</label>
                <div style={{ display: "flex", alignItems: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "13px 14px", color: C.accent, fontWeight: 700, borderRight: `1px solid ${C.border}`, fontFamily: "monospace" }}>{country}</div>
                  <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && sendOTP()} placeholder="1128381838" inputMode="tel" autoFocus style={{ flex: 1, background: "transparent", border: "none", padding: "13px 16px", color: C.text, fontSize: 16, outline: "none", fontFamily: "monospace" }} />
                </div>
              </div>
              {errEl}
              <button onClick={sendOTP} disabled={loading} style={{ ...btnBlue, opacity: loading ? 0.6 : 1 }}>
                {loading ? "جاري الإرسال..." : t("sendCode")}
              </button>
            </>
          )}

          {step === "otp" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📱</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{t("enterCode")}</div>
                <div style={{ color: C.muted, fontSize: 13 }}>{t("codeSentTo")} <span style={{ color: C.accent }}>{country} {phone}</span></div>
              </div>
              <OTPInput length={6} onComplete={verifyOTP} disabled={loading} />
              {loading && <div style={{ textAlign: "center", color: C.muted, marginTop: 12, fontSize: 13 }}>{t("verifying")}</div>}
              {errEl}
              <button onClick={() => { setStep("phoneInput"); setError(""); }} style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 14, cursor: "pointer" }}>{t("changeNumber")}</button>
            </>
          )}

          {step === "twofa" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🔐</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{t("twoFATitle")}</div>
                <div style={{ color: C.muted, fontSize: 13 }}>{t("twoFADesc")}</div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={lbl}>كود التحقق</label>
                <input value={twoFACode} onChange={e => setTwoFACode(e.target.value)} onKeyDown={e => e.key === "Enter" && verify2FA()} placeholder="000000" maxLength={10} inputMode="numeric" style={{ ...inp, textAlign: "center", fontSize: 24, letterSpacing: 6, fontFamily: "monospace" }} />
              </div>
              {errEl}
              <button onClick={verify2FA} disabled={loading} style={{ ...btnBlue, opacity: loading ? 0.6 : 1 }}>
                {loading ? "⏳ جاري التحقق..." : "🔓 تحقق"}
              </button>
            </>
          )}

          {step === "name" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{t("almostThere")}</div>
                <div style={{ color: C.muted, fontSize: 13 }}>{t("chooseDisplayName")}</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{t("yourName")}</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ahmed Mohamed" autoFocus style={inp} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>📅 تاريخ الميلاد</label>
                <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} max={new Date(new Date().setFullYear(new Date().getFullYear() - 13)).toISOString().split("T")[0]} style={{ ...inp, colorScheme: "dark" }} />
              </div>
              {errEl}
              <button onClick={saveName} disabled={loading} style={{ ...btnBlue, opacity: loading ? 0.6 : 1 }}>
                {loading ? t("saving") : t("startTalking")}
              </button>
            </>
          )}

          {step === "register" && (
            <>
              {backBtn()}
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 34, marginBottom: 8 }}>✨</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>إنشاء حساب جديد</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>👤 الاسم الكامل</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ahmed Mohamed" style={inp} autoFocus />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>🔖 اسم المستخدم</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.accent, fontWeight: 700 }}>@</span>
                  <input value={regUsername} onChange={e => setRegUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} placeholder="ahmed_dev" style={{ ...inp, paddingLeft: 30 }} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>📅 تاريخ الميلاد</label>
                <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} max={new Date(new Date().setFullYear(new Date().getFullYear() - 13)).toISOString().split("T")[0]} style={{ ...inp, colorScheme: "dark" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>⚧ الجنس</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[{ v: "male", label: "ذكر 👦" }, { v: "female", label: "أنثى 👧" }].map(g => (
                    <button key={g.v} onClick={() => setRegGender(g.v)} style={{ flex: 1, padding: 12, borderRadius: 12, border: `2px solid ${regGender === g.v ? C.accent : C.border}`, background: regGender === g.v ? C.accentDim : C.surface, color: regGender === g.v ? C.accent : C.text, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{g.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>📧 البريد الإلكتروني</label>
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="ahmed@example.com" style={inp} inputMode="email" />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={lbl}>🔒 كلمة المرور</label>
                <div style={{ position: "relative" }}>
                  <input type={showPass ? "text" : "password"} value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="8 أحرف على الأقل" style={{ ...inp, paddingRight: 44 }} />
                  <button onClick={() => setShowPass(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, padding: 0 }}>{showPass ? "🙈" : "👁"}</button>
                </div>
              </div>
              {errEl}
              <button onClick={registerWithEmail} disabled={loading} style={{ ...btnBlue, background: `linear-gradient(135deg, ${C.purple}, #7c3aed)`, opacity: loading ? 0.6 : 1 }}>
                {loading ? "جاري إنشاء الحساب..." : "إنشاء الحساب ✨"}
              </button>
            </>
          )}

          {step === "login-email" && (
            <>
              {backBtn()}
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 34, marginBottom: 8 }}>🔑</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>دخول لحسابك</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>📧 البريد الإلكتروني</label>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && loginWithEmail()} placeholder="ahmed@example.com" style={inp} inputMode="email" autoFocus />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>🔒 كلمة المرور</label>
                <div style={{ position: "relative" }}>
                  <input type={showLoginPass ? "text" : "password"} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && loginWithEmail()} placeholder="كلمة المرور" style={{ ...inp, paddingRight: 44 }} />
                  <button onClick={() => setShowLoginPass(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, padding: 0 }}>{showLoginPass ? "🙈" : "👁"}</button>
                </div>
              </div>
              {errEl}
              <button onClick={loginWithEmail} disabled={loading} style={{ ...btnBlue, opacity: loading ? 0.6 : 1 }}>
                {loading ? "⏳ جاري تسجيل الدخول..." : "🔑 دخول"}
              </button>
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <span style={{ color: C.muted, fontSize: 13 }}>مش عندك حساب؟ </span>
                <button onClick={() => { setStep("register"); setError(""); }} style={{ background: "none", border: "none", color: C.purple, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>إنشاء حساب ✨</button>
              </div>
            </>
          )}

        </div>
        <div style={{ textAlign: "center", marginTop: 14, color: C.muted, fontSize: 11 }}>{t("terms")}</div>
      </div>
      <style>{`* { box-sizing: border-box; } input::placeholder { color: ${C.muted}; } select option { background: ${C.card}; } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }`}</style>
    </div>
  );
}

// ─── Main App Shell with Bottom Nav ───────────────────────────────────────────
function AppShell({ user, lang, onLogout }) {
  const [activeTab, setActiveTab] = useState("chats");
  const [ChatScreen, setChatScreen] = useState(null);
  const [GroupsScreen, setGroupsScreen] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    import("./nextalk-chat").then(m => setChatScreen(() => m.default)).catch(() => {});
    import("./nextalk-groups").then(m => setGroupsScreen(() => m.default)).catch(() => {});
    // Load all users for group creation
    if (window.firebase_ref && window.firebase_onValue && window._firebaseDB) {
      const unsub = window.firebase_onValue(window.firebase_ref(window._firebaseDB, "users"), snap => {
        const data = snap.val() || {};
        setAllUsers(Object.values(data).filter(u => u.uid !== user.uid));
      });
      return () => unsub && unsub();
    }
  }, []);

  const tabs = [
    { id: "chats", icon: "💬", label: "Messages" },
    { id: "groups", icon: "🌐", label: "Groups" },
    { id: "profile", icon: "👤", label: "Profile" },
  ];

  const renderTab = () => {
    if (activeTab === "chats") {
      if (!ChatScreen) return <LoadingScreen text="LOADING..." />;
      return <ChatScreen currentUser={user} lang={lang} onBack={() => {}} />;
    }
    if (activeTab === "groups") {
      if (!GroupsScreen) return <LoadingScreen text="LOADING..." />;
      return <GroupsScreen currentUser={user} lang={lang} allUsers={allUsers} />;
    }
    if (activeTab === "profile") {
      return (
        <div style={{ height: "100%", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: user.photoURL ? "none" : `linear-gradient(135deg, ${C.accent}, ${C.purple})`, overflow: "hidden", border: `3px solid ${C.accent}44`, flexShrink: 0 }}>
            {user.photoURL ? <img src={user.photoURL} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 800, color: "#000" }}>{(user.name || "U")[0]}</div>}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>{user.name}</div>
            <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>{user.username || user.email || ""}</div>
            {user.premium && <div style={{ color: C.gold, fontSize: 14, marginTop: 4 }}>{user.badge || "⭐"} Premium</div>}
          </div>
          <div style={{ width: "100%", maxWidth: 340, background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            {[
              { icon: "📱", label: "Phone", val: user.phone || "—" },
              { icon: "🔖", label: "Username", val: user.username || "—" },
              { icon: "📧", label: "Email", val: user.email || "—" },
              { icon: "🌍", label: "Language", val: lang?.toUpperCase() || "—" },
            ].map((item, i) => (
              <div key={i} style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <div>
                  <div style={{ color: C.muted, fontSize: 11 }}>{item.label}</div>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{item.val}</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={onLogout} style={{ background: C.redDim, color: C.red, border: `1px solid ${C.red}44`, borderRadius: 14, padding: "14px 40px", fontWeight: 800, fontSize: 15, cursor: "pointer", marginTop: 8 }}>
            🚪 Sign Out
          </button>
        </div>
      );
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {renderTab()}
      </div>
      {/* Bottom Nav */}
      <div style={{ background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", flexShrink: 0 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "10px 0", background: "none", border: "none", cursor: "pointer",
            color: activeTab === tab.id ? C.accent : C.muted,
            borderTop: activeTab === tab.id ? `2px solid ${C.accent}` : "2px solid transparent",
            transition: "all 0.2s",
          }}>
            <span style={{ fontSize: 22, marginBottom: 2 }}>{tab.icon}</span>
            <span style={{ fontSize: 10, fontWeight: activeTab === tab.id ? 800 : 400, letterSpacing: 0.5 }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────────
export default function NexTalkApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("nextalk_lang") || null; } catch { return null; } });
  const [AdminDashboard, setAdminDashboard] = useState(null);
  const [redirectHandled, setRedirectHandled] = useState(false);

  const saveLang = (l) => { try { localStorage.setItem("nextalk_lang", l); } catch {} setLang(l); };

  useEffect(() => {
    // Handle Google redirect result on mobile (FIXED: properly await and handle user creation)
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(firebaseAuth);
        if (result?.user) {
          const fireUser = result.user;
          let snap = await get(ref(firebaseDB, `users/${fireUser.uid}`));
          if (!snap.exists()) {
            const userData = {
              uid: fireUser.uid, name: fireUser.displayName || "User",
              phone: "", username: "@" + (fireUser.displayName || "user").replace(/\s+/g, "_").toLowerCase() + "_" + Math.floor(Math.random() * 9999),
              photoURL: fireUser.photoURL || null, email: fireUser.email || null,
              premium: false, badge: null, joinedAt: new Date().toISOString(),
              isAdmin: false, lang: lang || "ar", lastLogin: Date.now(), twoFA: { enabled: false }, authProvider: "google",
            };
            await set(ref(firebaseDB, `users/${fireUser.uid}`), userData);
          }
        }
      } catch (e) { console.warn("Redirect result error:", e); }
      setRedirectHandled(true);
    };
    handleRedirect();

    import("./nextalk-dashboard-v2").then(m => setAdminDashboard(() => m.default)).catch(() => {});

    const unsub = onAuthStateChanged(firebaseAuth, async (fireUser) => {
      if (!fireUser) { setUser(null); setLoading(false); return; }
      try {
        let snap = await get(ref(firebaseDB, `users/${fireUser.uid}`));
        if (!snap.exists()) {
          await new Promise(r => setTimeout(r, 1500));
          snap = await get(ref(firebaseDB, `users/${fireUser.uid}`));
        }
        if (snap.exists()) {
          const userData = snap.val();
          if (userData.lang) saveLang(userData.lang);
          setupPresence(fireUser.uid, firebaseDB, ref, set, null);
          update(ref(firebaseDB, `users/${fireUser.uid}`), { lastLogin: Date.now(), status: "online" });
          setUser(userData);
        } else {
          // User in Firebase Auth but not in DB — create record (handles email + google + phone)
          const userData = {
            uid: fireUser.uid,
            name: fireUser.displayName || fireUser.email?.split("@")[0] || "User",
            username: "@user_" + Math.floor(Math.random() * 99999),
            email: fireUser.email || null,
            photoURL: fireUser.photoURL || null,
            phone: fireUser.phoneNumber || "",
            premium: false, badge: null,
            joinedAt: new Date().toISOString(),
            isAdmin: false, lang: lang || "ar",
            lastLogin: Date.now(), twoFA: { enabled: false },
            authProvider: fireUser.providerData?.[0]?.providerId || "unknown",
          };
          await set(ref(firebaseDB, `users/${fireUser.uid}`), userData);
          saveLang(lang || "ar");
          setUser(userData);
        }
      } catch (e) { console.warn("Auth state error:", e); }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) return <LoadingScreen />;
  if (!lang) return <LanguagePicker onSelect={saveLang} />;
  if (!user) return <LoginScreen onLogin={(userData) => { setUser(userData); saveLang(userData.lang || lang); }} lang={lang} />;

  const onLogout = () => { firebaseAuth.signOut(); setUser(null); };

  if (user.isAdmin) {
    if (!AdminDashboard) {
      import("./nextalk-dashboard-v2").then(m => setAdminDashboard(() => m.default)).catch(() => {});
      return <LoadingScreen text="LOADING DASHBOARD..." />;
    }
    return <AdminDashboard currentUser={user} lang={lang} onLogout={onLogout} />;
  }

  return <AppShell user={user} lang={lang} onLogout={onLogout} />;
}
