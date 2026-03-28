# ⚡ دليل البدء السريع - NexTalk Pro

<div dir="rtl">

## 🎯 الخطوات المطلوبة بالتفصيل الممل

---

## الخطوة 1️⃣: إعداد Firebase (5 دقائق)

### أ. إنشاء المشروع

1. افتح [Firebase Console](https://console.firebase.google.com/)
2. اضغط **"Add project"** (إضافة مشروع)
3. اسم المشروع: `nextalk-pro` (أو أي اسم تحبه)
4. اضغط **Continue**
5. Google Analytics: اختر **Enable** أو **Disable** (مش مهم)
6. اضغط **Create project**
7. انتظر 30 ثانية
8. اضغط **Continue**

### ب. تفعيل Phone Authentication

1. من القائمة الجانبية → **Build** → **Authentication**
2. اضغط **Get started**
3. في تبويب **Sign-in method**:
   - ابحث عن **Phone**
   - اضغط عليه
   - شغّل الزر الأزرق **Enable**
   - اضغط **Save**

### ج. إنشاء Realtime Database

1. من القائمة الجانبية → **Build** → **Realtime Database**
2. اضغط **Create Database**
3. Location: اختر أقرب موقع لك (مثلاً `europe-west1`)
4. Security rules: اختر **Start in test mode**
5. اضغط **Enable**

### د. الحصول على بيانات Firebase

1. من القائمة الجانبية → اضغط على ⚙️ (الترس) → **Project settings**
2. انزل تحت لقسم **Your apps**
3. اضغط على أيقونة **Web** (`</>`)
4. App nickname: `nextalk-web` (أي اسم)
5. **لا تفعّل** Firebase Hosting
6. اضغط **Register app**
7. **احفظ البيانات التالية:**

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "nextalk-xxxx.firebaseapp.com",
  projectId: "nextalk-xxxx",
  storageBucket: "nextalk-xxxx.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:xxxxxxxxxxxxx",
  measurementId: "G-XXXXXXXXXX",
  databaseURL: "https://nextalk-xxxx-default-rtdb.firebaseio.com"
};
```

8. احفظ هذه البيانات في ملف نصي على جهازك

---

## الخطوة 2️⃣: رفع المشروع على GitHub (3 دقائق)

### أ. إنشاء مستودع على GitHub

1. افتح [GitHub](https://github.com)
2. سجّل دخول (أو أنشئ حساب جديد)
3. اضغط على **+** في الأعلى → **New repository**
4. Repository name: `nextalk-app`
5. Description: `NexTalk - Modern Chat App with Admin Dashboard`
6. اختر **Private** (موصى به) أو **Public**
7. **لا تُفعّل** "Initialize this repository with:"
   - لا README ❌
   - لا .gitignore ❌
   - لا license ❌
8. اضغط **Create repository**
9. **احفظ رابط المستودع** (مثل: `https://github.com/ahmed123/nextalk-app.git`)

### ب. رفع الملفات (اكتب في Terminal/CMD)

**في Windows (CMD/PowerShell):**

```bash
# 1. افتح CMD في مجلد المشروع
cd C:\path\to\nextalk-fixed

# 2. هيّئ Git
git init

# 3. أضف جميع الملفات
git add .

# 4. اعمل Commit
git commit -m "Initial commit - NexTalk Pro"

# 5. اربط بـ GitHub (استبدل الرابط برابطك)
git remote add origin https://github.com/YOUR_USERNAME/nextalk-app.git

# 6. ارفع الملفات
git branch -M main
git push -u origin main
```

**في Mac/Linux (Terminal):**

```bash
# 1. افتح Terminal في مجلد المشروع
cd /path/to/nextalk-fixed

# 2-6: نفس الأوامر أعلاه
```

**مثال عملي:**
```bash
git remote add origin https://github.com/ahmed123/nextalk-app.git
git branch -M main
git push -u origin main
```

**ملحوظة:** لو طلب username وpassword:
- Username: اسم المستخدم في GitHub
- Password: استخدم **Personal Access Token** من GitHub Settings → Developer settings → Personal access tokens

---

## الخطوة 3️⃣: النشر على Vercel (5 دقائق)

### أ. إنشاء حساب Vercel

