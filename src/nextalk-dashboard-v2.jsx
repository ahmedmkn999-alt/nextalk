import { useState, useEffect, useRef } from "react";
import { useTranslation, LANGUAGES } from "./i18n";
import {
  generateTOTPSecret, getTOTPQRUrl, verifyTOTP,
  getActiveSessions, terminateSession, terminateAllOtherSessions,
  generateBackupCodes, getDeviceFingerprint,
} from "./security";
import ChatScreen from "./nextalk-chat";
import { NotificationBell, saveNotification, sendPushNotification } from "./nextalk-notifications";
import ProfileModal from "./nextalk-profile";

// ─── Design System ─────────────────────────────────────────────────────────────
const C = {
  bg:"#04080f",surface:"#080d18",card:"#0c1220",cardHover:"#0f1628",
  border:"#162030",borderBright:"#1e3050",
  accent:"#00d4ff",accentDim:"#00d4ff12",accentGlow:"#00d4ff44",accentStrong:"#00d4ff88",
  gold:"#f5c842",goldDim:"#f5c84212",goldGlow:"#f5c84244",
  green:"#00e676",greenDim:"#00e67612",greenGlow:"#00e67644",
  red:"#ff4444",redDim:"#ff444412",
  purple:"#a855f7",purpleDim:"#a855f712",purpleGlow:"#a855f744",
  orange:"#ff8c00",orangeDim:"#ff8c0012",
  pink:"#ff2d6a",pinkDim:"#ff2d6a12",
  text:"#dce8f5",muted:"#4a6080",dim:"#1e3050",
  glass:"rgba(8,13,24,0.85)",
};

const BADGES = ["⭐","💎","🔥","👑","⚡","🎯","🏆","💫","🌟","🦁","🐉","🌈","🚀","💜","🎪","🎭","🧬","⚔️","🛡️","🌊"];

// ─── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, photo, size=36, color=C.accent }) {
  if (photo) return <img src={photo} alt={name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:`2px solid ${color}44`}} />;
  const initials = (name||"U").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${color}44,${color}22)`,border:`2px solid ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:size*0.38,color,flexShrink:0,fontFamily:"monospace"}}>
      {initials}
    </div>
  );
}

function StatusPill({ status }) {
  const map={online:{c:C.green,bg:C.greenDim,label:"ONLINE"},away:{c:C.gold,bg:C.goldDim,label:"AWAY"},offline:{c:C.muted,bg:"transparent",label:"OFFLINE"}};
  const s=map[status]||map.offline;
  return <span style={{background:s.bg,color:s.c,border:`1px solid ${s.c}44`,borderRadius:20,padding:"2px 10px",fontSize:9,fontWeight:800,letterSpacing:1,display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:5,height:5,borderRadius:"50%",background:s.c,display:"inline-block",boxShadow:status==="online"?`0 0 6px ${s.c}`:"none"}}/>  {s.label}</span>;
}

