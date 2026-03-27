import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "./i18n";
import { encryptMessage, decryptMessage, sanitizeText, checkMessageRateLimit, compressImage } from "./security";

const C = {
  bg:"#060a14",surface:"#0d1321",card:"#111827",cardHover:"#151e30",
  border:"#1e2d45",borderGlow:"#00d4ff18",
  accent:"#00d4ff",accentDim:"#00d4ff15",accentGlow:"#00d4ff55",
  gold:"#ffd700",goldDim:"#ffd70015",
  green:"#00ff88",greenDim:"#00ff8815",
  red:"#ff3366",redDim:"#ff336615",
  purple:"#a855f7",purpleDim:"#a855f715",
  text:"#e2e8f0",muted:"#64748b",dim:"#334155",
};

const MSG_LIMIT = 50; // messages per load

function Avatar({ name, photo, size=36, gradient=`linear-gradient(135deg,${C.accent},${C.purple})` }) {
  if (photo) return <img src={photo} alt={name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0}} />;
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:gradient,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:size*0.4,color:"#000",flexShrink:0}}>
      {(name||"U").charAt(0).toUpperCase()}
    </div>
  );
}

function StatusDot({ online }) {
  return <div style={{width:9,height:9,borderRadius:"50%",background:online?C.green:C.dim,boxShadow:online?`0 0 7px ${C.green}`:"none",flexShrink:0}} />;
}

function formatTime(ts) {
  if(!ts)return"";
  const d=new Date(ts), now=new Date(), diff=now-d;
  if(diff<60000)return"just now";
  if(diff<3600000)return Math.floor(diff/60000)+"m ago";
  if(diff<86400000)return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  return d.toLocaleDateString([],{month:"short",day:"numeric"});
}