1. افتح [Vercel](https://vercel.com)
2. اضغط **Sign Up**
3. اختر **Continue with GitHub**
4. سجّل دخول بحساب GitHub
5. اسمح لـ Vercel بالوصول

### ب. استيراد المشروع

1. في لوحة تحكم Vercel، اضغط **Add New...** → **Project**
2. ستظهر قائمة مستودعات GitHub
3. ابحث عن `nextalk-app`
4. اضغط **Import** بجانبه

### ج. إعداد المشروع

1. **Project Name**: `nextalk-pro` (أو أي اسم)
2. **Framework Preset**: سيختار **Vite** تلقائياً ✅
3. **Root Directory**: `./` (افتراضي)
4. **Build Settings**: اتركها كما هي
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### د. إضافة متغيرات البيئة ⚠️ **خطوة مهمة جداً**

1. اضغط على **Environment Variables**
2. أضف المتغيرات التالية **واحدة واحدة**:

**انسخ من بيانات Firebase اللي حفظتها:**

| Name (الاسم) | Value (القيمة) |
|---------------|----------------|
| `VITE_FIREBASE_API_KEY` | انسخ `apiKey` من Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | انسخ `authDomain` من Firebase |
| `VITE_FIREBASE_PROJECT_ID` | انسخ `projectId` من Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | انسخ `storageBucket` من Firebase |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | انسخ `messagingSenderId` من Firebase |
| `VITE_FIREBASE_APP_ID` | انسخ `appId` من Firebase |
| `VITE_FIREBASE_MEASUREMENT_ID` | انسخ `measurementId` من Firebase |
| `VITE_FIREBASE_DATABASE_URL` | انسخ `databaseURL` من Firebase |

**مثال عملي:**
- Name: `VITE_FIREBASE_API_KEY`
- Value: `AIzaSyApF9k0_crAuhRhD5FbBWPNm_Q0JDENB-0`
- اضغط **Add**

**كرر لكل متغير من الـ 8 متغيرات أعلاه**

### هـ. النشر

1. بعد إضافة جميع المتغيرات (8 متغيرات)
2. اضغط **Deploy** (زر أزرق كبير)
3. انتظر 1-3 دقائق (سترى شاشة التحميل)
4. عند الانتهاء ستظهر 🎉 **Congratulations**
5. اضغط **Visit** لفتح التطبيق
6. **احفظ الرابط** (مثل: `https://nextalk-pro.vercel.app`)

---

## الخطوة 4️⃣: إضافة Domain في Firebase

### ⚠️ **مهم جداً - بدون هذه الخطوة لن يعمل التطبيق**

1. ارجع لـ [Firebase Console](https://console.firebase.google.com)
2. اختر مشروعك
3. من القائمة → **Authentication** → **Settings** (تبويب)
4. انزل لـ **Authorized domains**
5. اضغط **Add domain**
6. الصق رابط Vercel بدون `https://` (مثل: `nextalk-pro.vercel.app`)
7. اضغط **Add**

---

## الخطوة 5️⃣: تعديل رقم المسؤول

### للحصول على صلاحيات الـ Admin

**الطريقة 1: تعديل الكود (قبل النشر)**

1. افتح `src/nextalk-app-v2.jsx`
2. اذهب للسطر 596
3. غيّر الرقم:

```javascript
// قبل:
isAdmin: phone === "1128381838" || phone === "01128381838",

// بعد (ضع رقمك):
isAdmin: phone === "YOUR_PHONE_NUMBER",
```

مثال:
```javascript
isAdmin: phone === "01012345678" || phone === "1012345678",
```

4. احفظ الملف
5. ارفع التحديث:

```bash
git add .
git commit -m "Update admin phone number"
git push
```

6. Vercel سيعيد النشر تلقائياً (1-2 دقيقة)

**الطريقة 2: بعد التسجيل**

1. سجّل دخول بأي رقم
2. سيكون حسابك عادي (User)
3. سيحتاج admin آخر لترقيتك من لوحة التحكم

---

## الخطوة 6️⃣: الاختبار

1. افتح الرابط من Vercel: `https://nextalk-pro.vercel.app`
2. اختر اللغة (عربي/إنجليزي/فرنسي...)
3. أدخل رقم الهاتف (رقم حقيقي يصلك عليه SMS)
4. أدخل كود التحقق
5. أدخل اسمك واسم المستخدم
6. **إذا كان رقمك هو رقم الـ Admin:** ستظهر لك لوحة التحكم مباشرة! 🎉
7. **إذا كنت مستخدم عادي:** ستظهر شاشة الدردشة

---

## 🎉 تمام! التطبيق يشتغل

### الروابط المهمة:

- **التطبيق المباشر:** `https://your-app.vercel.app`
- **GitHub Repo:** `https://github.com/your-username/nextalk-app`
- **Vercel Dashboard:** `https://vercel.com/dashboard`
- **Firebase Console:** `https://console.firebase.google.com`

---

## 🔄 للتحديثات المستقبلية

عندما تعدّل أي ملف في المشروع:

```bash
# 1. احفظ التعديلات
git add .

# 2. اعمل Commit
git commit -m "وصف التعديل"

# 3. ارفع على GitHub
git push

# 4. Vercel سيبني ويرفع تلقائياً! ✨
```

---

## ❓ لو حصلت مشكلة

### المشكلة: الموقع لا يفتح
✅ **الحل:**
- تحقق من Firebase Authorized Domains
- تحقق من Build Logs في Vercel

### المشكلة: لا يصل كود التحقق
✅ **الحل:**
- تحقق من تفعيل Phone Authentication
- تحقق من إضافة Domain في Firebase

### المشكلة: شاشة بيضاء فاضية
✅ **الحل:**
- افتح Console (F12)
- تحقق من متغيرات البيئة في Vercel

---

## 📞 تحتاج مساعدة؟

1. راجع ملف `README.md` الكامل
2. راجع `VERCEL_DEPLOY.md` للتفاصيل
3. افتح Console في المتصفح (F12) وشوف الأخطاء
4. راجع Build Logs في Vercel

---

**🎊 بالتوفيق! التطبيق جاهز للاستخدام**

</div>