// ─── Glowing Stat Card ─────────────────────────────────────────────────────────
function StatCard({ title, value, sub, color, icon, trend, onClick, pulse }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:hov?C.cardHover:C.card,border:`1px solid ${hov?color+"44":C.border}`,borderRadius:20,padding:24,flex:1,minWidth:160,position:"relative",overflow:"hidden",cursor:onClick?"pointer":"default",transition:"all 0.3s cubic-bezier(.4,0,.2,1)",transform:hov?"translateY(-6px)":"translateY(0)",boxShadow:hov?`0 20px 60px ${color}22,0 0 0 1px ${color}22`:"none"}}>
      {/* Glow blob */}
      <div style={{position:"absolute",top:-40,right:-40,width:120,height:120,borderRadius:"50%",background:`radial-gradient(${color}22,transparent 70%)`,pointerEvents:"none",transition:"opacity 0.3s",opacity:hov?1:0.5}}/>
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${color},transparent)`,opacity:hov?1:0.4,transition:"opacity 0.3s"}}/>
      <div style={{fontSize:28,marginBottom:10}}>{icon}</div>
      <div style={{color:C.muted,fontSize:9,letterSpacing:3,fontWeight:800,marginBottom:6,fontFamily:"monospace"}}>{title}</div>
      <div style={{color,fontSize:34,fontWeight:900,fontFamily:"monospace",letterSpacing:-1,marginBottom:4,animation:pulse?"numPulse 2s ease-in-out infinite":""}}>{value}</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {trend!==undefined&&<span style={{color:trend>0?C.green:C.red,fontSize:11,fontWeight:700,background:trend>0?C.greenDim:C.redDim,padding:"2px 8px",borderRadius:20}}>{trend>0?"↑":"↓"} {Math.abs(trend)}%</span>}
        {sub&&<span style={{color:C.muted,fontSize:11}}>{sub}</span>}
      </div>
    </div>
  );
}

// ─── Activity Chart (pure CSS) ─────────────────────────────────────────────────
function ActivityChart({ data, color=C.accent }) {
  const max = Math.max(...data,1);
  const days = ["M","T","W","T","F","S","S"];
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:6,height:60}}>
      {data.map((v,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <div style={{flex:1,width:"100%",display:"flex",alignItems:"flex-end"}}>
            <div style={{width:"100%",height:`${(v/max)*100}%`,minHeight:4,background:`linear-gradient(0deg,${color},${color}44)`,borderRadius:"4px 4px 0 0",transition:"height 0.5s ease",boxShadow:`0 0 8px ${color}44`}}/>
          </div>
          <div style={{fontSize:8,color:C.muted,fontFamily:"monospace"}}>{days[i]}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Ring Progress ──────────────────────────────────────────────────────────────
function RingProgress({ value, max, color, size=80, label }) {
  const pct = Math.min(value/max,1);
  const r=32, cx=40, cy=40, circ=2*Math.PI*r;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={6}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={circ*(1-pct)}
          strokeLinecap="round" style={{transition:"stroke-dashoffset 1s ease",filter:`drop-shadow(0 0 6px ${color})`}}/>
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
          style={{fill:color,fontSize:14,fontWeight:800,fontFamily:"monospace",transform:"rotate(90deg)",transformOrigin:"center"}}>
        </text>
      </svg>
      <div style={{textAlign:"center"}}>
        <div style={{color,fontWeight:900,fontSize:18,fontFamily:"monospace"}}>{Math.round(pct*100)}%</div>
        <div style={{color:C.muted,fontSize:10}}>{label}</div>
      </div>
    </div>
  );
}

// ─── Toast Notification ─────────────────────────────────────────────────────────
function Toast({ notif }) {
  if (!notif) return null;
  return (
    <div style={{position:"fixed",top:72,right:20,zIndex:99999,background:C.card,border:`1px solid ${notif.color}44`,borderRadius:16,padding:"14px 20px",color:notif.color,fontWeight:700,fontSize:14,boxShadow:`0 12px 50px ${notif.color}33`,animation:"toastIn 0.4s cubic-bezier(.34,1.56,.64,1)",display:"flex",alignItems:"center",gap:10,backdropFilter:"blur(20px)",maxWidth:320}}>
      <span style={{fontSize:20}}>{notif.icon||"✓"}</span> {notif.msg}
    </div>
  );
}

// ─── Badge Picker Modal ────────────────────────────────────────────────────────
function BadgeModal({ onAssign, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"#000c",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}} onClick={onClose}>
      <div style={{background:C.card,border:`1px solid ${C.gold}44`,borderRadius:24,padding:"28px 24px",maxWidth:380,width:"90%",boxShadow:`0 0 100px ${C.goldGlow}`,animation:"popIn 0.3s cubic-bezier(.34,1.56,.64,1)"}} onClick={e=>e.stopPropagation()}>
        <div style={{color:C.gold,fontWeight:900,fontSize:18,marginBottom:20,textAlign:"center",letterSpacing:2}}>👑 CHOOSE BADGE</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
          {BADGES.map(b=>(
            <button key={b} onClick={()=>onAssign(b)} style={{background:C.surface,border:`2px solid ${C.border}`,borderRadius:14,padding:"12px 4px",fontSize:24,cursor:"pointer",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.transform="scale(1.2)";e.currentTarget.style.boxShadow=`0 0 16px ${C.goldGlow}`;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="none";}}
            >{b}</button>
          ))}
        </div>
        <button onClick={onClose} style={{width:"100%",marginTop:16,padding:10,borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:13}}>Cancel</button>
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
    setTotpSecret(secret); setBackupCodes(codes); setEnabling2FA(true); setShowQR(true);
  };

  const confirm2FA = async () => {
    const valid = await verifyTOTP(totpSecret, verifyCode);
    if (valid) {
      if (window.firebase_ref && window.firebase_update && window._firebaseDB) {
        await window.firebase_update(window.firebase_ref(window._firebaseDB, `users/${currentUser.uid}/twoFA`), { enabled:true, secret:totpSecret, backupCodes });
      }
      setShowQR(false); setEnabling2FA(false);
      notify("✅ Two-Factor Auth enabled!", C.green, "🔐");
    } else {
      notify("❌ Invalid code. Check your authenticator app.", C.red, "⚠️");
    }
  };

  const features = [
    {icon:"🔐",label:"E2E Encrypted Messages",active:true},
    {icon:"📱",label:"TOTP 2FA (Google Auth)",active:currentUser.twoFA?.enabled},
    {icon:"🔑",label:"Backup Recovery Codes",active:currentUser.twoFA?.enabled},
    {icon:"🌍",label:"Device Fingerprinting",active:true},
    {icon:"🚫",label:"Rate Limiting (5 attempts)",active:true},
    {icon:"👁️",label:"Anomaly Detection",active:true},
    {icon:"📊",label:"Session Management",active:true},
    {icon:"🗑️",label:"Anti-Spam (30 msg/min)",active:true},
  ];

  return (
    <div style={{animation:"fadeUp 0.3s ease"}}>
      <div style={{fontSize:22,fontWeight:900,marginBottom:28,color:C.accent,letterSpacing:1,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:42,height:42,borderRadius:14,background:C.accentDim,border:`1px solid ${C.accentStrong}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🔒</div>
        Security Center
      </div>

      {/* Security Level Indicator */}
      <div style={{background:`linear-gradient(135deg,${C.card},${C.cardHover})`,border:`1px solid ${C.green}44`,borderRadius:20,padding:24,marginBottom:20,display:"flex",alignItems:"center",gap:24}}>
        <RingProgress value={currentUser.twoFA?.enabled?100:65} max={100} color={currentUser.twoFA?.enabled?C.green:C.gold} size={90} label="Security" />
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:18,marginBottom:6,color:currentUser.twoFA?.enabled?C.green:C.gold}}>
            {currentUser.twoFA?.enabled?"🛡️ Maximum Protection":"⚠️ Good — Enable 2FA for Max"}
          </div>
          <div style={{color:C.muted,fontSize:13,marginBottom:16}}>Your account security score</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {features.map(f=>(
              <div key={f.label} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                <span style={{fontSize:14}}>{f.icon}</span>
                <span style={{color:f.active?C.text:C.muted,textDecoration:f.active?"none":"line-through"}}>{f.label}</span>
                <span style={{marginLeft:"auto",color:f.active?C.green:C.muted,fontSize:10}}>{f.active?"✓":"○"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2FA */}
      <div style={{background:C.card,border:`1px solid ${C.purple}33`,borderRadius:20,padding:24,marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <div style={{fontWeight:800,fontSize:16,marginBottom:4,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:22}}>🔐</span> Two-Factor Authentication
            </div>
            <div style={{color:C.muted,fontSize:13}}>TOTP via Google Authenticator / Authy</div>
          </div>
          {!currentUser.twoFA?.enabled&&!enabling2FA&&(
            <button onClick={setup2FA} style={{background:`linear-gradient(135deg,${C.purple},#6d28d9)`,border:"none",borderRadius:12,padding:"10px 18px",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,boxShadow:`0 4px 20px ${C.purpleGlow}`}}>Enable 2FA</button>
          )}
          {currentUser.twoFA?.enabled&&(
            <div style={{background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:10,padding:"6px 14px",color:C.green,fontWeight:700,fontSize:12}}>✓ ACTIVE</div>
          )}
        </div>

        {showQR&&totpSecret&&(
          <div style={{marginTop:20,padding:20,background:C.surface,borderRadius:14,border:`1px solid ${C.purple}44`,textAlign:"center"}}>
            <div style={{fontWeight:700,color:C.purple,marginBottom:12,fontSize:13,letterSpacing:1}}>SCAN WITH YOUR AUTHENTICATOR APP</div>
            <img src={getTOTPQRUrl(totpSecret,currentUser.phone||currentUser.email||"user")} alt="QR Code" style={{width:180,height:180,borderRadius:12,background:"#fff",padding:8}} />
            <div style={{marginTop:12,fontFamily:"monospace",fontSize:11,color:C.muted,wordBreak:"break-all",padding:"8px 12px",background:C.card,borderRadius:8}}>{totpSecret}</div>
            <div style={{marginTop:16,marginBottom:8,color:C.muted,fontSize:12}}>Enter the 6-digit code to verify:</div>
            <input value={verifyCode} onChange={e=>setVerifyCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"
              style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 16px",color:C.text,fontSize:20,textAlign:"center",letterSpacing:8,fontFamily:"monospace",outline:"none",width:"100%",marginBottom:12,boxSizing:"border-box"}} />
            <button onClick={confirm2FA} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${C.purple},#6d28d9)`,color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14}}>✓ Activate 2FA</button>
            {backupCodes.length>0&&(
              <div style={{marginTop:16,padding:16,background:C.card,borderRadius:12,border:`1px solid ${C.gold}33`}}>
                <div style={{color:C.gold,fontWeight:700,fontSize:12,marginBottom:10,letterSpacing:1}}>⚠️ SAVE THESE BACKUP CODES (ONE-TIME USE)</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {backupCodes.map((code,i)=>(
                    <div key={i} style={{fontFamily:"monospace",fontSize:12,color:C.text,background:C.surface,padding:"6px 10px",borderRadius:6,letterSpacing:1}}>
                      {i+1}. {code.slice(0,5)}-{code.slice(5)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sessions */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:15,display:"flex",alignItems:"center",gap:8}}><span>📱</span> Active Sessions ({sessions.length})</div>
          <button onClick={()=>{terminateAllOtherSessions(fp);setSessions(getActiveSessions());notify("All other sessions terminated!",C.red,"🚫");}}
            style={{background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:10,padding:"8px 14px",color:C.red,cursor:"pointer",fontSize:12,fontWeight:700}}>Terminate All Others</button>
        </div>
        {sessions.length===0&&<div style={{color:C.muted,textAlign:"center",padding:20}}>No active sessions</div>}
        {sessions.map(s=>(
          <div key={s.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{width:42,height:42,borderRadius:12,background:s.fingerprint===fp?C.accentDim:C.surface,border:`1px solid ${s.fingerprint===fp?C.accent:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
              {s.deviceName?.includes("iPhone")||s.deviceName?.includes("Android")?"📱":"💻"}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,display:"flex",alignItems:"center",gap:8}}>
                {s.deviceName}
                {s.fingerprint===fp&&<span style={{background:C.accentDim,color:C.accent,fontSize:10,padding:"2px 8px",borderRadius:6,fontWeight:700}}>CURRENT</span>}
              </div>
              <div style={{color:C.muted,fontSize:11,marginTop:2}}>🌍 {s.location} · 🕐 {new Date(s.lastActive).toLocaleDateString()}</div>
            </div>
            {s.fingerprint!==fp&&(
              <button onClick={()=>{terminateSession(s.id);setSessions(getActiveSessions());notify("Session revoked.",C.orange,"🚫");}}
                style={{background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:8,padding:"6px 12px",color:C.red,cursor:"pointer",fontSize:11,fontWeight:700}}>Revoke</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Broadcast Tab ─────────────────────────────────────────────────────────────
function BroadcastTab({ users, notify }) {
  const [msg, setMsg] = useState("");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState("all");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const sendBroadcast = async () => {
    if (!msg.trim() || !title.trim()) return;
    setSending(true);
    const targets = selected === "all" ? users : selected === "premium" ? users.filter(u=>u.premium) : users.filter(u=>!u.premium);
    try {
      for (const u of targets) {
        await saveNotification(u.uid, { type:"broadcast", icon:"📢", title:title.trim(), body:msg.trim() });
      }
      setSent(true); setMsg(""); setTitle("");
      notify(`📢 Broadcast sent to ${targets.length} users!`, C.accent, "📢");
      setTimeout(()=>setSent(false), 3000);
    } catch(e) {
      notify("Failed to send broadcast", C.red, "⚠️");
    }
    setSending(false);
  };

  const templates = [
    {label:"🎉 Welcome", title:"Welcome to NexTalk!", body:"We're excited to have you! Explore all features and enjoy encrypted messaging."},
    {label:"👑 Premium Offer", title:"Special Premium Offer! 50% OFF", body:"Get premium today and unlock exclusive badges, priority support & more!"},
    {label:"🔒 Security Alert", title:"Security Update", body:"We've enhanced your account security. Please review your settings."},
    {label:"🚀 New Feature", title:"New Feature Alert!", body:"Check out our latest update — now with E2E encrypted messages!"},
  ];

  return (
    <div style={{animation:"fadeUp 0.3s ease"}}>
      <div style={{fontSize:22,fontWeight:900,marginBottom:28,color:C.accent,letterSpacing:1,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:42,height:42,borderRadius:14,background:C.accentDim,border:`1px solid ${C.accentStrong}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📢</div>
        Broadcast Center
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:20}}>
        {/* Composer */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:24}}>
          <div style={{marginBottom:16}}>
            <label style={{color:C.muted,fontSize:10,letterSpacing:3,fontWeight:800,display:"block",marginBottom:8}}>TARGET AUDIENCE</label>
            <div style={{display:"flex",gap:8}}>
              {[{v:"all",label:"👥 All Users"},{v:"premium",label:"👑 Premium"},{v:"free",label:"🆓 Free"}].map(o=>(
                <button key={o.v} onClick={()=>setSelected(o.v)} style={{flex:1,padding:"10px",borderRadius:12,border:`1px solid ${selected===o.v?C.accent:C.border}`,background:selected===o.v?C.accentDim:"transparent",color:selected===o.v?C.accent:C.muted,cursor:"pointer",fontWeight:700,fontSize:12,transition:"all 0.2s"}}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{color:C.muted,fontSize:10,letterSpacing:3,fontWeight:800,display:"block",marginBottom:8}}>NOTIFICATION TITLE</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Enter title..." maxLength={60}
              style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}} />
          </div>
          <div style={{marginBottom:20}}>
            <label style={{color:C.muted,fontSize:10,letterSpacing:3,fontWeight:800,display:"block",marginBottom:8}}>MESSAGE</label>
            <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Write your broadcast message..." maxLength={300} rows={4}
              style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit",resize:"vertical"}} />
            <div style={{textAlign:"right",color:C.muted,fontSize:11,marginTop:4}}>{msg.length}/300</div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{color:C.muted,fontSize:13}}>
              Recipients: <span style={{color:C.accent,fontWeight:700}}>
                {selected==="all"?users.length:selected==="premium"?users.filter(u=>u.premium).length:users.filter(u=>!u.premium).length} users
              </span>
            </div>
            <button onClick={sendBroadcast} disabled={!msg.trim()||!title.trim()||sending}
              style={{background:msg.trim()&&title.trim()?`linear-gradient(135deg,${C.accent},#0066ff)`:C.dim,border:"none",borderRadius:14,padding:"12px 28px",color:msg.trim()&&title.trim()?"#000":C.muted,fontWeight:800,cursor:msg.trim()&&title.trim()?"pointer":"default",fontSize:14,boxShadow:msg.trim()?`0 6px 24px ${C.accentGlow}`:"none",transition:"all 0.2s"}}>
              {sending?"⏳ Sending...":sent?"✅ Sent!":"📢 Broadcast"}
            </button>
          </div>
        </div>

        {/* Templates */}
        <div>
          <div style={{color:C.muted,fontSize:10,letterSpacing:3,fontWeight:800,marginBottom:12}}>QUICK TEMPLATES</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {templates.map(t=>(
              <button key={t.label} onClick={()=>{setTitle(t.title);setMsg(t.body);}}
                style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px",cursor:"pointer",textAlign:"left",color:C.text,transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent+"44";e.currentTarget.style.transform="translateX(4px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateX(0)";}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{t.label}</div>
                <div style={{color:C.muted,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.body.slice(0,50)}…</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Tab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ users }) {
  const premiumCount = users.filter(u=>u.premium).length;
  const onlineCount = users.filter(u=>u.status==="online").length;
  const revenue = premiumCount * 49.99;
  const weekly = [12,19,15,28,22,31,users.length];
  const msgs = [240,310,280,420,380,510,490];

  return (
    <div style={{animation:"fadeUp 0.3s ease"}}>
      <div style={{fontSize:22,fontWeight:900,marginBottom:28,color:C.accent,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:42,height:42,borderRadius:14,background:C.accentDim,border:`1px solid ${C.accentStrong}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📊</div>
        Analytics
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:20}}>
          <div style={{color:C.muted,fontSize:10,letterSpacing:3,fontWeight:800,marginBottom:12}}>USER GROWTH (7D)</div>
          <ActivityChart data={weekly} color={C.accent} />
        </div>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:20}}>
          <div style={{color:C.muted,fontSize:10,letterSpacing:3,fontWeight:800,marginBottom:12}}>MESSAGES / DAY</div>
          <ActivityChart data={msgs} color={C.purple} />
        </div>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:20}}>
          <div style={{color:C.muted,fontSize:10,letterSpacing:3,fontWeight:800,marginBottom:16}}>DISTRIBUTION</div>
          <div style={{display:"flex",justifyContent:"space-around"}}>
            <RingProgress value={premiumCount} max={Math.max(users.length,1)} color={C.gold} size={70} label="Premium" />
            <RingProgress value={onlineCount} max={Math.max(users.length,1)} color={C.green} size={70} label="Online" />
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:24}}>
          <div style={{color:C.muted,fontSize:10,letterSpacing:3,fontWeight:800,marginBottom:20}}>REVENUE BREAKDOWN</div>
          {[
            {label:"Premium Subscriptions",value:revenue,color:C.gold,pct:75},
            {label:"Bot Services",value:revenue*0.15,color:C.purple,pct:15},
            {label:"Advertising",value:revenue*0.1,color:C.accent,pct:10},
          ].map(r=>(
            <div key={r.label} style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:600}}>{r.label}</span>
                <span style={{color:r.color,fontWeight:800,fontFamily:"monospace"}}>${r.value.toFixed(2)}</span>
              </div>
              <div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${r.pct}%`,background:`linear-gradient(90deg,${r.color},${r.color}88)`,borderRadius:3,transition:"width 1s ease"}}/>
              </div>
            </div>
          ))}
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16,marginTop:4,display:"flex",justifyContent:"space-between"}}>
            <span style={{color:C.muted,fontSize:13}}>Total MRR</span>
            <span style={{color:C.gold,fontWeight:900,fontSize:20,fontFamily:"monospace"}}>${(revenue*1.25).toFixed(2)}</span>
          </div>
        </div>

        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:24}}>
          <div style={{color:C.muted,fontSize:10,letterSpacing:3,fontWeight:800,marginBottom:20}}>PLATFORM STATS</div>
          {[
            {icon:"👥",label:"Total Users",value:users.length,color:C.accent},
            {icon:"👑",label:"Premium",value:premiumCount,color:C.gold},
            {icon:"🟢",label:"Online Now",value:onlineCount,color:C.green},
            {icon:"💬",label:"Msgs Today",value:"1.2K",color:C.purple},
            {icon:"🤖",label:"Active Bots",value:4,color:C.orange},
            {icon:"🔒",label:"E2E Secured",value:"100%",color:C.green},
          ].map(s=>(
            <div key={s.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}44`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,color:C.muted,fontSize:12}}>
                <span>{s.icon}</span>{s.label}
              </div>
              <span style={{color:s.color,fontWeight:800,fontFamily:"monospace",fontSize:14}}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────────
export default function NexTalkDashboard({ currentUser, lang="en", onLogout }) {
  const t = useTranslation(lang);
  const langObj = LANGUAGES.find(l=>l.code===lang)||LANGUAGES[1];

  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [badgeModal, setBadgeModal] = useState(null);
  const [notif, setNotif] = useState(null);
  const [time, setTime] = useState(new Date());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState(currentUser);
  const [totalUnread, setTotalUnread] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(()=>{ const h=()=>setIsMobile(window.innerWidth<900); window.addEventListener("resize",h); if(window.innerWidth<900)setSidebarOpen(false); return()=>window.removeEventListener("resize",h); },[]);
  useEffect(()=>{ const t2=setInterval(()=>setTime(new Date()),1000); return()=>clearInterval(t2); },[]);

  useEffect(()=>{
    if(window.firebase_ref&&window.firebase_onValue&&window._firebaseDB){
      const ref=window.firebase_ref(window._firebaseDB,"users");
      const statusRef=window.firebase_ref(window._firebaseDB,"status");
      let usersData={}, statusData={};
      const merge=()=>{
        const list=Object.values(usersData).map(u=>({...u,status:statusData[u.uid]?.state||u.status||"offline"}));
        setUsers(list);
      };
      const u1=window.firebase_onValue(ref,snap=>{usersData=snap.val()||{};merge();});
      const u2=window.firebase_onValue(statusRef,snap=>{statusData=snap.val()||{};merge();});
      return()=>{u1&&u1();u2&&u2();};
    } else {
      setUsers([
        {uid:"1",name:"Ahmed Mohamed",phone:"+201128381838",username:"@ahmed_m",premium:true,badge:"👑",status:"online",joinedAt:"2024-01-15",isAdmin:true,email:"ahmed@nextalk.app"},
        {uid:"2",name:"Sara Hassan",phone:"+201002345678",username:"@sara_h",premium:true,badge:"💎",status:"online",joinedAt:"2024-02-20"},
        {uid:"3",name:"Mohamed Ali",phone:"+201113456789",username:"@moh_ali",premium:false,badge:null,status:"away",joinedAt:"2024-03-05"},
        {uid:"4",name:"Nour Khaled",phone:"+201204567890",username:"@nour_k",premium:true,badge:"🔥",status:"offline",joinedAt:"2024-03-18"},
        {uid:"5",name:"Omar Farouk",phone:"+201155678901",username:"@omar_f",premium:false,badge:null,status:"online",joinedAt:"2024-04-01"},
        {uid:"6",name:"Layla Ibrahim",phone:"+201096789012",username:"@layla_i",premium:true,badge:"⭐",status:"online",joinedAt:"2024-04-10"},
        {uid:"7",name:"Karim Samy",phone:"+201227890123",username:"@karim_s",premium:false,badge:null,status:"offline",joinedAt:"2024-04-22"},
        {uid:"8",name:"Dina Magdy",phone:"+201018901234",username:"@dina_m",premium:true,badge:"⚡",status:"away",joinedAt:"2024-05-01"},
        {uid:"9",name:"Youssef Adel",phone:"+201341234567",username:"@youssef_a",premium:false,badge:null,status:"online",joinedAt:"2024-05-10"},
        {uid:"10",name:"Rana Essam",phone:"+201052345678",username:"@rana_e",premium:true,badge:"💫",status:"online",joinedAt:"2024-05-15"},
      ]);
    }
  },[]);

  const notify = (msg, color=C.green, icon="✓") => {
    setNotif({msg,color,icon}); setTimeout(()=>setNotif(null),3500);
  };

  const togglePremium = async (uid) => {
    const u=users.find(u=>u.uid===uid); if(!u)return;
    const updated={...u,premium:!u.premium,badge:!u.premium?"⭐":null};
    setUsers(prev=>prev.map(x=>x.uid===uid?updated:x));
    if(window.firebase_ref&&window.firebase_update&&window._firebaseDB)
      await window.firebase_update(window.firebase_ref(window._firebaseDB,`users/${uid}`),{premium:updated.premium,badge:updated.badge});
    notify(`${u.name} ${u.premium?"removed from":"upgraded to"} Premium!`,u.premium?C.red:C.gold,u.premium?"⬇️":"👑");
  };

  const assignBadge = async (badge) => {
    const u=users.find(x=>x.uid===badgeModal); if(!u)return;
    setUsers(prev=>prev.map(x=>x.uid===badgeModal?{...x,badge,premium:true}:x));
    if(window.firebase_ref&&window.firebase_update&&window._firebaseDB)
      await window.firebase_update(window.firebase_ref(window._firebaseDB,`users/${badgeModal}`),{badge,premium:true});
    setBadgeModal(null); notify(`${badge} assigned to ${u.name}!`,C.gold,"👑");
  };

  const deleteUser = async (uid) => {
    setUsers(prev=>prev.filter(u=>u.uid!==uid));
    if(window.firebase_ref&&window._firebaseDB)
      window.firebase_set(window.firebase_ref(window._firebaseDB,`users/${uid}`),null);
    setDeleteConfirm(null); notify("User deleted.",C.red,"🗑️");
  };

  const premiumCount=users.filter(u=>u.premium).length;
  const onlineCount=users.filter(u=>u.status==="online").length;
  const filteredUsers=users.filter(u=>{
    const s=search.toLowerCase();
    const match=(u.name||"").toLowerCase().includes(s)||(u.username||"").includes(s)||(u.phone||"").includes(s)||(u.email||"").includes(s);
    const f=filter==="all"||(filter==="premium"&&u.premium)||(filter==="free"&&!u.premium)||(filter==="online"&&u.status==="online")||(filter==="admin"&&u.isAdmin);
    return match&&f;
  });

  const TABS = [
    {id:"overview",icon:"🌐",label:"Overview"},
    {id:"chat",icon:"💬",label:"Messages",badge:totalUnread||null},
    {id:"users",icon:"👥",label:"Users",badge:users.length},
    {id:"analytics",icon:"📊",label:"Analytics"},
    {id:"broadcast",icon:"📢",label:"Broadcast"},
    {id:"bots",icon:"🤖",label:"Bots"},
    {id:"security",icon:"🔒",label:"Security"},
    {id:"settings",icon:"⚙️",label:"Settings"},
  ];

  const SIDEBAR_W = sidebarOpen ? 230 : 60;

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,display:"flex",flexDirection:"column",fontFamily:"'SF Pro Display','Segoe UI',system-ui,sans-serif",direction:langObj.dir||"ltr",overflowX:"hidden"}}>
      <Toast notif={notif} />
      {badgeModal&&<BadgeModal onAssign={assignBadge} onClose={()=>setBadgeModal(null)} />}
      {showProfile&&<ProfileModal currentUser={user} lang={lang} onUpdate={u=>{setUser(u);}} onClose={()=>setShowProfile(false)} />}
      {deleteConfirm&&(
        <div style={{position:"fixed",inset:0,background:"#000d",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}} onClick={()=>setDeleteConfirm(null)}>
          <div style={{background:C.card,border:`1px solid ${C.red}44`,borderRadius:20,padding:28,maxWidth:360,width:"90%",boxShadow:`0 0 60px ${C.red}22`}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:32,marginBottom:12,textAlign:"center"}}>⚠️</div>
            <div style={{fontWeight:800,fontSize:18,textAlign:"center",marginBottom:8}}>Delete User?</div>
            <div style={{color:C.muted,fontSize:13,textAlign:"center",marginBottom:24}}>This action cannot be undone. All data for <b style={{color:C.text}}>{users.find(u=>u.uid===deleteConfirm)?.name}</b> will be permanently deleted.</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setDeleteConfirm(null)} style={{flex:1,padding:12,borderRadius:12,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontWeight:700}}>Cancel</button>
              <button onClick={()=>deleteUser(deleteConfirm)} style={{flex:1,padding:12,borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.red},#cc0000)`,color:"#fff",cursor:"pointer",fontWeight:800}}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Top Bar ─────────────────────────────────────────────────────────── */}
      <div style={{background:C.glass,borderBottom:`1px solid ${C.border}`,padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:58,position:"sticky",top:0,zIndex:200,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{background:sidebarOpen?C.accentDim:"none",border:`1px solid ${sidebarOpen?C.accent+"44":"transparent"}`,borderRadius:10,width:34,height:34,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:16,transition:"all 0.2s"}}>
            {sidebarOpen?"◀":"☰"}
          </button>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:10,background:`linear-gradient(135deg,${C.accent},#0055cc)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,boxShadow:`0 0 16px ${C.accentGlow}`}}>💬</div>
            <div>
              <div style={{fontWeight:900,color:C.text,letterSpacing:2,fontSize:14,fontFamily:"monospace"}}>NEX<span style={{color:C.accent}}>TALK</span></div>
              {!isMobile&&<div style={{fontSize:8,color:C.muted,letterSpacing:2}}>ADMIN PANEL v2.0</div>}
            </div>
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:20,padding:"4px 12px",fontSize:10,color:C.green,fontWeight:800,fontFamily:"monospace",display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:C.green,display:"inline-block",boxShadow:`0 0 6px ${C.green}`}}/>
            {onlineCount} ONLINE
          </div>
          {!isMobile&&<div style={{fontFamily:"monospace",fontSize:12,color:C.muted,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 10px"}}>{time.toLocaleTimeString("en",{hour12:false})}</div>}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <NotificationBell currentUser={user} />
          <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"4px 10px",borderRadius:12,border:`1px solid ${C.border}`,background:C.card,transition:"all 0.2s"}}
            onClick={()=>setShowProfile(true)}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent+"44";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;}}>
            <Avatar name={user.name} photo={user.photoURL} size={28} />
            {!isMobile&&<div style={{fontSize:13,fontWeight:600,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>}
            {user.isAdmin&&<span style={{background:C.goldDim,color:C.gold,fontSize:9,padding:"2px 6px",borderRadius:6,fontWeight:800}}>ADMIN</span>}
          </div>
          <button onClick={onLogout} style={{background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:10,padding:"6px 12px",color:C.red,cursor:"pointer",fontSize:13,fontWeight:700,transition:"all 0.2s"}}
            onMouseEnter={e=>{e.currentTarget.style.background=`${C.red}22`;}}
            onMouseLeave={e=>{e.currentTarget.style.background=C.redDim;}}>⏻</button>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden",height:"calc(100vh - 58px)"}}>
        {/* ─── Sidebar ──────────────────────────────────────────────────────── */}
        {(!isMobile||sidebarOpen)&&(
          <div style={{width:isMobile?"100%":SIDEBAR_W,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:isMobile?"row":"column",padding:isMobile?"8px":sidebarOpen?"12px 8px":"8px",overflowX:isMobile?"auto":"visible",overflowY:!isMobile?"auto":"visible",flexShrink:0,position:isMobile?"sticky":"relative",transition:"width 0.25s cubic-bezier(.4,0,.2,1)",zIndex:isMobile?100:"auto",top:isMobile?0:"auto"}}>
            {TABS.map(tb=>(
              <button key={tb.id} onClick={()=>{setTab(tb.id);if(isMobile)setSidebarOpen(false);}}
                style={{display:"flex",alignItems:"center",gap:sidebarOpen?10:0,justifyContent:sidebarOpen?"flex-start":"center",padding:isMobile?"8px 12px":sidebarOpen?"11px 14px":"11px",background:tab===tb.id?C.accentDim:"transparent",border:`1px solid ${tab===tb.id?C.accent+"44":"transparent"}`,borderRadius:12,color:tab===tb.id?C.accent:C.muted,cursor:"pointer",fontSize:13,fontWeight:tab===tb.id?700:400,width:isMobile?"auto":"100%",textAlign:"left",transition:"all 0.15s",whiteSpace:"nowrap",position:"relative",marginBottom:isMobile?0:2}}>
                <span style={{fontSize:17,flexShrink:0}}>{tb.icon}</span>
                {sidebarOpen&&!isMobile&&<span style={{flex:1}}>{tb.label}</span>}
                {sidebarOpen&&tb.badge&&(
                  <span style={{background:tab===tb.id?C.accent:C.accentDim,color:tab===tb.id?"#000":C.accent,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"1px 7px",fontSize:9,fontWeight:800,marginLeft:"auto"}}>{tb.badge}</span>
                )}
              </button>
            ))}

            {sidebarOpen&&!isMobile&&(
              <div style={{marginTop:"auto",padding:"14px 10px",borderTop:`1px solid ${C.border}`}}>
                <div style={{fontSize:9,color:C.dim,letterSpacing:2,marginBottom:8,fontWeight:800,fontFamily:"monospace"}}>LOGGED IN AS</div>
                <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"8px 10px",borderRadius:12,background:C.card,border:`1px solid ${C.border}`,transition:"all 0.2s"}}
                  onClick={()=>setShowProfile(true)}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent+"44";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;}}>
                  <Avatar name={user.name} photo={user.photoURL} size={32} />
                  <div style={{overflow:"hidden"}}>
                    <div style={{fontWeight:700,fontSize:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
                    <div style={{color:C.gold,fontSize:9,fontWeight:800,fontFamily:"monospace"}}>👑 ADMIN</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Main Content ──────────────────────────────────────────────────── */}
        <div style={{flex:1,overflow:"auto",padding:isMobile?16:tab==="chat"?0:28}}>

          {/* OVERVIEW */}
          {tab==="overview"&&(
            <div style={{animation:"fadeUp 0.35s ease"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
                <div>
                  <div style={{fontSize:isMobile?22:28,fontWeight:900,letterSpacing:1}}>
                    Global <span style={{color:C.accent}}>Control Panel</span>
                  </div>
                  <div style={{color:C.muted,fontSize:12,marginTop:4}}>
                    {time.toLocaleDateString(lang,{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
                  </div>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <div style={{background:C.accentDim,border:`1px solid ${C.accent}33`,borderRadius:12,padding:"8px 16px",fontSize:11,color:C.accent,fontWeight:700,fontFamily:"monospace"}}>
                    🔒 E2E SECURE
                  </div>
                  <div style={{background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:12,padding:"8px 16px",fontSize:11,color:C.green,fontWeight:700}}>
                    ● LIVE
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:14,marginBottom:24}}>
                <StatCard title="TOTAL USERS" value={users.length} icon="👥" color={C.accent} sub="registered" trend={12} onClick={()=>setTab("users")} />
                <StatCard title="PREMIUM" value={premiumCount} icon="👑" color={C.gold} sub={`${users.length?Math.round(premiumCount/users.length*100):0}% rate`} trend={8} onClick={()=>setTab("analytics")} />
                <StatCard title="ONLINE NOW" value={onlineCount} icon="🟢" color={C.green} sub="active" pulse />
                <StatCard title="MRR" value={`$${(premiumCount*49.99).toFixed(0)}`} icon="💰" color={C.purple} sub="monthly" trend={15} onClick={()=>setTab("analytics")} />
              </div>

              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:18,marginBottom:18}}>
                {/* Users Table */}
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:22,overflow:"hidden"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                    <div style={{fontWeight:800,color:C.accent,fontSize:11,letterSpacing:2}}>⚡ RECENT USERS</div>
                    <button onClick={()=>setTab("users")} style={{background:C.accentDim,border:`1px solid ${C.accent}33`,borderRadius:8,padding:"4px 12px",color:C.accent,fontSize:11,cursor:"pointer",fontWeight:700}}>View All →</button>
                  </div>
                  {users.slice(0,8).map((u,i)=>(
                    <div key={u.uid} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<7?`1px solid ${C.border}44`:"none",cursor:"pointer",transition:"all 0.15s",borderRadius:8}}
                      onMouseEnter={e=>{e.currentTarget.style.paddingLeft="8px";e.currentTarget.style.background=`${C.accent}05`;}}
                      onMouseLeave={e=>{e.currentTarget.style.paddingLeft="0";e.currentTarget.style.background="transparent";}}>
                      <Avatar name={u.name} photo={u.photoURL} size={36} color={u.premium?C.gold:C.accent} />
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
                          {u.name}
                          {u.badge&&<span style={{fontSize:13}}>{u.badge}</span>}
                          {u.premium&&<span style={{background:C.goldDim,color:C.gold,fontSize:8,padding:"1px 6px",borderRadius:4,fontWeight:800}}>PRO</span>}
                          {u.isAdmin&&<span style={{background:`${C.red}22`,color:C.red,fontSize:8,padding:"1px 6px",borderRadius:4,fontWeight:800}}>ADMIN</span>}
                        </div>
                        <div style={{color:C.muted,fontSize:11}}>{u.username}</div>
                      </div>
                      <StatusPill status={u.status} />
                    </div>
                  ))}
                </div>

                {/* Quick Actions */}
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div style={{color:C.muted,fontSize:9,letterSpacing:3,fontWeight:800}}>QUICK ACTIONS</div>
                  {[
                    {icon:"📢",label:"Broadcast Message",sub:"Send to all users",color:C.accent,id:"broadcast"},
                    {icon:"📊",label:"Analytics",sub:"Revenue & growth",color:C.purple,id:"analytics"},
                    {icon:"🔒",label:"Security Center",sub:"2FA · Sessions",color:C.green,id:"security"},
                    {icon:"🤖",label:"Bot Manager",sub:"4 active bots",color:C.orange,id:"bots"},
                  ].map(q=>(
                    <button key={q.id} onClick={()=>setTab(q.id)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"14px 18px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:14,transition:"all 0.2s",color:C.text}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=q.color+"55";e.currentTarget.style.transform="translateX(4px)";e.currentTarget.style.boxShadow=`0 8px 24px ${q.color}11`;}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateX(0)";e.currentTarget.style.boxShadow="none";}}>
                      <div style={{width:42,height:42,borderRadius:13,background:`${q.color}15`,border:`1px solid ${q.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{q.icon}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13}}>{q.label}</div>
                        <div style={{color:q.color,fontSize:11,marginTop:2}}>{q.sub}</div>
                      </div>
                      <span style={{color:C.muted,fontSize:14}}>→</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity mini */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:22}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                  <div style={{fontWeight:800,color:C.muted,fontSize:10,letterSpacing:2}}>WEEKLY ACTIVITY</div>
                  <div style={{color:C.accent,fontWeight:700,fontSize:13}}>↑ 23% vs last week</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                  <div>
                    <div style={{color:C.muted,fontSize:9,letterSpacing:2,marginBottom:8}}>NEW USERS</div>
                    <ActivityChart data={[8,12,9,15,11,18,users.length]} color={C.accent} />
                  </div>
                  <div>
                    <div style={{color:C.muted,fontSize:9,letterSpacing:2,marginBottom:8}}>MESSAGES</div>
                    <ActivityChart data={[240,310,280,420,380,510,490]} color={C.purple} />
                  </div>
                  <div>
                    <div style={{color:C.muted,fontSize:9,letterSpacing:2,marginBottom:8}}>REVENUE $</div>
                    <ActivityChart data={[180,240,200,290,260,340,premiumCount*49]} color={C.gold} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USERS */}
          {tab==="users"&&(
            <div style={{animation:"fadeUp 0.3s ease"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
                <div>
                  <div style={{fontSize:isMobile?20:26,fontWeight:900}}>User <span style={{color:C.accent}}>Management</span></div>
                  <div style={{color:C.muted,fontSize:12,marginTop:4}}>{filteredUsers.length} of {users.length} users</div>
                </div>
                <div style={{background:C.accentDim,border:`1px solid ${C.accent}33`,borderRadius:12,padding:"8px 16px",fontSize:12,color:C.accent,fontWeight:800}}>{users.length} TOTAL</div>
              </div>

              <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:200,position:"relative"}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:C.muted,fontSize:14}}>🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, username, phone, email..."
                    style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"11px 16px 11px 40px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box",transition:"border-color 0.2s"}}
                    onFocus={e=>e.target.style.borderColor=C.accent}
                    onBlur={e=>e.target.style.borderColor=C.border} />
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {["all","premium","free","online","admin"].map(f=>(
                    <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?C.accentDim:C.card,border:`1px solid ${filter===f?C.accent:C.border}`,borderRadius:10,padding:"8px 14px",color:filter===f?C.accent:C.muted,cursor:"pointer",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,transition:"all 0.15s"}}>{f}</button>
                  ))}
                </div>
              </div>

              {isMobile?(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {filteredUsers.map(u=>(
                    <div key={u.uid} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:18,transition:"all 0.2s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent+"22";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:14}}>
                        <Avatar name={u.name} photo={u.photoURL} size={46} color={u.premium?C.gold:C.accent} />
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",fontSize:14}}>
                            {u.name}{u.badge&&<span>{u.badge}</span>}
                            {u.premium&&<span style={{background:C.goldDim,color:C.gold,fontSize:9,padding:"2px 7px",borderRadius:8,fontWeight:700}}>PREMIUM</span>}
                            {u.isAdmin&&<span style={{background:C.redDim,color:C.red,fontSize:9,padding:"2px 7px",borderRadius:8,fontWeight:700}}>ADMIN</span>}
                          </div>
                          <div style={{color:C.accent,fontSize:12}}>{u.username}</div>
                          <div style={{color:C.muted,fontSize:11}}>{u.phone}</div>
                        </div>
                        <StatusPill status={u.status} />
                      </div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <button onClick={()=>togglePremium(u.uid)} style={{flex:1,padding:"8px",borderRadius:10,border:`1px solid ${u.premium?C.red:C.gold}44`,background:u.premium?C.redDim:C.goldDim,color:u.premium?C.red:C.gold,cursor:"pointer",fontSize:11,fontWeight:700}}>
                          {u.premium?"⬇️ Remove Pro":"👑 Upgrade"}
                        </button>
                        {u.premium&&<button onClick={()=>setBadgeModal(u.uid)} style={{padding:"8px 14px",borderRadius:10,border:`1px solid ${C.purple}44`,background:C.purpleDim,color:C.purple,cursor:"pointer",fontSize:11,fontWeight:700}}>🏆 Badge</button>}
                        {!u.isAdmin&&<button onClick={()=>setDeleteConfirm(u.uid)} style={{padding:"8px 12px",borderRadius:10,border:`1px solid ${C.red}33`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:12}}>🗑️</button>}
                      </div>
                    </div>
                  ))}
                </div>
              ):(
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:C.surface}}>
                        {["User","Contact","Username","Status","Badge","Plan","Actions"].map(h=>(
                          <th key={h} style={{padding:"14px 16px",textAlign:"left",color:C.muted,fontSize:9,letterSpacing:2,fontWeight:800,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u=>(
                        <tr key={u.uid} style={{borderTop:`1px solid ${C.border}`,transition:"background 0.15s"}}
                          onMouseEnter={e=>e.currentTarget.style.background=`${C.accent}05`}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"14px 16px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <Avatar name={u.name} photo={u.photoURL} size={36} color={u.premium?C.gold:C.accent} />
                              <div>
                                <div style={{fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
                                  {u.name}
                                  {u.isAdmin&&<span style={{background:C.redDim,color:C.red,fontSize:8,padding:"1px 5px",borderRadius:4,fontWeight:800}}>ADMIN</span>}
                                </div>
                                {u.email&&<div style={{color:C.muted,fontSize:10}}>{u.email}</div>}
                              </div>
                            </div>
                          </td>
                          <td style={{padding:"14px 16px",color:C.muted,fontSize:12,fontFamily:"monospace"}}>{u.phone}</td>
                          <td style={{padding:"14px 16px",color:C.accent,fontSize:12}}>{u.username}</td>
                          <td style={{padding:"14px 16px"}}><StatusPill status={u.status} /></td>
                          <td style={{padding:"14px 16px",fontSize:20}}>{u.badge||<span style={{color:C.dim}}>—</span>}</td>
                          <td style={{padding:"14px 16px"}}>
                            <span style={{background:u.premium?C.goldDim:`${C.muted}15`,color:u.premium?C.gold:C.muted,borderRadius:20,padding:"4px 12px",fontSize:9,fontWeight:800,letterSpacing:1}}>{u.premium?"👑 PREMIUM":"FREE"}</span>
                          </td>
                          <td style={{padding:"14px 16px"}}>
                            <div style={{display:"flex",gap:6}}>
                              <button onClick={()=>togglePremium(u.uid)} style={{background:u.premium?C.redDim:C.goldDim,border:`1px solid ${u.premium?C.red:C.gold}44`,borderRadius:8,padding:"6px 12px",cursor:"pointer",color:u.premium?C.red:C.gold,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
                                {u.premium?"Remove":"⬆ Pro"}
                              </button>
                              {u.premium&&<button onClick={()=>setBadgeModal(u.uid)} style={{background:C.purpleDim,border:`1px solid ${C.purple}44`,borderRadius:8,padding:"6px 12px",cursor:"pointer",color:C.purple,fontSize:11,fontWeight:700}}>🏆</button>}
                              {!u.isAdmin&&<button onClick={()=>setDeleteConfirm(u.uid)} style={{background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:8,padding:"6px 10px",cursor:"pointer",color:C.red,fontSize:12}}>🗑</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length===0&&<div style={{textAlign:"center",padding:48,color:C.muted}}>
                    <div style={{fontSize:32,marginBottom:8}}>🔍</div>No users found
                  </div>}
                </div>
              )}
            </div>
          )}

          {/* ANALYTICS */}
          {tab==="analytics"&&<AnalyticsTab users={users} />}

          {/* BROADCAST */}
          {tab==="broadcast"&&<BroadcastTab users={users} notify={notify} />}

          {/* BOTS */}
          {tab==="bots"&&(
            <div style={{animation:"fadeUp 0.3s ease"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
                <div style={{fontSize:isMobile?20:26,fontWeight:900}}>Bot <span style={{color:C.accent}}>Management</span></div>
                <button onClick={()=>notify("Bot creation coming soon! 🤖",C.accent,"🤖")} style={{background:`linear-gradient(135deg,${C.accent},#0055cc)`,border:"none",borderRadius:14,padding:"11px 22px",color:"#000",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:`0 4px 24px ${C.accentGlow}`}}>+ Create Bot</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
                {[
                  {id:1,name:"NexBot AI",username:"@nexbot_ai",status:"active",users:1240,commands:45,type:"AI Assistant",icon:"🤖",color:C.accent},
                  {id:2,name:"Shop Bot",username:"@nextalk_shop",status:"active",users:890,commands:30,type:"E-Commerce",icon:"🛍",color:C.purple},
                  {id:3,name:"News Bot",username:"@nexnews",status:"inactive",users:320,commands:15,type:"News Feed",icon:"📰",color:C.muted},
                  {id:4,name:"Crypto Bot",username:"@nexcrypto",status:"active",users:2100,commands:60,type:"Finance",icon:"📈",color:C.gold},
                ].map(bot=>(
                  <div key={bot.id} style={{background:C.card,border:`1px solid ${bot.status==="active"?bot.color+"33":C.border}`,borderRadius:20,padding:22,transition:"all 0.25s",boxShadow:bot.status==="active"?`0 0 30px ${bot.color}11`:"none"}}
                    onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-6px)";e.currentTarget.style.boxShadow=`0 20px 50px ${bot.color}22`;}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=bot.status==="active"?`0 0 30px ${bot.color}11`:"none";}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                      <div style={{width:52,height:52,borderRadius:16,background:`${bot.color}22`,border:`1px solid ${bot.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{bot.icon}</div>
                      <span style={{background:bot.status==="active"?C.greenDim:`${C.muted}15`,color:bot.status==="active"?C.green:C.muted,borderRadius:20,padding:"4px 12px",fontSize:10,fontWeight:800,border:`1px solid ${bot.status==="active"?C.green+"44":C.border}`}}>● {bot.status.toUpperCase()}</span>
                    </div>
                    <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>{bot.name}</div>
                    <div style={{color:bot.color,fontSize:12,marginBottom:10}}>{bot.username}</div>
                    <div style={{color:C.muted,fontSize:12,marginBottom:6,display:"flex",gap:16}}>
                      <span>👥 {bot.users.toLocaleString()}</span><span>⚙️ {bot.commands} cmds</span>
                    </div>
                    <div style={{display:"inline-block",background:`${bot.color}15`,border:`1px solid ${bot.color}33`,borderRadius:8,padding:"3px 10px",fontSize:10,color:bot.color,marginBottom:16}}>{bot.type}</div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>notify(`${bot.name} ${bot.status==="active"?"paused":"started"}!`,bot.status==="active"?C.red:C.green,bot.status==="active"?"⏸":"▶")} style={{flex:1,background:bot.status==="active"?C.redDim:C.greenDim,border:`1px solid ${bot.status==="active"?C.red:C.green}44`,borderRadius:10,padding:"8px",cursor:"pointer",color:bot.status==="active"?C.red:C.green,fontSize:12,fontWeight:700}}>
                        {bot.status==="active"?"⏸ Pause":"▶ Start"}
                      </button>
                      <button onClick={()=>notify("Opening editor...",C.accent,"⚙️")} style={{flex:1,background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"8px",cursor:"pointer",color:C.accent,fontSize:12,fontWeight:700}}>⚙ Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CHAT */}
          {tab==="chat"&&(
            <div style={{height:"100%",margin:0}}>
              <ChatScreen currentUser={user} lang={lang} onBack={()=>setTab("overview")} />
            </div>
          )}

          {/* SECURITY */}
          {tab==="security"&&<SecurityTab currentUser={currentUser} notify={notify} />}

          {/* SETTINGS */}
          {tab==="settings"&&(
            <div style={{animation:"fadeUp 0.3s ease"}}>
              <div style={{fontSize:isMobile?20:26,fontWeight:900,marginBottom:28}}>App <span style={{color:C.accent}}>Settings</span></div>

              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,marginBottom:16}}>
                {/* App Info */}
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,overflow:"hidden"}}>
                  <div style={{padding:"14px 20px",background:C.surface,borderBottom:`1px solid ${C.border}`,fontSize:9,color:C.muted,letterSpacing:3,fontWeight:800}}>APP INFORMATION</div>
                  {[
                    {icon:"💬",label:"App Name",value:"NexTalk"},
                    {icon:"🔥",label:"Firebase Project",value:"nextalk-4ef19"},
                    {icon:"📦",label:"Version",value:"2.0.0"},
                    {icon:"🌍",label:"Region",value:"Global · Multi-language"},
                    {icon:"🔒",label:"Security",value:"E2E · 2FA · Rate Limit"},
                    {icon:"👤",label:"Admin",value:currentUser.name},
                  ].map((s,i,arr)=>(
                    <div key={s.label} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 20px",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
                      <span style={{fontSize:20}}>{s.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{color:C.muted,fontSize:9,letterSpacing:2,fontWeight:800}}>{s.label}</div>
                        <div style={{fontWeight:600,fontSize:13,marginTop:2}}>{s.value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Language */}
                <div>
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,overflow:"hidden",marginBottom:16}}>
                    <div style={{padding:"14px 20px",background:C.surface,borderBottom:`1px solid ${C.border}`,fontSize:9,color:C.muted,letterSpacing:3,fontWeight:800}}>INTERFACE LANGUAGE</div>
                    <div style={{padding:"16px 20px",display:"flex",alignItems:"center",gap:12}}>
                      <span style={{fontSize:28}}>{langObj.flag}</span>
                      <div>
                        <div style={{fontWeight:700,fontSize:15}}>{langObj.name}</div>
                        <div style={{color:C.muted,fontSize:11}}>{langObj.code.toUpperCase()} · {langObj.dir==="rtl"?"Right-to-Left":"Left-to-Right"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Security Features */}
                  <div style={{background:C.card,border:`1px solid ${C.green}33`,borderRadius:20,padding:20}}>
                    <div style={{color:C.green,fontWeight:800,fontSize:11,letterSpacing:2,marginBottom:16}}>🛡️ ACTIVE SECURITY FEATURES</div>
                    {["E2E Message Encryption (AES-256-GCM)","TOTP Two-Factor Authentication","Device Fingerprinting","Rate Limiting (5 attempts/15 min)","Anti-Spam (30 msgs/min)","Session Management (max 5)","Anomaly Detection","XSS Input Sanitization"].map(f=>(
                      <div key={f} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:12}}>
                        <span style={{color:C.green,fontSize:10}}>✓</span>
                        <span style={{color:C.text}}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div style={{padding:24,background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:20}}>
                <div style={{color:C.red,fontWeight:800,marginBottom:10,fontSize:14}}>⚠️ Danger Zone</div>
                <div style={{color:C.muted,fontSize:13,marginBottom:16}}>Signing out will end your admin session and require you to log in again.</div>
                <button onClick={onLogout} style={{background:`linear-gradient(135deg,${C.red},#cc0000)`,border:"none",borderRadius:12,padding:"12px 28px",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14,boxShadow:`0 4px 20px ${C.red}44`}}>Sign Out of Admin</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes popIn{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}
        @keyframes numPulse{0%,100%{opacity:1}50%{opacity:0.7}}
        *{box-sizing:border-box;}
        input::placeholder,textarea::placeholder{color:${C.muted};}
        select option{background:${C.card};}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:${C.bg};}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
        ::-webkit-scrollbar-thumb:hover{background:${C.accent}44;}
        button:active{transform:scale(0.97)!important;}
      `}</style>
    </div>
  );
}
