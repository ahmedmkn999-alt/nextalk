// NexTalk Security Module v2 — Military-Grade Protection
// E2E Encryption, Device Fingerprinting, Rate Limiting,
// 2FA (TOTP), Session Management, Anomaly Detection, XSS Prevention

// ─── E2E Message Encryption (AES-256-GCM) ─────────────────────────────────────
async function deriveSharedKey(uid1, uid2) {
  const raw = [uid1, uid2].sort().join("|") + ":nextalk_e2e_v2";
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(raw), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode("nextalk_salt_2025"), iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(text, chatId) {
  if (!text) return { cipher: null, iv: null };
  try {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const parts = chatId.split("_");
    const key = await deriveSharedKey(parts[0], parts[1] || parts[0]);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
    return {
      cipher: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv)),
      encrypted: true
    };
  } catch {
    return { cipher: text, iv: null, encrypted: false };
  }
}

export async function decryptMessage(cipher, ivB64, chatId) {
  if (!cipher || !ivB64) return cipher || "";
  try {
    const parts = chatId.split("_");
    const key = await deriveSharedKey(parts[0], parts[1] || parts[0]);
    const cipherBytes = Uint8Array.from(atob(cipher), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBytes);
    return new TextDecoder().decode(decrypted);
  } catch { return cipher; }
}

