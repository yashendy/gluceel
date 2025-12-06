// js/auth.js
import { supabase } from './supabase-config.js';

// عناصر الواجهة
const loginForm = document.getElementById('loginForm');
const regForm = document.getElementById('registerForm');
const logoutBtn = document.getElementById('logoutBtn');
const toastEl = document.getElementById('toast');

// دالة عرض الرسائل
const showToast = (msg, isError = false) => {
  if (!toastEl) { alert(msg); return; }
  toastEl.textContent = msg;
  toastEl.style.backgroundColor = isError ? '#dc3545' : '#198754'; // أحمر للخطأ، أخضر للنجاح
  toastEl.style.color = '#fff';
  toastEl.style.padding = '10px';
  toastEl.style.borderRadius = '6px';
  toastEl.style.display = 'block';
  setTimeout(() => toastEl.style.display = 'none', 3000);
};

// تحقق من البريد
const isValidEmail = (value) => /.+@.+\..+/.test((value || '').trim());

// التوجيه حسب الدور
function routeByRole(role, status) {
  // لو الحساب لسه معلق (Pending)
  if (status === 'pending') {
    document.body.innerHTML = `
        <div style="text-align:center; margin-top:50px; font-family:'Tajawal', sans-serif;">
            <h1>⏳ الحساب قيد المراجعة</h1>
            <p>تم تسجيل طلبك بنجاح. سيقوم المسؤول بتفعيل حساب الطبيب قريباً.</p>
            <a href="index.html" onclick="location.reload()">العودة</a>
        </div>
    `;
    supabase.auth.signOut();
    return;
  }

  // التوجيه الطبيعي
  switch ((role || '').toLowerCase()) {
    case 'admin':  location.replace('admin-doctors.html'); break;
    case 'doctor': location.replace('doctor-dashboard.html'); break;
    case 'parent': location.replace('parent.html'); break;
    default:       location.replace('index.html');
  }
}

/* ========== الوظائف الرئيسية ========== */

// 1. تسجيل حساب جديد (الكود اللي أنت اكتشفته + تعديلات)
async function handleSignUp(email, password, name, role) {
  try {
    // أ. التسجيل في Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });

    if (authError) throw authError;

    if (authData?.user) {
      console.log("تم التسجيل في Auth بنجاح، جاري الإضافة للجدول...", authData.user.id);

      // ب. الإضافة اليدوية في جدول users (الجزء المهم جداً)
      const { error: dbError } = await supabase.from('users').insert([
        {
          id: authData.user.id, // نأخذ نفس الـ ID
          email: email,
          name: name,
          role: role,
          status: role === 'doctor' ? 'pending' : 'active'
        }
      ]);

      if (dbError) {
        console.error("خطأ في قاعدة البيانات:", dbError);

        // رسائل توضيح أسرع حسب الخطأ
        const isTypeMismatch = dbError.message?.includes('uuid');
        const isRlsBlocked = dbError.message?.toLowerCase()?.includes('violates row-level security');
        const hint = isTypeMismatch
          ? 'تأكد أن عمود id في جدول users نوعه uuid ومربوط بـ auth.users.'
          : isRlsBlocked
            ? 'فعّل RLS وأضف سياسات insert/select/update بحيث id = auth.uid().'
            : 'راجع صلاحيات وسياسات جدول users في Supabase.';

        // لا يمكن حذف المستخدم من Auth باستخدام anon key، لذا نظهر التنبيه فقط
        showToast(`فشل حفظ بيانات الجدول: ${hint}`, true);
        return;
      }

      showToast('تم إنشاء الحساب بنجاح! جاري الدخول...');

      // انتظار بسيط ثم التحقق والتوجيه
      setTimeout(() => {
         checkAuth();
      }, 1500);
    }

  } catch (err) {
    console.error(err);
    showToast(`خطأ: ${err.message}`, true);
  }
}

// 2. تسجيل الدخول
async function handleLogin(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) throw error;

    showToast('تم تسجيل الدخول!');
    checkAuth(); // التوجيه

  } catch (err) {
    console.error(err);
    showToast('البريد الإلكتروني أو كلمة المرور غير صحيحة', true);
  }
}

// 3. التحقق من الجلسة والتوجيه
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    // نجيب بيانات المستخدم من الجدول عشان نعرف دوره
    const { data: user, error } = await supabase
      .from('users')
      .select('role, status, id')
      .eq('id', session.user.id)
      .single();

    if (user) {
      // حفظنا الـ ID في المتصفح
      sessionStorage.setItem('db_user_id', user.id);
      
      // التوجيه الذكي (عشان لو هو في صفحة صح مايعملش إعادة تحميل)
      const path = location.pathname;
      const isAuthPage = path.includes('index.html') || path.includes('register.html') || path === '/';
      
      if (isAuthPage) {
          routeByRole(user.role, user.status);
      }
    } else {
        console.warn("المستخدم مسجل دخول لكن غير موجود في الجدول!");
    }
  }
}

/* ========== تفعيل الأزرار (Event Listeners) ========== */

// زر التسجيل
if (regForm) {
  regForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPassword').value;
    const roleEl = document.querySelector('input[name="role"]:checked');
    const role = roleEl ? roleEl.value : 'parent';

    if (!name) return showToast('من فضلك أدخل الاسم الكامل.', true);
    if (!isValidEmail(email)) return showToast('البريد الإلكتروني غير صحيح.', true);
    if (!pass || pass.length < 6) return showToast('كلمة السر يجب أن تكون 6 أحرف على الأقل.', true);

    handleSignUp(email, pass, name, role);
  });
}

// زر الدخول
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;

    if (!isValidEmail(email)) return showToast('اكتب بريدًا إلكترونيًا صالحًا.', true);
    if (!pass) return showToast('من فضلك أدخل كلمة السر.', true);

    handleLogin(email, pass);
  });
}

// زر الخروج (لو موجود في الصفحة)
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        sessionStorage.clear();
        window.location.href = 'index.html';
    });
}

// تشغيل التحقق عند فتح الصفحة
checkAuth();