function formatMsgTime(ts) {
  if(!ts)return"";
  return new Date(ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
}

// ─── Emoji Picker ─────────────────────────────────────────────────────────────
const EMOJIS=["😀","😂","😍","🥰","😎","🤔","😢","😡","👍","👎","❤️","🔥","✨","🎉","🙏","💯","😭","🤣","😊","🥳","💪","👋","🫡","😴","🤩","😏","🤯","🫶","💬","🚀","😇","🥺","😤","🤝","💔","⭐","🌙","☀️","🎵","🎮"];
function EmojiPicker({ onPick, onClose }) {
  return (
    <div style={{position:"absolute",bottom:"100%",left:0,marginBottom:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:12,zIndex:999,boxShadow:`0 8px 40px #00000088`,animation:"popIn 0.15s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(8, 1fr)",gap:4,maxHeight:160,overflowY:"auto"}}>
        {EMOJIS.map(e=>(
          <button key={e} onClick={()=>{onPick(e);onClose();}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",padding:"4px",borderRadius:8,transition:"background 0.1s"}}
            onMouseEnter={ev=>ev.currentTarget.style.background=C.accentDim}
            onMouseLeave={ev=>ev.currentTarget.style.background="none"}
          >{e}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
const REACTIONS = ["❤️","😂","👍","🔥","😢","😮","🎉","💯"];

function MessageBubble({ msg, isMe, onReact, onReply, onDelete }) {
  const [hov, setHov] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  return (
    <div
      style={{display:"flex",flexDirection:isMe?"row-reverse":"row",gap:8,marginBottom:4,alignItems:"flex-end",position:"relative"}}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>{setHov(false);setShowReactions(false);}}
    >
      {!isMe && <Avatar name={msg.senderName} size={28} />}
      <div style={{maxWidth:"72%",position:"relative"}}>
        {/* Reply preview */}
        {msg.replyTo && (
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.accent}`,borderRadius:"8px 8px 0 0",padding:"6px 10px",fontSize:11,color:C.muted,marginBottom:-4}}>
            <span style={{color:C.accent,fontWeight:700}}>↩ {msg.replyTo.senderName}</span>: {(msg.replyTo.text||"").slice(0,50)}{(msg.replyTo.text||"").length>50?"…":""}
          </div>
        )}
        {/* Bubble */}
        <div style={{
          background:isMe?`linear-gradient(135deg,${C.accent}cc,#0066ffcc)`:C.card,
          color:isMe?"#000":C.text,
          borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",
          padding:msg.image?"4px":"10px 14px",
          boxShadow:isMe?`0 4px 20px ${C.accentGlow}`:"none",
          border:!isMe?`1px solid ${C.border}`:"none",
          position:"relative",overflow:"hidden",
        }}>
          {!isMe && <div style={{fontSize:11,fontWeight:700,color:C.accent,marginBottom:4}}>{msg.senderName}</div>}
          {msg.image && (
            <img src={msg.image} alt="img" style={{maxWidth:220,maxHeight:220,borderRadius:12,display:"block",objectFit:"cover"}} />
          )}
          {msg.text && <div style={{fontSize:14,lineHeight:1.5,wordBreak:"break-word"}}>{msg.text}</div>}
          <div style={{fontSize:10,opacity:0.6,marginTop:4,display:"flex",alignItems:"center",gap:6,justifyContent:isMe?"flex-end":"flex-start"}}>
            {formatMsgTime(msg.ts)}
            {isMe && <span style={{fontSize:11}}>{msg.read?"✓✓":"✓"}</span>}
            {msg.encrypted && <span style={{fontSize:9,opacity:0.5}}>🔒</span>}
          </div>
        </div>
        {/* Reactions */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4,justifyContent:isMe?"flex-end":"flex-start"}}>
            {Object.entries(msg.reactions).map(([emoji,count])=>(
              <button key={emoji} onClick={()=>onReact(msg.id,emoji)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"2px 7px",fontSize:12,cursor:"pointer",color:C.text}}>{emoji} {count}</button>
            ))}
          </div>
        )}
        {/* Hover actions */}
        {hov && (
          <div style={{position:"absolute",top:-32,[isMe?"left":"right"]:0,display:"flex",gap:4,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"4px 6px",zIndex:10,boxShadow:"0 4px 20px #00000066",animation:"fadeIn 0.15s ease"}}>
            <button onClick={()=>setShowReactions(!showReactions)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,padding:"2px 4px"}}>😊</button>
            <button onClick={()=>onReply(msg)} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,padding:"2px 6px",color:C.muted}}>↩</button>
            {isMe && <button onClick={()=>onDelete(msg.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,padding:"2px 6px",color:C.red}}>🗑</button>}
          </div>
        )}
        {/* Reaction picker */}
        {showReactions && (
          <div style={{position:"absolute",top:-60,[isMe?"left":"right"]:0,zIndex:11,background:C.card,border:`1px solid ${C.border}`,borderRadius:30,padding:"6px 10px",display:"flex",gap:6,boxShadow:"0 4px 20px #00000066"}}>
            {REACTIONS.map(r=>(
              <button key={r} onClick={()=>{onReact(msg.id,r);setShowReactions(false);}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",transition:"transform 0.1s"}}
                onMouseEnter={e=>e.currentTarget.style.transform="scale(1.3)"}
                onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
              >{r}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Window ──────────────────────────────────────────────────────────────
function ChatWindow({ chat, currentUser, onBack, isMobile }) {
  const [messages, setMessages] = useState([]);
  const [decryptedMsgs, setDecryptedMsgs] = useState({});
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const typingRef = useRef(null);
  const inputRef = useRef(null);

  // Load & decrypt messages from Firebase
  useEffect(() => {
    if (!chat) return;
    const chatId = chat.id;
    if (window.firebase_ref && window.firebase_onValue && window._firebaseDB) {
      const ref = window.firebase_ref(window._firebaseDB, `chats/${chatId}/messages`);
      const unsub = window.firebase_onValue(ref, async snap => {
        const data = snap.val() || {};
        const list = Object.entries(data)
          .map(([id,m]) => ({id,...m}))
          .sort((a,b) => a.ts - b.ts)
          .slice(-MSG_LIMIT); // last 50 messages
        setMessages(list);
        // Decrypt all messages
        const decMap = {};
        for (const m of list) {
          if (m.encrypted && m.cipher && m.iv) {
            try {
              decMap[m.id] = await decryptMessage(m.cipher, m.iv, chatId);
            } catch { decMap[m.id] = "[Encrypted message]"; }
          } else {
            decMap[m.id] = m.text || "";
          }
        }
        setDecryptedMsgs(decMap);
        // Mark as read
        list.filter(m=>m.senderId!==currentUser.uid&&!m.read).forEach(m=>{
          window.firebase_update(window.firebase_ref(window._firebaseDB,`chats/${chatId}/messages/${m.id}`),{read:true});
        });
      });
      // Listen for typing indicators
      const typRef = window.firebase_ref(window._firebaseDB, `typing/${chatId}/${chat.userId}`);
      const typUnsub = window.firebase_onValue(typRef, snap => setIsTyping(!!snap.val()));
      return () => { unsub&&unsub(); typUnsub&&typUnsub(); };
    } else {
      // Demo
      setMessages([
        {id:"1",senderId:chat.userId,senderName:chat.name,text:"Hey! How are you?",ts:Date.now()-300000,read:true},
        {id:"2",senderId:currentUser.uid,senderName:currentUser.name,text:"I'm great! NexTalk is amazing 🔥",ts:Date.now()-240000,read:true},
        {id:"3",senderId:chat.userId,senderName:chat.name,text:"Totally agree! The UI is incredible!",ts:Date.now()-180000,read:true},
        {id:"4",senderId:currentUser.uid,senderName:currentUser.name,text:"Thanks! Built with ❤️ and secured with E2E 🔒",ts:Date.now()-60000,read:false},
      ]);
      setDecryptedMsgs({
        "1":"Hey! How are you?","2":"I'm great! NexTalk is amazing 🔥",
        "3":"Totally agree! The UI is incredible!","4":"Thanks! Built with ❤️ and secured with E2E 🔒"
      });
    }
  }, [chat?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages]);

  const sendMessage = async (extraText=null, imageUrl=null) => {
    const rawText = extraText ?? text.trim();
    if (!rawText && !imageUrl) return;

    // Rate limit check
    const rl = checkMessageRateLimit(currentUser.uid);
    if (!rl.allowed) { setError(rl.reason); setTimeout(()=>setError(""),3000); return; }

    // Sanitize input
    const cleanText = sanitizeText(rawText);
    
    setSending(true);
    try {
      let msgData;
      if (window.firebase_ref && window.firebase_set && window._firebaseDB) {
        // Encrypt the message
        const enc = cleanText ? await encryptMessage(cleanText, chat.id) : {cipher:null,iv:null,encrypted:false};
        msgData = {
          senderId: currentUser.uid,
          senderName: currentUser.name,
          cipher: enc.cipher || null,
          iv: enc.iv || null,
          text: enc.encrypted ? "" : (cleanText || ""),
          encrypted: enc.encrypted || false,
          image: imageUrl || null,
          ts: Date.now(),
          read: false,
          replyTo: replyTo ? {id:replyTo.id,text:decryptedMsgs[replyTo.id]||replyTo.text,senderName:replyTo.senderName} : null,
          reactions: {},
        };
        const key = Date.now().toString();
        await window.firebase_set(window.firebase_ref(window._firebaseDB,`chats/${chat.id}/messages/${key}`), msgData);
        await window.firebase_update(window.firebase_ref(window._firebaseDB,`chats/${chat.id}`), {
          lastMessage: cleanText ? cleanText.slice(0,40) : "📷 Photo",
          lastTs: Date.now(),
          [`unread_${chat.userId}`]: (window._unreadCount||0)+1,
        });
        // Stop typing indicator
        window.firebase_set(window.firebase_ref(window._firebaseDB,`typing/${chat.id}/${currentUser.uid}`),false);
      } else {
        // Demo
        const id = Date.now().toString();
        setMessages(prev => [...prev, {id,senderId:currentUser.uid,senderName:currentUser.name,text:cleanText,image:imageUrl,ts:Date.now(),read:false,reactions:{}}]);
        setDecryptedMsgs(prev => ({...prev,[id]:cleanText}));
      }
      setText(""); setReplyTo(null);
    } catch (e) {
      setError("Failed to send message"); setTimeout(()=>setError(""),3000);
    }
    setSending(false);
  };

  const handleReact = async (msgId, emoji) => {
    setMessages(prev=>prev.map(m=>{
      if(m.id!==msgId)return m;
      const r={...m.reactions};r[emoji]=(r[emoji]||0)+1;return{...m,reactions:r};
    }));
    if(window.firebase_ref&&window._firebaseDB){
      const path=`chats/${chat.id}/messages/${msgId}/reactions/${emoji}`;
      const snap=await window.firebase_get(window.firebase_ref(window._firebaseDB,path));
      window.firebase_set(window.firebase_ref(window._firebaseDB,path),(snap.exists()?snap.val():0)+1);
    }
  };

  const handleDelete = async (msgId) => {
    setMessages(prev=>prev.filter(m=>m.id!==msgId));
    setDecryptedMsgs(prev=>{const n={...prev};delete n[msgId];return n;});
    if(window.firebase_ref&&window._firebaseDB)
      window.firebase_set(window.firebase_ref(window._firebaseDB,`chats/${chat.id}/messages/${msgId}`),null);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10*1024*1024) { setError("Image must be under 10MB"); return; }
    setUploading(true);
    try {
      const { compressImage } = await import("./security");
      const compressed = await compressImage(file, 200);
      await sendMessage("", compressed);
    } catch { setError("Failed to upload image"); }
    setUploading(false);
    e.target.value = "";
  };

  const handleTyping = (val) => {
    setText(val);
    if (window.firebase_ref && window._firebaseDB) {
      clearTimeout(typingRef.current);
      window.firebase_set(window.firebase_ref(window._firebaseDB,`typing/${chat.id}/${currentUser.uid}`),true);
      typingRef.current = setTimeout(()=>{
        window.firebase_set(window.firebase_ref(window._firebaseDB,`typing/${chat.id}/${currentUser.uid}`),false);
      },2000);
    }
  };

  const grouped = messages.reduce((acc,m)=>{
    const day=new Date(m.ts).toDateString();
    if(!acc[day])acc[day]=[];acc[day].push(m);return acc;
  },{});

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
      {/* Header */}
      <div style={{padding:"12px 16px",background:C.surface,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0,boxShadow:`0 2px 20px #00000044`}}>
        {isMobile && <button onClick={onBack} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:18,padding:0}}>←</button>}
        <div style={{position:"relative"}}>
          <Avatar name={chat.name} photo={chat.photo} size={40} />
          <div style={{position:"absolute",bottom:0,right:0,width:11,height:11,borderRadius:"50%",background:chat.online?C.green:C.dim,border:`2px solid ${C.surface}`}} />
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:15,display:"flex",alignItems:"center",gap:6}}>
            {chat.name}
            {chat.premium && <span style={{fontSize:12}}>{chat.badge||"⭐"}</span>}
            <span title="End-to-End Encrypted" style={{fontSize:10,color:C.green,background:C.greenDim,padding:"1px 6px",borderRadius:10,fontWeight:700}}>🔒 E2E</span>
          </div>
          <div style={{fontSize:11,color:isTyping&&chat.online?C.gold:chat.online?C.green:C.muted}}>
            {isTyping&&chat.online?"✍️ typing...":chat.online?"online":"last seen recently"}
          </div>
        </div>
        <button style={{background:C.accentDim,border:`1px solid ${C.accent}33`,borderRadius:10,padding:"6px 10px",color:C.accent,cursor:"pointer",fontSize:16}} title="Voice Call">📞</button>
        <button style={{background:C.purpleDim,border:`1px solid ${C.purple}33`,borderRadius:10,padding:"6px 10px",color:C.purple,cursor:"pointer",fontSize:16}} title="Video Call">📹</button>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:2}}>
        {Object.entries(grouped).map(([day,msgs])=>(
          <div key={day}>
            <div style={{textAlign:"center",margin:"12px 0 8px"}}>
              <span style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"4px 14px",fontSize:11,color:C.muted}}>
                {day===new Date().toDateString()?"Today":day}
              </span>
            </div>
            {msgs.map(m=>(
              <MessageBubble
                key={m.id}
                msg={{...m, text: decryptedMsgs[m.id] ?? m.text ?? ""}}
                isMe={m.senderId===currentUser.uid}
                onReact={handleReact}
                onReply={setReplyTo}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ))}
        {messages.length === 0 && (
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:C.muted,gap:8,padding:40}}>
            <div style={{fontSize:40}}>🔒</div>
            <div style={{fontWeight:700,color:C.text}}>Encrypted Chat</div>
            <div style={{fontSize:12,textAlign:"center"}}>Messages are end-to-end encrypted.<br/>Only you and {chat.name} can read them.</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && <div style={{padding:"6px 16px",background:C.redDim,borderTop:`1px solid ${C.red}33`,color:C.red,fontSize:12,textAlign:"center"}}>⚠ {error}</div>}

      {/* Reply preview */}
      {replyTo && (
        <div style={{padding:"8px 16px",background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1,borderLeft:`3px solid ${C.accent}`,paddingLeft:10,fontSize:12}}>
            <div style={{color:C.accent,fontWeight:700}}>Replying to {replyTo.senderName}</div>
            <div style={{color:C.muted}}>{(decryptedMsgs[replyTo.id]||replyTo.text||"").slice(0,60)}…</div>
          </div>
          <button onClick={()=>setReplyTo(null)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>×</button>
        </div>
      )}

      {/* Input */}
      <div style={{padding:"10px 12px",background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"flex-end",gap:8,flexShrink:0}}>
        <div style={{position:"relative"}}>
          <button onClick={()=>setShowEmoji(!showEmoji)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",padding:"8px 6px",opacity:0.7}}>😊</button>
          {showEmoji && <EmojiPicker onPick={e=>{setText(t=>t+e);inputRef.current?.focus();}} onClose={()=>setShowEmoji(false)} />}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImageUpload} />
        <button onClick={()=>fileRef.current?.click()} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",padding:"8px 6px",opacity:0.7}}>
          {uploading?"⏳":"📎"}
        </button>
        <input
          ref={inputRef}
          value={text}
          onChange={e=>handleTyping(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),sendMessage())}
          placeholder="Message... (End-to-End Encrypted 🔒)"
          style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:"10px 16px",color:C.text,fontSize:14,outline:"none",resize:"none",fontFamily:"inherit"}}
        />
        <button
          onClick={()=>sendMessage()}
          disabled={!text.trim()||sending}
          style={{width:42,height:42,borderRadius:"50%",border:"none",background:text.trim()&&!sending?`linear-gradient(135deg,${C.accent},#0066ff)`:C.dim,color:text.trim()&&!sending?"#000":C.muted,cursor:text.trim()&&!sending?"pointer":"default",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s",flexShrink:0,boxShadow:text.trim()?`0 4px 16px ${C.accentGlow}`:"none"}}
        >
          {sending?"⏳":"➤"}
        </button>
      </div>
    </div>
  );
}

