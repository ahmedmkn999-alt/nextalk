import { useState, useRef } from "react";
import { useTranslation, LANGUAGES } from "./i18n";

const C = {
  bg: "#060a14", surface: "#0d1321", card: "#111827",
  border: "#1e2d45", accent: "#00d4ff", accentDim: "#00d4ff15", accentGlow: "#00d4ff55",
  gold: "#ffd700", goldDim: "#ffd70015",
  green: "#00ff88", greenDim: "#00ff8815",
  red: "#ff3366", redDim: "#ff336615",
  purple: "#a855f7", purpleDim: "#a855f715",
  text: "#e2e8f0", muted: "#64748b",
};

// ─── Upload photo to Firebase Storage (base64 fallback) ───────────────────────
async function uploadPhoto(uid, file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result); // base64 data URL
    reader.readAsDataURL(file);
  });
}

// ─── Profile Editor Modal ─────────────────────────────────────────────────────
export default function ProfileModal({ currentUser, onUpdate, onClose, lang = "en" }) {
  const t = useTranslation(lang);
  const langObj = LANGUAGES.find(l => l.code === lang) || LANGUAGES[1];
  const dir = langObj.dir || "ltr";
  const [name, setName] = useState(currentUser.name || "");
  const [bio, setBio] = useState(currentUser.bio || "");
  const [photo, setPhoto] = useState(currentUser.photoURL || null);
  const [preview, setPreview] = useState(currentUser.photoURL || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileRef = useRef(null);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError(t("imageTooLarge")); return; }
    setUploading(true);
    setError("");
    try {
      const url = await uploadPhoto(currentUser.uid, file);
      setPhoto(url);
      setPreview(url);
    } catch (err) {
      setError(t("failedUploadPhoto"));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError(t("nameCantBeEmpty")); return; }
    setSaving(true);
    setError("");
    try {
      const updates = {
        name: name.trim(),
        bio: bio.trim(),
        photoURL: photo,
      };
      if (window.firebase_ref && window.firebase_update && window._firebaseDB) {
        await window.firebase_update(
          window.firebase_ref(window._firebaseDB, `users/${currentUser.uid}`),
          updates
        );
      }
      onUpdate({ ...currentUser, ...updates });
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 1000);
    } catch (err) {
      setError(t("failedSaveProfile"));
    }
    setSaving(false);
  };

  const inputStyle = {
    width: "100%", background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: "11px 14px", color: C.text, fontSize: 14,
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000d", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div
        style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: "28px 24px", maxWidth: 400, width: "92%", boxShadow: `0 32px 80px #00000088`, animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)", direction: dir }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{t("editProfile")}</div>
          <div style={{ color: C.muted, fontSize: 13 }}>{t("updateProfileInfo")}</div>
        </div>

        {/* Photo Upload */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <div
            style={{ position: "relative", cursor: "pointer" }}
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="Profile" style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover", border: `3px solid ${C.accent}`, boxShadow: `0 0 24px ${C.accentGlow}` }} />
            ) : (
              <div style={{ width: 88, height: 88, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 900, color: "#000", border: `3px solid ${C.accent}`, boxShadow: `0 0 24px ${C.accentGlow}` }}>
                {(currentUser.name || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, border: `2px solid ${C.card}` }}>
              {uploading ? "⏳" : "📷"}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
          <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>{t("tapToChangePhoto")}</div>
          {photo && (
            <button onClick={() => { setPhoto(null); setPreview(null); }} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 11, marginTop: 4 }}>{t("removePhoto")}</button>
          )}
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ color: C.muted, fontSize: 10, letterSpacing: 2, display: "block", marginBottom: 6, fontWeight: 700 }}>{t("displayName")}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t("displayName")} style={inputStyle}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>

          <div>
            <label style={{ color: C.muted, fontSize: 10, letterSpacing: 2, display: "block", marginBottom: 6, fontWeight: 700 }}>{t("bio")}</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder={t("bio")}
              maxLength={150}
              rows={3}
              style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border}
            />
            <div style={{ textAlign: "right", color: C.muted, fontSize: 10, marginTop: 3 }}>{bio.length}/150</div>
          </div>
        </div>

        {/* Premium badge display */}
        {currentUser.premium && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 14px", background: C.goldDim, border: `1px solid ${C.gold}33`, borderRadius: 12 }}>
            <span style={{ fontSize: 20 }}>{currentUser.badge || "⭐"}</span>
            <div>
              <div style={{ color: C.gold, fontWeight: 700, fontSize: 12 }}>{t("premiumMember")}</div>
              <div style={{ color: C.muted, fontSize: 11 }}>{t("badgeVisible")}</div>
            </div>
          </div>
        )}

        {error && <div style={{ color: C.red, fontSize: 12, marginTop: 12, padding: "8px 12px", background: C.redDim, borderRadius: 8 }}>⚠ {error}</div>}
        {success && <div style={{ color: C.green, fontSize: 12, marginTop: 12, padding: "8px 12px", background: C.greenDim, borderRadius: 8 }}>{t("profileUpdated")}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 13 }}>{t("cancel")}</button>
          <button onClick={handleSave} disabled={saving || uploading} style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, color: "#000", fontWeight: 800, cursor: "pointer", fontSize: 13, opacity: saving ? 0.7 : 1 }}>
            {saving ? t("saving") : t("saveProfile")}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes popIn { from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }
        * { box-sizing: border-box; }
        textarea::placeholder, input::placeholder { color: ${C.muted}; }
      `}</style>
    </div>
  );
}
