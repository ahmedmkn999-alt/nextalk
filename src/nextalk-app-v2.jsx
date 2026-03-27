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
          }}>💬</div>
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

  const [step, setStep] = useState("phone"); // phone | otp | twofa | name
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("+20");
  const [name, setName] = useState("");
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
      // Fix: strip ALL leading zeros then build E.164
      const cleaned = phone.replace(/^0+/, "");
      const fullPhone = country + cleaned;
      if (firebaseAuth && window.firebase_signInWithPhoneNumber) {
        // Fix: always recreate verifier to avoid stale state
        if (window.recaptchaVerifier) {
          try { window.recaptchaVerifier.clear(); } catch (_) {}
          window.recaptchaVerifier = null;
        }
        window.recaptchaVerifier = new window.firebase_RecaptchaVerifier(
          firebaseAuth, recaptchaRef.current, { size: "invisible" }
        );
        // Fix: must call render() before signInWithPhoneNumber
        await window.recaptchaVerifier.render();
        const result = await window.firebase_signInWithPhoneNumber(firebaseAuth, fullPhone, window.recaptchaVerifier);
        setConfirmResult(result);
      } else {
        await new Promise(r => setTimeout(r, 1200));
      }
      setStep("otp");
    } catch (e) {
      setError(e.message || "Failed to send OTP");
      if (window.recaptchaVerifier) { try { window.recaptchaVerifier.clear(); } catch (_) {} window.recaptchaVerifier = null; }
    }
    setLoading(false);
  };

  const verifyOTP = async (code) => {
    const rl = checkRateLimit(`otp_verify_${phone}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) { setError(rl.reason); return; }
    setLoading(true); setError("");
    try {
      let uid;
      if (confirmResult) {
        const cred = await confirmResult.confirm(code);
        uid = cred.user.uid;
      } else {
        await new Promise(r => setTimeout(r, 800));
        uid = "demo_" + phone;
      }
      // Check if user has 2FA
      if (firebaseDB && window.firebase_ref && window.firebase_get) {
        const snap = await window.firebase_get(window.firebase_ref(firebaseDB, `users/${uid}/twoFA`));
        if (snap.exists() && snap.val()?.enabled) {
          setTwoFAPending(uid);
          setStep("twofa");
          setLoading(false);
          return;
        }
      }
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
          setStep("name");
        } else {
          // Check backup codes
          const { valid, remaining } = verifyBackupCode(backupCodes || [], twoFACode);
          if (valid) {
            await window.firebase_update(window.firebase_ref(firebaseDB, `users/${uid}/twoFA`), { backupCodes: remaining });
            setStep("name");
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

  const saveName = async () => {
    if (!name.trim()) { setError(t("enterName")); return; }
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
          }}>💬</div>
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

          {/* PHONE STEP */}
          {step === "phone" && (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t("signIn")}</div>
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 28 }}>{t("enterPhone")}</div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t("country")}</label>
                <select value={country} onChange={e => setCountry(e.target.value)} style={{
                  ...inputStyle, cursor: "pointer", appearance: "none",
                }}>
                  {countries.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>{t("phoneNumber")}</label>
                <div style={{
                  display: "flex", alignItems: "center", background: C.card,
                  border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden",
                }}>
                  <div style={{ padding: "13px 14px", color: C.accent, fontWeight: 700, borderRight: `1px solid ${C.border}`, fontFamily: "monospace", flexShrink: 0 }}>{country}</div>
                  <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={e => e.key === "Enter" && sendOTP()}
                    placeholder="1128381838" inputMode="tel"
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
              <button onClick={() => { setStep("phone"); setError(""); }} style={{
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
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>{t("yourName")}</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveName()}
                  placeholder="AM.Dev" autoFocus
                  style={inputStyle} />
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

  useEffect(() => {
    // Load AdminDashboard dynamically
    import("./nextalk-dashboard-v2").then(module => {
      setAdminDashboard(() => module.default);
    });
  }, []);

  useEffect(() => {
    // Load Firebase
    const loadFirebase = async () => {
      try {
        const [
          { initializeApp, getApps },
          { getAuth, onAuthStateChanged, signInWithPhoneNumber, RecaptchaVerifier },
          { getDatabase, ref, set, get, update, onValue },
        ] = await Promise.all([
          import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"),
          import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"),
          import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"),
        ]);
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
        window._firebaseDB = firebaseDB; // ← Fix: expose DB for dashboard
        onAuthStateChanged(firebaseAuth, async (fireUser) => {
          if (fireUser) {
            const snap = await get(ref(firebaseDB, `users/${fireUser.uid}`));
            if (snap.exists()) {
              const userData = snap.val();
              setUser(userData);
              if (userData.lang) setLang(userData.lang);
            } else {
              setUser({ uid: fireUser.uid, phone: fireUser.phoneNumber, name: "", isAdmin: false });
            }
          } else {
            setUser(null);
          }
          setLoading(false);
        });
      } catch (e) {
        console.warn("Firebase load error:", e);
        setLoading(false);
      }
    };
    loadFirebase();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20, animation: "glowPulse 1.5s ease-in-out infinite" }}>💬</div>
        <div style={{ color: C.accent, fontSize: 26, fontWeight: 900, letterSpacing: 4, fontFamily: "Georgia, serif" }}>NEX<span style={{ color: C.text }}>TALK</span></div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 8, letterSpacing: 2 }}>LOADING...</div>
        <style>{`@keyframes glowPulse{0%,100%{box-shadow:0 0 40px ${C.accentGlow}}50%{box-shadow:0 0 70px ${C.accent}88}}`}</style>
      </div>
    );
  }

  // Step 1: Language selection
  if (!lang) return <LanguagePicker onSelect={setLang} />;

  // Step 2: Auth
  if (!user) return <LoginScreen onLogin={setUser} lang={lang} />;

  // Step 3: Dashboard (loaded dynamically)
  if (!AdminDashboard) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20, animation: "glowPulse 1.5s ease-in-out infinite" }}>💬</div>
        <div style={{ color: C.accent, fontSize: 26, fontWeight: 900, letterSpacing: 4, fontFamily: "Georgia, serif" }}>NEX<span style={{ color: C.text }}>TALK</span></div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 8, letterSpacing: 2 }}>LOADING DASHBOARD...</div>
      </div>
    );
  }

  return (
    <AdminDashboard
      currentUser={user}
      lang={lang}
      onLogout={() => {
        if (firebaseAuth) firebaseAuth.signOut?.();
        setUser(null);
      }}
    />
  );
}
