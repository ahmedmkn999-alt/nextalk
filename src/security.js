// NexTalk Security Module — Advanced Protection
// Includes: Device Fingerprinting, Rate Limiting, 2FA (TOTP), Session Management, Anomaly Detection

// ─── Device Fingerprinting ─────────────────────────────────────────────────────
export function getDeviceFingerprint() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top";
  ctx.font = "14px Arial";
  ctx.fillText("NexTalk🔒", 2, 2);
  const canvasHash = canvas.toDataURL().slice(-50);

  const fp = {
    ua: navigator.userAgent,
    lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    cores: navigator.hardwareConcurrency || 0,
    touch: navigator.maxTouchPoints || 0,
    canvas: canvasHash,
    plugins: Array.from(navigator.plugins || []).map(p => p.name).join(","),
    fonts: detectFonts(),
    webgl: getWebGLFingerprint(),
  };

  const str = JSON.stringify(fp);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function detectFonts() {
  const fonts = ["Arial", "Helvetica", "Times New Roman", "Courier", "Georgia", "Verdana", "Trebuchet MS"];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const baseline = measureFont(ctx, "monospace");
  return fonts.filter(f => measureFont(ctx, f) !== baseline).join(",");
}

function measureFont(ctx, font) {
  ctx.font = `16px ${font}, monospace`;
  return ctx.measureText("mmmmmmmmmmlli").width;
}

function getWebGLFingerprint() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) return "none";
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return "basic";
    return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).slice(0, 30);
  } catch {
    return "error";
  }
}

// ─── Rate Limiter ───────────────────────────────────────────────────────────────
const rateLimitStore = new Map();

export function checkRateLimit(key, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const record = rateLimitStore.get(key) || { attempts: [], blocked: false, blockedUntil: 0 };

  if (record.blocked && now < record.blockedUntil) {
    const remainingMs = record.blockedUntil - now;
    const remainingMin = Math.ceil(remainingMs / 60000);
    return {
      allowed: false,
      reason: `Too many attempts. Try again in ${remainingMin} minute${remainingMin > 1 ? "s" : ""}.`,
      remainingMs,
    };
  }

  // Clean old attempts
  record.attempts = record.attempts.filter(t => now - t < windowMs);

  if (record.attempts.length >= maxAttempts) {
    record.blocked = true;
    record.blockedUntil = now + windowMs;
    rateLimitStore.set(key, record);
    return {
      allowed: false,
      reason: `Too many attempts. Blocked for ${Math.ceil(windowMs / 60000)} minutes.`,
      remainingMs: windowMs,
    };
  }

  record.attempts.push(now);
  record.blocked = false;
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: maxAttempts - record.attempts.length,
  };
}

export function resetRateLimit(key) {
  rateLimitStore.delete(key);
}

// ─── TOTP (2FA) ─────────────────────────────────────────────────────────────────
// RFC 6238-compatible TOTP using HMAC-SHA1 emulated via SubtleCrypto

export async function generateTOTPSecret() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  arr.forEach(b => (secret += chars[b % 32]));
  return secret;
}

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const output = new Uint8Array(Math.ceil((input.length * 5) / 8));
  let index = 0;
  for (const char of input.replace(/=+$/, "").toUpperCase()) {
    const pos = alphabet.indexOf(char);
    if (pos < 0) continue;
    value = (value << 5) | pos;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return output.slice(0, index);
}

export async function getTOTPCode(secret, offset = 0) {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / 30) + offset;
  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  view.setUint32(4, counter, false);

  const keyBytes = base32Decode(secret);
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, counterBuffer);
  const hmac = new Uint8Array(signature);

  const offset2 = hmac[19] & 0xf;
  const code =
    ((hmac[offset2] & 0x7f) << 24) |
    ((hmac[offset2 + 1] & 0xff) << 16) |
    ((hmac[offset2 + 2] & 0xff) << 8) |
    (hmac[offset2 + 3] & 0xff);

  return String(code % 1000000).padStart(6, "0");
}

export async function verifyTOTP(secret, userCode) {
  if (!secret || !userCode) return false;
  // Accept current and ±1 window for clock skew
  for (const offset of [-1, 0, 1]) {
    const expected = await getTOTPCode(secret, offset);
    if (expected === userCode.trim()) return true;
  }
  return false;
}

export function getTOTPQRUrl(secret, phone, issuer = "NexTalk") {
  const label = encodeURIComponent(`${issuer}:${phone}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: 6, period: 30 });
  const otpauth = `otpauth://totp/${label}?${params}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`;
}

// ─── Session Manager ────────────────────────────────────────────────────────────
const SESSION_KEY = "nextalk_sessions";
const MAX_SESSIONS = 5;

export function getActiveSessions() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "[]");
  } catch {
    return [];
  }
}

export function createSession(userId, deviceInfo = {}) {
  const sessions = getActiveSessions();
  const fingerprint = deviceInfo.fingerprint || "unknown";

  // Check if device already has a session
  const existing = sessions.find(s => s.fingerprint === fingerprint);
  if (existing) {
    existing.lastActive = Date.now();
    existing.loginCount = (existing.loginCount || 1) + 1;
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
    return existing.id;
  }

  const session = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    userId,
    fingerprint,
    deviceName: getDeviceName(),
    location: Intl.DateTimeFormat().resolvedOptions().timeZone,
    createdAt: Date.now(),
    lastActive: Date.now(),
    loginCount: 1,
    current: true,
  };

  // Enforce max sessions — remove oldest
  const updated = [session, ...sessions.filter(s => s.fingerprint !== fingerprint)];
  if (updated.length > MAX_SESSIONS) {
    updated.splice(MAX_SESSIONS);
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return session.id;
}

export function terminateSession(sessionId) {
  const sessions = getActiveSessions().filter(s => s.id !== sessionId);
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
}

export function terminateAllOtherSessions(currentFingerprint) {
  const sessions = getActiveSessions().filter(s => s.fingerprint === currentFingerprint);
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
}

function getDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android Device";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown Device";
}

// ─── Anomaly Detection ──────────────────────────────────────────────────────────
export function detectAnomalies(currentSession, previousSessions) {
  const warnings = [];

  if (!previousSessions || previousSessions.length === 0) return warnings;

  // New country / timezone
  const prevTZs = previousSessions.map(s => s.location);
  if (!prevTZs.includes(currentSession.location)) {
    warnings.push({
      type: "new_location",
      message: `New login from different timezone: ${currentSession.location}`,
      severity: "medium",
    });
  }

  // Multiple logins in short time
  const recentLogins = previousSessions.filter(
    s => Date.now() - s.createdAt < 5 * 60 * 1000
  );
  if (recentLogins.length >= 3) {
    warnings.push({
      type: "rapid_logins",
      message: "Multiple login attempts detected in a short time",
      severity: "high",
    });
  }

  return warnings;
}

// ─── Backup Codes ──────────────────────────────────────────────────────────────
export function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const arr = new Uint8Array(5);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase().slice(0, 10);
  });
}

export function verifyBackupCode(storedCodes, inputCode) {
  const normalized = inputCode.replace(/\s/g, "").toUpperCase();
  const index = storedCodes.indexOf(normalized);
  if (index === -1) return { valid: false, remaining: storedCodes };
  const remaining = storedCodes.filter((_, i) => i !== index);
  return { valid: true, remaining };
}
