# Gluceel Frontend

واجهات HTML بسيطة للاشتراك وتسجيل الدخول مع Supabase.

## جدول Supabase `users` باختصار (بالعربي)
قبل ما تشغّل التسجيل/الدخول من الصفحات، تأكد أن جدول `users` مضبوط عشان الـ Auth يخزن الـ UUID الصحيح بدل أرقام عشوائية.

### أنواع الأعمدة المطلوبة
| العمود | النوع | ملاحظات |
| --- | --- | --- |
| `id` | `uuid` | لازم يطابق User ID اللي Supabase Auth بيرجعه؛ خليه Primary Key و`not null`. |
| `email` | `text` | يفضل يكون `not null` و`unique` لتجنب التكرار. |
| `name` | `text` | اسم عرض اختياري. |
| `role` | `text` | افتراضيًا `user` لو مش محتاج أدوار إضافية. |
| `status` | `text` | حالات مثل `active` / `pending` / `disabled`. |
| `created_at` | `timestamp with time zone` | خلي الـ Default `now()` عشان الصف يضاف تلقائيًا.

> لو الـ `id` عندك حاليًا رقم أو `text` بدل `uuid`:
> 1. من Table editor في Supabase غيّر نوع العمود لـ `uuid`.
> 2. اربطه بـ Auth عن طريق Foreign Key على `auth.users(id)`.
> 3. لو فيه بيانات قديمة، حدّثها بالـ UUID الصحيح لكل مستخدم (من جدول Auth أو بالـ API).

### سياسات Row Level Security (RLS)
فعّل RLS على جدول `users` وأضاف سياسات واضحة:
- **Select:** المستخدم يشوف صفه بس (`id = auth.uid()`).
- **Insert:** المستخدم يضيف صف لنفسه بس (`id = auth.uid()`).
- **Update:** المستخدم يعدّل صفه بس.

لو عندك دور مدير (admin) مبني على Claim في الـ JWT، أضف سياسة منفصلة تسمح له بالوصول الأشمل.

### خطوات التحقق السريعة
1. افتح جدول `users` وتأكد الأنواع زي الجدول اللي فوق وخصوصًا إن `id` = `uuid`.
2. تأكد RLS مفعّل وفيه سياسات select/insert/update زي المذكور.
3. بعد الحفظ، جرّب التسجيل/الدخول من `index.html` و`register.html` وشوف إن المستخدم الجديد بيتخزن بـ UUID صح في `users`.