// ─── Chat List ────────────────────────────────────────────────────────────────
function ChatList({ chats, activeId, onSelect, currentUser, isMobile }) {
  const [search, setSearch] = useState("");
  const filtered = chats.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||
    (c.lastMessage||"").toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.surface,borderRight:`1px solid ${C.border}`}}>
      <div style={{padding:"16px 16px 8px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:18,fontWeight:900,color:C.text,marginBottom:12}}>
          💬 <span style={{color:C.accent}}>Messages</span>
          <span style={{fontSize:10,marginLeft:8,color:C.green,background:C.greenDim,padding:"2px 8px",borderRadius:10,fontWeight:700}}>🔒 E2E</span>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search chats..."
          style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"9px 14px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box"}} />
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {filtered.length===0 && <div style={{textAlign:"center",padding:32,color:C.muted,fontSize:13}}>{search?"No results":"No conversations yet"}</div>}
        {filtered.map(chat=>(
          <div key={chat.id} onClick={()=>onSelect(chat)} style={{
            display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
            cursor:"pointer",transition:"background 0.15s",
            background:activeId===chat.id?C.accentDim:"transparent",
            borderLeft:activeId===chat.id?`3px solid ${C.accent}`:"3px solid transparent",
            borderBottom:`1px solid ${C.border}44`,
          }}
            onMouseEnter={e=>{if(activeId!==chat.id)e.currentTarget.style.background=`${C.accent}08`;}}
            onMouseLeave={e=>{if(activeId!==chat.id)e.currentTarget.style.background="transparent";}}
          >
            <div style={{position:"relative"}}>
              <Avatar name={chat.name} photo={chat.photo} size={46} />
              <div style={{position:"absolute",bottom:0,right:0,width:12,height:12,borderRadius:"50%",background:chat.online?C.green:C.dim,border:`2px solid ${C.surface}`}} />
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:5}}>
                  {chat.name}
                  {chat.premium&&<span style={{fontSize:12}}>{chat.badge||"⭐"}</span>}
                </div>
                <div style={{fontSize:10,color:C.muted}}>{formatTime(chat.lastTs)}</div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:12,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>
                  {chat.lastMessage||"Say hello! 👋"}
                </div>
                {chat.unread>0&&<div style={{background:C.accent,color:"#000",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:800,flexShrink:0}}>{chat.unread}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Chat Screen ─────────────────────────────────────────────────────────
export default function ChatScreen({ currentUser, lang="en", onBack }) {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(()=>{
    const h=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h);
  },[]);

  useEffect(()=>{
    if(window.firebase_ref&&window.firebase_onValue&&window._firebaseDB){
      // Load users
      const usersRef=window.firebase_ref(window._firebaseDB,"users");
      const statusRef=window.firebase_ref(window._firebaseDB,"status");
      let usersData={}, statusData={};
      
      const buildChats=()=>{
        const list=Object.values(usersData)
          .filter(u=>u.uid!==currentUser.uid)
          .map(u=>({
            id:[currentUser.uid,u.uid].sort().join("_"),
            userId:u.uid,name:u.name,photo:u.photoURL,
            premium:u.premium,badge:u.badge,
            online:(statusData[u.uid]?.state==="online"),
            status:statusData[u.uid]?.state||"offline",
            lastMessage:"",lastTs:null,unread:0,
          }));
        // Load last messages
        if(window._chatMeta){
          list.forEach(c=>{
            const meta=window._chatMeta[c.id];
            if(meta){c.lastMessage=meta.lastMessage||"";c.lastTs=meta.lastTs||null;c.unread=meta[`unread_${currentUser.uid}`]||0;}
          });
        }
        setChats(list.sort((a,b)=>(b.lastTs||0)-(a.lastTs||0)));
      };

      const u1=window.firebase_onValue(usersRef,snap=>{usersData=snap.val()||{};buildChats();});
      const u2=window.firebase_onValue(statusRef,snap=>{statusData=snap.val()||{};buildChats();});
      const chatsRef=window.firebase_ref(window._firebaseDB,"chats");
      const u3=window.firebase_onValue(chatsRef,snap=>{
        window._chatMeta=snap.val()||{};buildChats();
      });
      return()=>{u1&&u1();u2&&u2();u3&&u3();};
    } else {
      setChats([
        {id:"demo_1",userId:"1",name:"Ahmed Mohamed",online:true,premium:true,badge:"👑",lastMessage:"Hey! How are you?",lastTs:Date.now()-300000,unread:2},
        {id:"demo_2",userId:"2",name:"Sara Hassan",online:true,premium:true,badge:"💎",lastMessage:"Check this out!",lastTs:Date.now()-900000,unread:0},
        {id:"demo_3",userId:"3",name:"Mohamed Ali",online:false,premium:false,badge:null,lastMessage:"Thanks bro 🙏",lastTs:Date.now()-3600000,unread:0},
        {id:"demo_4",userId:"4",name:"Nour Khaled",online:true,premium:true,badge:"🔥",lastMessage:"NexTalk is 🔥🔥",lastTs:Date.now()-7200000,unread:5},
        {id:"demo_5",userId:"5",name:"Omar Farouk",online:false,premium:false,badge:null,lastMessage:"lol 😂",lastTs:Date.now()-86400000,unread:0},
      ]);
    }
  },[currentUser.uid]);

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    // Clear unread
    if(window.firebase_ref&&window._firebaseDB){
      window.firebase_update(window.firebase_ref(window._firebaseDB,`chats/${chat.id}`),{[`unread_${currentUser.uid}`]:0});
    }
    setChats(prev=>prev.map(c=>c.id===chat.id?{...c,unread:0}:c));
  };

  const showList=!isMobile||!activeChat;
  const showChat=!isMobile||activeChat;

  return (
    <div style={{height:"100%",display:"flex",overflow:"hidden"}}>
      {showList&&(
        <div style={{width:isMobile?"100%":320,flexShrink:0,height:"100%"}}>
          <ChatList chats={chats} activeId={activeChat?.id} onSelect={handleSelectChat} currentUser={currentUser} isMobile={isMobile} />
        </div>
      )}
      {showChat&&(
        <div style={{flex:1,height:"100%",display:"flex",flexDirection:"column"}}>
          {activeChat?(
            <ChatWindow chat={activeChat} currentUser={currentUser} onBack={()=>setActiveChat(null)} isMobile={isMobile} />
          ):(
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:C.muted,gap:16}}>
              <div style={{fontSize:60}}>💬</div>
              <div style={{fontSize:18,fontWeight:700,color:C.text}}>Select a conversation</div>
              <div style={{fontSize:13,textAlign:"center"}}>Choose a chat from the list<br/>All messages are E2E encrypted 🔒</div>
            </div>
          )}
        </div>
      )}
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes popIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:${C.bg};} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px;}
        *{box-sizing:border-box;} input::placeholder,textarea::placeholder{color:${C.muted};}
      `}</style>
    </div>
  );
}
