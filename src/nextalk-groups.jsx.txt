import { useState, useEffect, useRef } from "react";

const C = {
  bg:"#060a14",surface:"#0d1321",card:"#111827",cardHover:"#151e30",
  border:"#1e2d45",borderGlow:"#00d4ff18",
  accent:"#00d4ff",accentDim:"#00d4ff15",accentGlow:"#00d4ff55",
  gold:"#ffd700",goldDim:"#ffd70015",
  green:"#00ff88",greenDim:"#00ff8815",
  red:"#ff3366",redDim:"#ff336615",
  purple:"#a855f7",purpleDim:"#a855f715",
  orange:"#ff8c00",orangeDim:"#ff8c0015",
  text:"#e2e8f0",muted:"#64748b",dim:"#334155",
};

function Avatar({ name, photo, size=36, color=C.accent }) {
  if (photo) return <img src={photo} alt={name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0}} />;
  const initials = (name||"G").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div style={{width:size,height:size,borderRadius:size>40?"16px":"50%",background:`linear-gradient(135deg,${color},${color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:size*0.38,color:"#000",flexShrink:0}}>
      {initials}
    </div>
  );
}

function formatTime(ts) {
  if(!ts)return"";
  const d=new Date(ts),now=new Date(),diff=now-d;
  if(diff<60000)return"just now";
  if(diff<3600000)return Math.floor(diff/60000)+"m";
  if(diff<86400000)return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  return d.toLocaleDateString([],{month:"short",day:"numeric"});
}

function formatMsgTime(ts) {
  if(!ts)return"";
  return new Date(ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
}

// ─── Group/Channel Settings Modal ─────────────────────────────────────────────
function GroupSettingsModal({ group, currentUser, onClose, onUpdate, onDelete }) {
  const [tab, setTab] = useState("info");
  const [name, setName] = useState(group.name || "");
  const [desc, setDesc] = useState(group.description || "");
  const [isPrivate, setIsPrivate] = useState(group.isPrivate || false);
  const [slowMode, setSlowMode] = useState(group.slowMode || 0);
  const [antiSpam, setAntiSpam] = useState(group.antiSpam || false);
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState(group.inviteLink || "");
  const [success, setSuccess] = useState("");

  const isAdmin = group.admins?.includes(currentUser.uid) || group.ownerId === currentUser.uid;
  const isOwner = group.ownerId === currentUser.uid;

  useEffect(() => {
    if (window.firebase_ref && window.firebase_onValue && window._firebaseDB && group.members) {
      const memberIds = Object.keys(group.members || {});
      const loaded = [];
      let count = 0;
      memberIds.forEach(uid => {
        window.firebase_onValue(
          window.firebase_ref(window._firebaseDB, `users/${uid}`),
          snap => {
            if (snap.exists()) loaded.push({ ...snap.val(), role: group.members[uid] });
            count++;
            if (count === memberIds.length) setMembers(loaded);
          },
          { onlyOnce: true }
        );
      });
    }
  }, [group.id]);

  const saveInfo = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const updates = { name: name.trim(), description: desc, isPrivate, slowMode, antiSpam };
    if (window.firebase_ref && window.firebase_update && window._firebaseDB) {
      await window.firebase_update(window.firebase_ref(window._firebaseDB, `groups/${group.id}`), updates);
    }
    onUpdate({ ...group, ...updates });
    setSaving(false);
    setSuccess("Saved ✓");
    setTimeout(() => setSuccess(""), 2000);
  };

  const generateInvite = async () => {
    const link = `https://nextalk.app/join/${group.id}_${Math.random().toString(36).slice(2,8)}`;
    setInviteLink(link);
    if (window.firebase_ref && window.firebase_update && window._firebaseDB) {
      await window.firebase_update(window.firebase_ref(window._firebaseDB, `groups/${group.id}`), { inviteLink: link });
    }
    navigator.clipboard?.writeText(link).catch(() => {});
    setSuccess("Link copied! ✓");
    setTimeout(() => setSuccess(""), 2000);
  };

  const promoteToAdmin = async (uid) => {
    const admins = [...(group.admins || []), uid];
    if (window.firebase_ref && window.firebase_update && window._firebaseDB) {
      await window.firebase_update(window.firebase_ref(window._firebaseDB, `groups/${group.id}`), { admins });
    }
    setMembers(prev => prev.map(m => m.uid === uid ? { ...m, role: "admin" } : m));
    setSuccess("Promoted to admin ✓");
    setTimeout(() => setSuccess(""), 2000);
  };

  const removeMember = async (uid) => {
    if (!window.confirm("Remove this member?")) return;
    const newMembers = { ...(group.members || {}) };
    delete newMembers[uid];
    if (window.firebase_ref && window.firebase_set && window._firebaseDB) {
      await window.firebase_set(window.firebase_ref(window._firebaseDB, `groups/${group.id}/members`), newMembers);
    }
    setMembers(prev => prev.filter(m => m.uid !== uid));
    setSuccess("Member removed ✓");
    setTimeout(() => setSuccess(""), 2000);
  };

  const deleteGroup = async () => {
    if (!window.confirm(`Delete "${group.name}"? This cannot be undone.`)) return;
    if (window.firebase_ref && window.firebase_set && window._firebaseDB) {
      await window.firebase_set(window.firebase_ref(window._firebaseDB, `groups/${group.id}`), null);
      await window.firebase_set(window.firebase_ref(window._firebaseDB, `groupMessages/${group.id}`), null);
    }
    onDelete(group.id);
    onClose();
  };

  const tabs = [
    { id: "info", label: "⚙️ Info" },
    { id: "members", label: "👥 Members" },
    { id: "permissions", label: "🛡️ Settings" },
    { id: "invite", label: "🔗 Invite" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 0", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>
              {group.type === "channel" ? "📢 Channel Settings" : "👥 Group Settings"}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 1 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: tab === t.id ? C.accentDim : "none",
                border: `1px solid ${tab === t.id ? C.accent : "transparent"}`,
                color: tab === t.id ? C.accent : C.muted,
                borderRadius: 20, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap"
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {success && (
          <div style={{ background: C.greenDim, color: C.green, textAlign: "center", padding: "8px", fontSize: 13, fontWeight: 700 }}>{success}</div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {/* Info Tab */}
          {tab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <div style={{ width: 80, height: 80, borderRadius: 20, background: `linear-gradient(135deg, ${C.purple}, ${C.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 12px" }}>
                  {group.type === "channel" ? "📢" : "👥"}
                </div>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  {group.type === "channel" ? "Channel Name" : "Group Name"}
                </label>
                <input value={name} onChange={e => setName(e.target.value)} disabled={!isAdmin}
                  style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 14px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Description</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} disabled={!isAdmin}
                  style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 14px", color: C.text, fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card, borderRadius: 12, padding: "12px 16px" }}>
                <div>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>🔒 Private</div>
                  <div style={{ color: C.muted, fontSize: 12 }}>Only invited members can join</div>
                </div>
                <div onClick={() => isAdmin && setIsPrivate(p => !p)} style={{ width: 44, height: 24, borderRadius: 12, background: isPrivate ? C.accent : C.dim, cursor: isAdmin ? "pointer" : "default", position: "relative", transition: "background 0.2s" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: isPrivate ? 23 : 3, transition: "left 0.2s" }} />
                </div>
              </div>
              {isAdmin && (
                <button onClick={saveInfo} disabled={saving} style={{ background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, color: "#000", border: "none", borderRadius: 12, padding: "13px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              )}
              {isOwner && (
                <button onClick={deleteGroup} style={{ background: C.redDim, color: C.red, border: `1px solid ${C.red}44`, borderRadius: 12, padding: "13px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                  🗑️ Delete {group.type === "channel" ? "Channel" : "Group"}
                </button>
              )}
            </div>
          )}

          {/* Members Tab */}
          {tab === "members" && (
            <div>
              <div style={{ color: C.muted, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{members.length} MEMBERS</div>
              {members.map(m => (
                <div key={m.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}33` }}>
                  <Avatar name={m.name} photo={m.photoURL} size={38} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{m.name}</div>
                    <div style={{ color: C.muted, fontSize: 12 }}>{m.username || ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {m.role === "owner" && <span style={{ background: C.goldDim, color: C.gold, borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>Owner</span>}
                    {m.role === "admin" && <span style={{ background: C.accentDim, color: C.accent, borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>Admin</span>}
                    {isAdmin && m.uid !== currentUser.uid && m.role !== "owner" && (
                      <>
                        {m.role !== "admin" && (
                          <button onClick={() => promoteToAdmin(m.uid)} style={{ background: C.accentDim, color: C.accent, border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>↑ Admin</button>
                        )}
                        <button onClick={() => removeMember(m.uid)} style={{ background: C.redDim, color: C.red, border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Remove</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Permissions Tab */}
          {tab === "permissions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ color: C.muted, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>MODERATION</div>
              {[
                { key: "antiSpam", label: "🛡️ Anti-Spam", desc: "Auto-delete repeated messages" },
                { key: "slowMode", label: "⏳ Slow Mode", desc: "Limit how often members can send", isSelect: true },
              ].map(item => (
                <div key={item.key} style={{ background: C.card, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                    <div style={{ color: C.muted, fontSize: 12 }}>{item.desc}</div>
                  </div>
                  {item.isSelect ? (
                    <select value={slowMode} onChange={e => setSlowMode(+e.target.value)} disabled={!isAdmin}
                      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 8px", color: C.text, fontSize: 13 }}>
                      <option value={0}>Off</option>
                      <option value={10}>10s</option>
                      <option value={30}>30s</option>
                      <option value={60}>1min</option>
                      <option value={300}>5min</option>
                    </select>
                  ) : (
                    <div onClick={() => isAdmin && setAntiSpam(p => !p)} style={{ width: 44, height: 24, borderRadius: 12, background: antiSpam ? C.accent : C.dim, cursor: isAdmin ? "pointer" : "default", position: "relative", transition: "background 0.2s" }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: antiSpam ? 23 : 3, transition: "left 0.2s" }} />
                    </div>
                  )}
                </div>
              ))}
              {group.type !== "channel" && (
                <>
                  <div style={{ color: C.muted, fontSize: 12, fontWeight: 700, marginTop: 8 }}>MEMBER PERMISSIONS</div>
                  {[
                    { id: "canSendMessages", label: "✉️ Send Messages" },
                    { id: "canSendMedia", label: "📷 Send Media" },
                    { id: "canAddMembers", label: "👤 Add Members" },
                    { id: "canPinMessages", label: "📌 Pin Messages" },
                  ].map(perm => {
                    const val = group.permissions?.[perm.id] !== false;
                    return (
                      <div key={perm.id} style={{ background: C.card, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{perm.label}</div>
                        <div onClick={() => {}} style={{ width: 44, height: 24, borderRadius: 12, background: val ? C.green : C.dim, position: "relative", opacity: !isAdmin ? 0.5 : 1 }}>
                          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: val ? 23 : 3, transition: "left 0.2s" }} />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              {isAdmin && (
                <button onClick={saveInfo} disabled={saving} style={{ background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, color: "#000", border: "none", borderRadius: 12, padding: "13px", fontWeight: 800, fontSize: 15, cursor: "pointer", marginTop: 8 }}>
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              )}
            </div>
          )}

          {/* Invite Tab */}
          {tab === "invite" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: C.card, borderRadius: 16, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
                <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Invite Link</div>
                {inviteLink ? (
                  <>
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.accent, fontSize: 12, wordBreak: "break-all", marginBottom: 12 }}>{inviteLink}</div>
                    <button onClick={() => { navigator.clipboard?.writeText(inviteLink); setSuccess("Copied!"); setTimeout(() => setSuccess(""), 2000); }}
                      style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer" }}>
                      📋 Copy Link
                    </button>
                  </>
                ) : (
                  <button onClick={generateInvite}
                    style={{ background: `linear-gradient(135deg, ${C.accent}, #0066ff)`, color: "#000", border: "none", borderRadius: 12, padding: "12px 24px", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                    Generate Invite Link
                  </button>
                )}
              </div>
              <div style={{ background: C.card, borderRadius: 16, padding: 16 }}>
                <div style={{ color: C.muted, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>GROUP INFO</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: C.muted, fontSize: 13 }}>Type</span>
                    <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{group.type === "channel" ? "📢 Channel" : "👥 Group"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: C.muted, fontSize: 13 }}>Privacy</span>
                    <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{group.isPrivate ? "🔒 Private" : "🌐 Public"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: C.muted, fontSize: 13 }}>Members</span>
                    <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{Object.keys(group.members || {}).length}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: C.muted, fontSize: 13 }}>Created</span>
                    <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{group.createdAt ? new Date(group.createdAt).toLocaleDateString() : "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create Group/Channel Modal ─────────────────────────────────────────────────
function CreateGroupModal({ type, currentUser, users, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1); // 1=info, 2=members

  const filtered = users.filter(u =>
    (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.username || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (uid) => {
    setSelectedUsers(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  };

  const create = async () => {
    if (!name.trim()) { setError("Enter a name"); return; }
    if (type === "group" && selectedUsers.length === 0) { setError("Add at least 1 member"); return; }
    setCreating(true);
    const groupId = `g_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const members = {};
    members[currentUser.uid] = "owner";
    selectedUsers.forEach(uid => { members[uid] = "member"; });
    const groupData = {
      id: groupId,
      type,
      name: name.trim(),
      description: desc,
      isPrivate,
      ownerId: currentUser.uid,
      admins: [currentUser.uid],
      members,
      permissions: { canSendMessages: true, canSendMedia: true, canAddMembers: true, canPinMessages: false },
      antiSpam: false,
      slowMode: 0,
      createdAt: Date.now(),
      lastMessage: "",
      lastTs: Date.now(),
      inviteLink: "",
    };
    if (window.firebase_ref && window.firebase_set && window._firebaseDB) {
      await window.firebase_set(window.firebase_ref(window._firebaseDB, `groups/${groupId}`), groupData);
      // Add group ref to each member
      for (const uid of [...selectedUsers, currentUser.uid]) {
        await window.firebase_set(window.firebase_ref(window._firebaseDB, `userGroups/${uid}/${groupId}`), true);
      }
    }
    setCreating(false);
    onCreate(groupData);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, width: "100%", maxWidth: 440, maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>
            {type === "channel" ? "📢 New Channel" : "👥 New Group"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: type === "channel" ? `linear-gradient(135deg, ${C.orange}, ${C.gold})` : `linear-gradient(135deg, ${C.purple}, ${C.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto" }}>
                  {type === "channel" ? "📢" : "👥"}
                </div>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={type === "channel" ? "Channel name..." : "Group name..."}
                  style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Description</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="What's this about..."
                  style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", color: C.text, fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
              </div>
              <div style={{ background: C.card, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>🔒 Private</div>
                  <div style={{ color: C.muted, fontSize: 12 }}>Invite-only</div>
                </div>
                <div onClick={() => setIsPrivate(p => !p)} style={{ width: 44, height: 24, borderRadius: 12, background: isPrivate ? C.accent : C.dim, cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: isPrivate ? 23 : 3, transition: "left 0.2s" }} />
                </div>
              </div>
              {error && <div style={{ color: C.red, fontSize: 13, fontWeight: 700 }}>⚠ {error}</div>}
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search users..."
                  style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 14px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
              {selectedUsers.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {selectedUsers.map(uid => {
                    const u = users.find(x => x.uid === uid);
                    return u ? (
                      <div key={uid} onClick={() => toggle(uid)} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accent}44`, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        {u.name} ×
                      </div>
                    ) : null;
                  })}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {filtered.map(u => (
                  <div key={u.uid} onClick={() => toggle(u.uid)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, cursor: "pointer", background: selectedUsers.includes(u.uid) ? C.accentDim : "transparent", border: `1px solid ${selectedUsers.includes(u.uid) ? C.accent + "44" : "transparent"}`, transition: "all 0.15s" }}>
                    <Avatar name={u.name} photo={u.photoURL} size={38} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{u.name}</div>
                      <div style={{ color: C.muted, fontSize: 12 }}>{u.username || ""}</div>
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${selectedUsers.includes(u.uid) ? C.accent : C.border}`, background: selectedUsers.includes(u.uid) ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: 12, fontWeight: 800 }}>
                      {selectedUsers.includes(u.uid) ? "✓" : ""}
                    </div>
                  </div>
                ))}
              </div>
              {error && <div style={{ color: C.red, fontSize: 13, fontWeight: 700, marginTop: 10 }}>⚠ {error}</div>}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10, flexShrink: 0 }}>
          {step === 2 && (
            <button onClick={() => setStep(1)} style={{ flex: 1, background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px", fontWeight: 700, cursor: "pointer" }}>← Back</button>
          )}
          {step === 1 ? (
            <button onClick={() => { setError(""); if (!name.trim()) { setError("Enter a name"); return; } setStep(2); }}
              style={{ flex: 2, background: `linear-gradient(135deg, ${type === "channel" ? C.orange : C.purple}, ${C.accent})`, color: "#000", border: "none", borderRadius: 12, padding: "13px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              {type === "channel" ? "Next →" : "Add Members →"}
            </button>
          ) : (
            <button onClick={create} disabled={creating}
              style={{ flex: 2, background: `linear-gradient(135deg, ${type === "channel" ? C.orange : C.purple}, ${C.accent})`, color: "#000", border: "none", borderRadius: 12, padding: "13px", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: creating ? 0.6 : 1 }}>
              {creating ? "Creating..." : `Create ${type === "channel" ? "Channel" : "Group"} ✓`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Group/Channel Message Bubble ─────────────────────────────────────────────
function GrpBubble({ msg, isMe, isAdmin, onDelete, onPin }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, marginBottom: 4, alignItems: "flex-end" }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {!isMe && <Avatar name={msg.senderName} size={28} />}
      <div style={{ maxWidth: "72%", position: "relative" }}>
        <div style={{
          background: isMe ? `linear-gradient(135deg,${C.accent}cc,#0066ffcc)` : C.card,
          color: isMe ? "#000" : C.text,
          borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          padding: "10px 14px",
          border: !isMe ? `1px solid ${C.border}` : "none",
          boxShadow: isMe ? `0 4px 20px ${C.accentGlow}` : "none",
        }}>
          {!isMe && <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 4 }}>{msg.senderName}</div>}
          {msg.text && <div style={{ fontSize: 14, lineHeight: 1.5, wordBreak: "break-word" }}>{msg.text}</div>}
          {msg.image && <img src={msg.image} alt="img" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 10, display: "block" }} />}
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, display: "flex", gap: 6, justifyContent: isMe ? "flex-end" : "flex-start" }}>
            {formatMsgTime(msg.ts)}
            {msg.pinned && <span>📌</span>}
          </div>
        </div>
        {hov && (
          <div style={{ position: "absolute", top: -32, [isMe ? "left" : "right"]: 0, display: "flex", gap: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "4px 6px", zIndex: 10 }}>
            {isAdmin && <button onClick={() => onPin(msg.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: C.muted, padding: "2px 6px" }}>📌</button>}
            {(isMe || isAdmin) && <button onClick={() => onDelete(msg.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.red, padding: "2px 6px" }}>🗑</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Group/Channel Chat Window ─────────────────────────────────────────────────
function GroupChatWindow({ group, currentUser, onBack, onSettingsOpen }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pinnedMsg, setPinnedMsg] = useState(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  const isAdmin = group.admins?.includes(currentUser.uid) || group.ownerId === currentUser.uid;
  const canSend = group.type !== "channel" || isAdmin;
  const isMemberCount = Object.keys(group.members || {}).length;

  useEffect(() => {
    if (!group) return;
    if (window.firebase_ref && window.firebase_onValue && window._firebaseDB) {
      const ref = window.firebase_ref(window._firebaseDB, `groupMessages/${group.id}`);
      const unsub = window.firebase_onValue(ref, snap => {
        const data = snap.val() || {};
        const list = Object.entries(data).map(([id, m]) => ({ id, ...m })).sort((a, b) => a.ts - b.ts).slice(-60);
        setMessages(list);
        const pinned = list.find(m => m.pinned);
        if (pinned) setPinnedMsg(pinned);
      });
      return () => unsub && unsub();
    } else {
      setMessages([
        { id: "1", senderId: "demo", senderName: "Admin", text: `Welcome to ${group.name}! 🎉`, ts: Date.now() - 300000 },
        { id: "2", senderId: currentUser.uid, senderName: currentUser.name, text: "Hello everyone!", ts: Date.now() - 60000 },
      ]);
    }
  }, [group?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    const msgData = {
      senderId: currentUser.uid,
      senderName: currentUser.name,
      text: text.trim(),
      ts: Date.now(),
      pinned: false,
    };
    if (window.firebase_ref && window.firebase_set && window.firebase_update && window._firebaseDB) {
      const key = Date.now().toString();
      await window.firebase_set(window.firebase_ref(window._firebaseDB, `groupMessages/${group.id}/${key}`), msgData);
      await window.firebase_update(window.firebase_ref(window._firebaseDB, `groups/${group.id}`), {
        lastMessage: text.trim().slice(0, 40),
        lastTs: Date.now(),
      });
    } else {
      const id = Date.now().toString();
      setMessages(prev => [...prev, { id, ...msgData }]);
    }
    setText("");
    setSending(false);
  };

  const deleteMsg = async (msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    if (window.firebase_ref && window.firebase_set && window._firebaseDB)
      window.firebase_set(window.firebase_ref(window._firebaseDB, `groupMessages/${group.id}/${msgId}`), null);
  };

  const pinMsg = async (msgId) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const newPinned = !msg.pinned;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pinned: newPinned } : { ...m, pinned: false }));
    setPinnedMsg(newPinned ? msg : null);
    if (window.firebase_ref && window.firebase_update && window._firebaseDB)
      window.firebase_update(window.firebase_ref(window._firebaseDB, `groupMessages/${group.id}/${msgId}`), { pinned: newPinned });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20, padding: "4px 8px", display: "flex", alignItems: "center" }}>←</button>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: group.type === "channel" ? `linear-gradient(135deg, ${C.orange}, ${C.gold})` : `linear-gradient(135deg, ${C.purple}, ${C.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          {group.type === "channel" ? "📢" : "👥"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>{group.name}</div>
          <div style={{ color: C.muted, fontSize: 11 }}>
            {group.type === "channel" ? `📢 Channel · ${isMemberCount} subscribers` : `👥 ${isMemberCount} members`}
          </div>
        </div>
        <button onClick={onSettingsOpen} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", color: C.text, cursor: "pointer", fontSize: 14 }}>⚙️</button>
      </div>

      {/* Pinned Message */}
      {pinnedMsg && (
        <div style={{ padding: "8px 16px", background: C.accentDim, borderBottom: `1px solid ${C.accent}22`, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.accent }}>📌</span>
          <div style={{ flex: 1, fontSize: 12, color: C.text }}>
            <span style={{ color: C.accent, fontWeight: 700 }}>Pinned: </span>
            {(pinnedMsg.text || "").slice(0, 60)}{pinnedMsg.text?.length > 60 ? "…" : ""}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: C.muted, marginTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{group.type === "channel" ? "📢" : "👥"}</div>
            <div style={{ fontWeight: 700, color: C.text, fontSize: 16 }}>{group.name}</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>{group.description || (group.type === "channel" ? "Channel created" : "Group created")}</div>
          </div>
        )}
        {messages.map(msg => (
          <GrpBubble key={msg.id} msg={msg} isMe={msg.senderId === currentUser.uid} isAdmin={isAdmin} onDelete={deleteMsg} onPin={pinMsg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {canSend ? (
        <div style={{ padding: "10px 12px", background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", opacity: 0.7 }}>📎</button>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder={group.type === "channel" ? "Broadcast a message..." : "Message..."}
            style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "10px 16px", color: C.text, fontSize: 14, outline: "none" }} />
          <button onClick={send} disabled={!text.trim() || sending}
            style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: text.trim() ? `linear-gradient(135deg,${C.accent},#0066ff)` : C.dim, color: text.trim() ? "#000" : C.muted, cursor: text.trim() ? "pointer" : "default", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {sending ? "⏳" : "➤"}
          </button>
        </div>
      ) : (
        <div style={{ padding: "14px", background: C.surface, borderTop: `1px solid ${C.border}`, textAlign: "center", color: C.muted, fontSize: 13 }}>
          📢 Only admins can send messages in this channel
        </div>
      )}
    </div>
  );
}

// ─── Groups/Channels List ──────────────────────────────────────────────────────
function GroupList({ groups, activeId, onSelect, onCreateGroup, onCreateChannel }) {
  const [search, setSearch] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const filtered = groups.filter(g => (g.name || "").toLowerCase().includes(search.toLowerCase()));
  const chats = filtered.filter(g => g.type !== "channel");
  const channels = filtered.filter(g => g.type === "channel");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.surface, borderRight: `1px solid ${C.border}` }}>
      <div style={{ padding: "16px 16px 8px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: C.text }}>
            🌐 <span style={{ color: C.purple }}>Communities</span>
          </div>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowMenu(p => !p)} style={{ background: C.accentDim, border: `1px solid ${C.accent}44`, color: C.accent, borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontWeight: 800, fontSize: 18 }}>+</button>
            {showMenu && (
              <div style={{ position: "absolute", right: 0, top: "110%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 8, zIndex: 20, minWidth: 160, boxShadow: "0 8px 32px #00000088" }}>
                <button onClick={() => { onCreateGroup(); setShowMenu(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", color: C.text, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
                  👥 New Group
                </button>
                <button onClick={() => { onCreateChannel(); setShowMenu(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", color: C.text, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
                  📢 New Channel
                </button>
              </div>
            )}
          </div>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search groups & channels..."
          style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "9px 14px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {groups.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌐</div>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>No groups yet</div>
            <div style={{ fontSize: 13 }}>Create a group or channel with the + button</div>
          </div>
        )}

        {channels.length > 0 && (
          <>
            <div style={{ padding: "10px 16px 4px", color: C.muted, fontSize: 10, fontWeight: 800, letterSpacing: 2 }}>CHANNELS</div>
            {channels.map(g => <GroupItem key={g.id} group={g} active={activeId === g.id} onClick={() => onSelect(g)} />)}
          </>
        )}
        {chats.length > 0 && (
          <>
            <div style={{ padding: "10px 16px 4px", color: C.muted, fontSize: 10, fontWeight: 800, letterSpacing: 2 }}>GROUPS</div>
            {chats.map(g => <GroupItem key={g.id} group={g} active={activeId === g.id} onClick={() => onSelect(g)} />)}
          </>
        )}
      </div>
    </div>
  );
}

function GroupItem({ group, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
      cursor: "pointer", transition: "background 0.15s",
      background: active ? C.purpleDim : "transparent",
      borderLeft: active ? `3px solid ${C.purple}` : "3px solid transparent",
      borderBottom: `1px solid ${C.border}22`,
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = `${C.purple}08`; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: group.type === "channel" ? `linear-gradient(135deg,${C.orange},${C.gold})` : `linear-gradient(135deg,${C.purple},${C.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
        {group.type === "channel" ? "📢" : "👥"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{group.name}</div>
          <div style={{ fontSize: 10, color: C.muted }}>{formatTime(group.lastTs)}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
            {group.lastMessage || group.description || (group.type === "channel" ? "Channel" : "Group")}
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>{Object.keys(group.members || {}).length} 👥</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Groups Screen Export ─────────────────────────────────────────────────
export default function GroupsScreen({ currentUser, lang = "en", allUsers = [] }) {
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [showCreate, setShowCreate] = useState(null); // "group" | "channel" | null
  const [showSettings, setShowSettings] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    if (window.firebase_ref && window.firebase_onValue && window._firebaseDB) {
      const ref = window.firebase_ref(window._firebaseDB, "groups");
      const unsub = window.firebase_onValue(ref, snap => {
        const data = snap.val() || {};
        const myGroups = Object.values(data).filter(g =>
          g.members && (g.members[currentUser.uid] || currentUser.isAdmin)
        ).sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
        setGroups(myGroups);
      });
      return () => unsub && unsub();
    } else {
      setGroups([
        { id: "demo_ch1", type: "channel", name: "Announcements", description: "Official announcements", members: { [currentUser.uid]: "member" }, ownerId: currentUser.uid, admins: [currentUser.uid], lastMessage: "Welcome to NexTalk!", lastTs: Date.now() - 3600000 },
        { id: "demo_g1", type: "group", name: "Dev Team", description: "Development team chat", members: { [currentUser.uid]: "owner" }, ownerId: currentUser.uid, admins: [currentUser.uid], lastMessage: "Shipped v2! 🚀", lastTs: Date.now() - 900000 },
        { id: "demo_g2", type: "group", name: "General", description: "General discussion", members: { [currentUser.uid]: "member" }, ownerId: "demo", admins: ["demo"], lastMessage: "Hey everyone!", lastTs: Date.now() - 7200000 },
      ]);
    }
  }, [currentUser.uid]);

  const handleCreate = (groupData) => {
    setGroups(prev => [groupData, ...prev]);
    setActiveGroup(groupData);
  };

  const handleGroupUpdate = (updated) => {
    setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
    setActiveGroup(updated);
  };

  const handleGroupDelete = (gid) => {
    setGroups(prev => prev.filter(g => g.id !== gid));
    setActiveGroup(null);
  };

  const showList = !isMobile || !activeGroup;
  const showChat = !isMobile || activeGroup;

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      {showList && (
        <div style={{ width: isMobile ? "100%" : 320, flexShrink: 0, height: "100%" }}>
          <GroupList
            groups={groups}
            activeId={activeGroup?.id}
            onSelect={g => setActiveGroup(g)}
            onCreateGroup={() => setShowCreate("group")}
            onCreateChannel={() => setShowCreate("channel")}
          />
        </div>
      )}
      {showChat && (
        <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column" }}>
          {activeGroup ? (
            <GroupChatWindow
              group={activeGroup}
              currentUser={currentUser}
              onBack={() => setActiveGroup(null)}
              onSettingsOpen={() => setShowSettings(true)}
            />
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.muted, gap: 16 }}>
              <div style={{ fontSize: 60 }}>🌐</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Groups & Channels</div>
              <div style={{ fontSize: 13, textAlign: "center", maxWidth: 260 }}>Select a group or channel, or create a new one with the + button</div>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateGroupModal
          type={showCreate}
          currentUser={currentUser}
          users={allUsers}
          onClose={() => setShowCreate(null)}
          onCreate={handleCreate}
        />
      )}

      {showSettings && activeGroup && (
        <GroupSettingsModal
          group={activeGroup}
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
          onUpdate={handleGroupUpdate}
          onDelete={handleGroupDelete}
        />
      )}

      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px;}
        *{box-sizing:border-box;} input::placeholder{color:${C.muted};}
      `}</style>
    </div>
  );
}
