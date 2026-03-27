# 💬 NexTalk v2.0

> The Next Generation Messenger — Admin Dashboard

## ✨ What's New in v2.0

- 🌍 **Multi-language support** — 18 languages selectable at login
- 🔐 **Advanced Security** — TOTP 2FA, Device Fingerprinting, Rate Limiting
- 📱 **Session Management** — View and revoke active sessions
- 🔑 **Backup Codes** — 8 one-time recovery codes
- 🎨 **New Design** — Darker, more polished UI with glow effects
- 📊 **Better Dashboard** — Collapsible sidebar, live clock, quick-links

## 📁 Project Structure

```
nextalk/
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── .gitignore
└── src/
    ├── main.jsx               ← Entry point
    ├── nextalk-app-v2.jsx     ← Main app + Login + Language Picker
    ├── nextalk-dashboard-v2.jsx ← Admin Dashboard
    ├── i18n.js                ← 18 languages translations
    └── security.js            ← 2FA, Sessions, Rate Limiting, Fingerprint
```

## 🚀 Deploy to GitHub + Vercel

### Step 1: Create GitHub Repo

```bash
# On your machine:
git init
git add .
git commit -m "NexTalk v2.0 - Multi-language + Advanced Security"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nextalk.git
git push -u origin main
```

### Step 2: Deploy to Vercel

**Option A — Via Website (Easiest):**
1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **"Add New Project"**
3. Select your `nextalk` repo
4. Framework: **Vite**
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Click **Deploy** ✅

**Option B — Via CLI:**
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Step 3: Environment (Optional)
If you want to hide your Firebase keys, create `.env.local`:
```
VITE_FIREBASE_API_KEY=your_key_here
VITE_FIREBASE_PROJECT_ID=nextalk-4ef19
```
Then in `nextalk-app-v2.jsx`, replace hardcoded values with:
```js
apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
```

## 🔒 Security Features

| Feature | Details |
|---|---|
| OTP Login | Firebase Phone Auth + reCAPTCHA |
| Rate Limiting | 5 attempts / 15 min per phone |
| 2FA TOTP | RFC 6238 — works with Google Authenticator, Authy |
| Backup Codes | 8 one-time codes generated on 2FA setup |
| Device Fingerprint | Canvas + WebGL + Screen + Timezone hash |
| Session Management | View & revoke sessions by device |

## 🌍 Supported Languages

Arabic · English · French · German · Spanish · Russian · Chinese · Turkish · Italian · Portuguese · Korean · Japanese · Hindi · Indonesian · Dutch · Polish · Persian · Urdu

## 📱 Admin Access

Phone number `1128381838` or `01128381838` gets auto-assigned admin role.

---
Made with ❤️ — NexTalk v2.0