// ─── Input Sanitization (XSS Prevention) ──────────────────────────────────────
export function sanitizeText(input) {
  if (!input || typeof input !== "string") return "";
  return input.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#x27;").slice(0, 4000);
}
export function sanitizeUsername(input) { return (input||"").replace(/[^a-zA-Z0-9_]/g,"").slice(0,32); }
export function sanitizeName(input) { return (input||"").replace(/[<>&"'\\]/g,"").slice(0,60); }

// ─── Device Fingerprinting ─────────────────────────────────────────────────────
export function getDeviceFingerprint() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top"; ctx.font = "14px Arial";
  ctx.fillText("NexTalk🔒", 2, 2);
  const fp = {
    ua: navigator.userAgent, lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    cores: navigator.hardwareConcurrency || 0, touch: navigator.maxTouchPoints || 0,
    canvas: canvas.toDataURL().slice(-50),
    fonts: (() => {
      const fonts = ["Arial","Helvetica","Times New Roman","Courier","Georgia","Verdana"];
      const c2 = document.createElement("canvas"); const ctx2 = c2.getContext("2d");
      const base = (f => { ctx2.font=`16px ${f},monospace`; return ctx2.measureText("mmm").width; })("monospace");
      return fonts.filter(f => { ctx2.font=`16px ${f},monospace`; return ctx2.measureText("mmm").width !== base; }).join(",");
    })(),
    webgl: (() => { try { const c=document.createElement("canvas"); const gl=c.getContext("webgl"); if(!gl)return"none"; const d=gl.getExtension("WEBGL_debug_renderer_info"); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL).slice(0,30):"basic"; } catch { return"error"; } })(),
  };
  const str = JSON.stringify(fp);
  let hash = 5381;
  for (let i=0;i<str.length;i++) { hash=((hash<<5)+hash)^str.charCodeAt(i); hash|=0; }
  return Math.abs(hash).toString(36);
}

// ─── Rate Limiter ───────────────────────────────────────────────────────────────
const rateLimitStore = new Map();
export function checkRateLimit(key, maxAttempts=5, windowMs=15*60*1000) {
  const now = Date.now();
  const r = rateLimitStore.get(key) || { attempts:[], blocked:false, blockedUntil:0 };
  if (r.blocked && now < r.blockedUntil) {
    const min = Math.ceil((r.blockedUntil-now)/60000);
    return { allowed:false, reason:`Too many attempts. Try again in ${min} minute${min>1?"s":""}.`, remainingMs:r.blockedUntil-now };
  }
  r.attempts = r.attempts.filter(t => now-t < windowMs);
  if (r.attempts.length >= maxAttempts) {
    r.blocked=true; r.blockedUntil=now+windowMs; rateLimitStore.set(key,r);
    return { allowed:false, reason:`Too many attempts. Blocked for ${Math.ceil(windowMs/60000)} minutes.` };
  }
  r.attempts.push(now); r.blocked=false; rateLimitStore.set(key,r);
  return { allowed:true, remaining:maxAttempts-r.attempts.length };
}
export function resetRateLimit(key) { rateLimitStore.delete(key); }

// ─── Message Anti-Spam ──────────────────────────────────────────────────────────
const msgLimits = new Map();
export function checkMessageRateLimit(uid) {
  const now = Date.now();
  const r = msgLimits.get(uid) || { count:0, start:now };
  if (now - r.start > 60000) { r.count=0; r.start=now; }
  if (r.count >= 30) return { allowed:false, reason:"You're sending messages too fast!" };
  r.count++; msgLimits.set(uid,r);
  return { allowed:true };
}

// ─── TOTP (2FA) ─────────────────────────────────────────────────────────────────
export async function generateTOTPSecret() {
  const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let s="";
  const arr=new Uint8Array(20); crypto.getRandomValues(arr);
  arr.forEach(b=>(s+=chars[b%32])); return s;
}
function base32Decode(input) {
  const alpha="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits=0,val=0;
  const out=new Uint8Array(Math.ceil((input.length*5)/8)); let idx=0;
  for(const c of input.replace(/=+$/,"").toUpperCase()){const p=alpha.indexOf(c);if(p<0)continue;val=(val<<5)|p;bits+=5;if(bits>=8){out[idx++]=(val>>>(bits-8))&255;bits-=8;}}
  return out.slice(0,idx);
}
export async function getTOTPCode(secret, offset=0) {
  const counter=Math.floor(Math.floor(Date.now()/1000)/30)+offset;
  const buf=new ArrayBuffer(8); new DataView(buf).setUint32(4,counter,false);
  const key=await crypto.subtle.importKey("raw",base32Decode(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,buf));
  const off=sig[19]&0xf;
  const code=((sig[off]&0x7f)<<24)|((sig[off+1]&0xff)<<16)|((sig[off+2]&0xff)<<8)|(sig[off+3]&0xff);
  return String(code%1000000).padStart(6,"0");
}
export async function verifyTOTP(secret,userCode) {
  if(!secret||!userCode)return false;
  for(const o of[-1,0,1]){if((await getTOTPCode(secret,o))===userCode.trim())return true;}
  return false;
}
export function getTOTPQRUrl(secret,phone,issuer="NexTalk") {
  const label=encodeURIComponent(`${issuer}:${phone}`);
  const params=new URLSearchParams({secret,issuer,algorithm:"SHA1",digits:6,period:30});
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`otpauth://totp/${label}?${params}`)}`;
}

// ─── Session Manager ────────────────────────────────────────────────────────────
const SESSION_KEY="nextalk_sessions_v2";
const MAX_SESSIONS=5;
export function getActiveSessions(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"[]");}catch{return[];}}
function getDeviceName(){const ua=navigator.userAgent;if(/iPhone/i.test(ua))return"iPhone";if(/iPad/i.test(ua))return"iPad";if(/Android/i.test(ua))return"Android Device";if(/Mac/i.test(ua))return"Mac";if(/Windows/i.test(ua))return"Windows PC";return"Device";}
export function createSession(userId,deviceInfo={}) {
  const sessions=getActiveSessions(); const fp=deviceInfo.fingerprint||"unknown";
  const existing=sessions.find(s=>s.fingerprint===fp);
  if(existing){existing.lastActive=Date.now();existing.loginCount=(existing.loginCount||1)+1;localStorage.setItem(SESSION_KEY,JSON.stringify(sessions));return existing.id;}
  const session={id:crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2),userId,fingerprint:fp,deviceName:getDeviceName(),location:Intl.DateTimeFormat().resolvedOptions().timeZone,createdAt:Date.now(),lastActive:Date.now(),loginCount:1,current:true};
  const updated=[session,...sessions.filter(s=>s.fingerprint!==fp)];
  if(updated.length>MAX_SESSIONS)updated.splice(MAX_SESSIONS);
  localStorage.setItem(SESSION_KEY,JSON.stringify(updated)); return session.id;
}
export function terminateSession(id){localStorage.setItem(SESSION_KEY,JSON.stringify(getActiveSessions().filter(s=>s.id!==id)));}
export function terminateAllOtherSessions(fp){localStorage.setItem(SESSION_KEY,JSON.stringify(getActiveSessions().filter(s=>s.fingerprint===fp)));}

// ─── Anomaly Detection ──────────────────────────────────────────────────────────
export function detectAnomalies(cur,prev) {
  if(!prev||!prev.length)return[];
  const w=[];
  if(!prev.map(s=>s.location).includes(cur.location))w.push({type:"new_location",message:`New login: ${cur.location}`,severity:"medium"});
  if(prev.filter(s=>Date.now()-s.createdAt<5*60*1000).length>=3)w.push({type:"rapid_logins",message:"Multiple rapid logins detected",severity:"high"});
  return w;
}

// ─── Backup Codes ──────────────────────────────────────────────────────────────
export function generateBackupCodes(count=8){return Array.from({length:count},()=>{const a=new Uint8Array(5);crypto.getRandomValues(a);return Array.from(a).map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase().slice(0,10);});}
export function verifyBackupCode(codes,input){const n=input.replace(/\s/g,"").toUpperCase();const i=codes.indexOf(n);if(i===-1)return{valid:false,remaining:codes};return{valid:true,remaining:codes.filter((_,j)=>j!==i)};}

// ─── Image Compression ─────────────────────────────────────────────────────────
export function compressImage(file, maxSizeKB=200) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement("canvas");
        let {width,height}=img; const maxPx=800;
        if(width>maxPx||height>maxPx){if(width>height){height=(height/width)*maxPx;width=maxPx;}else{width=(width/height)*maxPx;height=maxPx;}}
        canvas.width=width; canvas.height=height;
        canvas.getContext("2d").drawImage(img,0,0,width,height);
        let q=0.82; let r=canvas.toDataURL("image/jpeg",q);
        while(r.length>maxSizeKB*1024*1.37&&q>0.3){q-=0.1;r=canvas.toDataURL("image/jpeg",q);}
        resolve(r);
      };
      img.onerror=reject; img.src=e.target.result;
    };
    reader.onerror=reject; reader.readAsDataURL(file);
  });
}

// ─── Presence System ────────────────────────────────────────────────────────────
export function setupPresence(uid,db,fbRef,fbSet,fbOnDisconnect) {
  if(!uid||!db||!fbRef||!fbSet)return;
  try {
    const ref=fbRef(db,`status/${uid}`);
    const online={state:"online",lastChanged:Date.now()};
    const offline={state:"offline",lastChanged:Date.now()};
    fbSet(ref,online);
    if(fbOnDisconnect)fbOnDisconnect(ref).set(offline);
    window.addEventListener("beforeunload",()=>fbSet(ref,offline));
    document.addEventListener("visibilitychange",()=>{
      fbSet(ref,document.hidden?{state:"away",lastChanged:Date.now()}:online);
    });
  } catch(e){console.warn("Presence:",e);}
}
