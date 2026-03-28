# 🚀 دليل النشر على Vercel - خطوة بخطوة

<div dir="rtl">

## الطريقة الأولى: النشر عبر GitHub (الأسهل - موصى بها)

### الخطوة 1: إنشاء مستودع GitHub

1. اذهب إلى [GitHub](https://github.com)
2. اضغط على زر **"New"** لإنشاء مستودع جديد
3. أدخل اسم المستودع (مثلاً: `nextalk-app`)
4. اختر **Private** أو **Public**
5. **لا تُنشئ** README أو .gitignore أو LICENSE
6. اضغط **"Create repository"**

### الخطوة 2: رفع المشروع على GitHub

افتح Terminal/CMD في مجلد المشروع واكتب:

</div>

```bash
# 1. تهيئة Git
git init

# 2. إضافة جميع الملفات
git add .

# 3. عمل Commit أول
git commit -m "Initial commit - NexTalk Pro"

# 4. ربط المستودع (استبدل YOUR_USERNAME و REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# 5. رفع الملفات
git branch -M main
git push -u origin main
```

<div dir="rtl">

**مثال عملي:**
</div>

```bash
git remote add origin https://github.com/ahmed123/nextalk-app.git
git branch -M main
git push -u origin main
```

<div dir="rtl">

### الخطوة 3: إعداد Vercel

1. اذهب إلى [Vercel](https://vercel.com)
2. اضغط **"Sign Up"** إذا لم يكن لديك حساب
3. سجّل دخول باستخدام حساب GitHub الخاص بك
4. اضغط على **"Add New..."** → **"Project"**

### الخطوة 4: استيراد المشروع

1. ستظهر قائمة بمستودعات GitHub الخاصة بك
2. ابحث عن `nextalk-app` (أو الاسم الذي اخترته)
3. اضغط **"Import"**

### الخطوة 5: إعداد المشروع

1. **Project Name**: اتركه كما هو أو غيّره
2. **Framework Preset**: اختر **Vite** (سيتم اختياره تلقائياً)
3. **Root Directory**: اتركه `./`
4. **Build Command**: `npm run build` (افتراضي)
5. **Output Directory**: `dist` (افتراضي)
6. **Install Command**: `npm install` (افتراضي)

### الخطوة 6: إضافة متغيرات البيئة ⚠️ **مهم جداً**

اضغط على **"Environment Variables"** وأضف التالي:

| Name | Value |
|------|-------|
| `VITE_FIREBASE_API_KEY` | `AIzaSy...` (من Firebase) |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `your-project-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `123456789` |
| `VITE_FIREBASE_APP_ID` | `1:123:web:abc...` |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-XXXXXXXXXX` |
| `VITE_FIREBASE_DATABASE_URL` | `https://your-project-default-rtdb.firebaseio.com` |

**📝 ملاحظة:** انسخ القيم من ملف `.env.local` الخاص بك

### الخطوة 7: النشر

1. اضغط **"Deploy"**
2. انتظر حتى ينتهي Build (عادة 1-3 دقائق)
3. ستظهر رسالة **"Congratulations!"** 🎉
4. اضغط **"Visit"** لفتح التطبيق

### الخطوة 8: إعداد Domain (اختياري)

1. في لوحة تحكم Vercel، اذهب إلى **Settings** → **Domains**
2. أضف domain الخاص بك
3. اتبع التعليمات لربط الـ DNS

---

## الطريقة الثانية: النشر عبر Vercel CLI

</div>

```bash
# 1. تثبيت Vercel CLI عالمياً
npm install -g vercel

# 2. تسجيل الدخول
vercel login

# 3. النشر من مجلد المشروع
vercel

# اتبع التعليمات التفاعلية:
# - Set up and deploy? → Y
# - Which scope? → اختر حسابك
# - Link to existing project? → N
# - What's your project's name? → nextalk-pro
# - In which directory is your code located? → ./
# - Want to override settings? → N
```

<div dir="rtl">

### إضافة متغيرات البيئة عبر CLI

</div>

```bash
# أضف كل متغير على حدة
vercel env add VITE_FIREBASE_API_KEY

# أو استخدم ملف
vercel env pull .env.production
```

<div dir="rtl">

---

## إعداد Firebase للنشر

### 1. إضافة Domain في Firebase

1. اذهب إلى [Firebase Console](https://console.firebase.google.com)
2. اختر مشروعك
3. **Authentication** → **Settings** → **Authorized domains**
4. أضف domain Vercel الخاص بك (مثلاً: `nextalk-pro.vercel.app`)
5. احفظ

### 2. إعداد Realtime Database Rules

</div>

```json
{
  "rules": {
    "users": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$uid": {
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('isAdmin').val() === true"
      }
    },
    "messages": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "broadcasts": {
      ".read": "auth != null",
      ".write": "root.child('users').child(auth.uid).child('isAdmin').val() === true"
    },
    "notifications": {
      ".read": "auth != null",
      "$uid": {
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('isAdmin').val() === true"
      }
    }
  }
}
```

<div dir="rtl">

---

## التحديثات المستقبلية

### عند تعديل الكود

</div>

```bash
# 1. احفظ التغييرات
git add .
git commit -m "وصف التحديث"

# 2. ارفع على GitHub
git push

# 3. Vercel سيبني ويرفع تلقائياً! 🎉
```

<div dir="rtl">

### تحديث متغيرات البيئة

1. اذهب إلى Vercel Dashboard
2. اختر المشروع
3. **Settings** → **Environment Variables**
4. عدّل أو أضف متغيرات جديدة
5. **Redeploy** من **Deployments** tab

---

## استكشاف الأخطاء

### خطأ: "Build failed"

**الحل:**
1. تحقق من **Build Logs** في Vercel
2. تأكد من أن `package.json` صحيح
3. تحقق من متغيرات البيئة

### خطأ: "Firebase is not defined"

**الحل:**
- تأكد من إضافة جميع متغيرات Firebase في Vercel
- تحقق من أن الأسماء صحيحة (`VITE_` في البداية)

### خطأ: "Unauthorized domain"

**الحل:**
- أضف domain Vercel في Firebase Authorized domains

### الموقع لا يعمل بعد النشر

**الحل:**
</div>

```bash
# 1. تحقق من Build Logs
vercel logs

# 2. تحقق من متغيرات البيئة
vercel env ls

# 3. أعد النشر
vercel --prod
```

<div dir="rtl">

---

## نصائح Pro

1. ✅ **استخدم Git Branches**: أنشئ `dev` branch للتطوير و `main` للإنتاج
2. ✅ **Vercel Preview**: كل push يُنشئ preview URL للاختبار
3. ✅ **Environment Variables**: استخدم `Production` و `Preview` منفصلين
4. ✅ **Analytics**: فعّل Vercel Analytics لمراقبة الأداء
5. ✅ **Custom Domain**: استخدم domain خاص لمشروع احترافي

---

## سكريبتات مفيدة

### Deployment Script الكامل

</div>

```bash
#!/bin/bash

echo "🚀 Starting NexTalk Deployment..."

# Check if changes exist
if [[ -n $(git status -s) ]]; then
    echo "📝 Changes detected, committing..."
    git add .
    read -p "Enter commit message: " msg
    git commit -m "$msg"
    git push
    echo "✅ Pushed to GitHub. Vercel will auto-deploy!"
else
    echo "✨ No changes to commit"
fi

echo "🎉 Done!"
```

<div dir="rtl">

احفظه كـ `deploy.sh` واجعله قابل للتنفيذ:

</div>

```bash
chmod +x deploy.sh
./deploy.sh
```

<div dir="rtl">

---

## الخلاصة

### للنشر السريع (GitHub + Vercel):
1. ✅ ارفع على GitHub
2. ✅ استورد في Vercel
3. ✅ أضف متغيرات البيئة
4. ✅ اضغط Deploy
5. ✅ أضف domain في Firebase

### للتحديثات:
</div>

```bash
git add .
git commit -m "update"
git push
```

<div dir="rtl">

**تم! التطبيق الآن على الإنترنت** 🎉🚀

</div>
