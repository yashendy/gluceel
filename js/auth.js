// js/auth.js
import { supabase } from './supabase-config.js';

/* ========== عناصر الواجهة ========== */
const loginForm = document.getElementById('loginForm');
const regForm   = document.getElementById('registerForm');
const toastEl   = document.getElementById('toast');

/* ========== أدوات مساعدة ========== */
const showToast = (msg, isError = false) => {
  if (!toastEl) { alert(msg); return; }
  toastEl.textContent = msg;
  toastEl.style.backgroundColor = isError ? '#e53e3e' : '#333'; // أحمر للخطأ
  toastEl.style.display = 'block'; // تأكدنا من إظهاره
  setTimeout(() => toastEl.style.display = 'none', 4000);
};

// التوجيه حسب الدور والحالة
function routeByRole(role, status) {
  // 1. لو الحساب لسه معلق (pending)
  if (status === 'pending') {
    // ممكن توجهه لصفحة انتظار أو تظهر رسالة وتعمل خروج
    document.body.innerHTML = `
      <div style="text-align:center; padding:50px; font-family:'Tajawal',sans-serif;">
        <h1>⏳ الحساب قيد المراجعة</h1>
        <p>شكراً لتسجيلك يا دكتور. سيقوم المسؤول بمراجعة بياناتك وتفعيل الحساب قريباً.</p>
        <a href="index.html" onclick="sessionStorage.clear()">العودة للرئيسية</a>
      </div>
    `;
    supabase.auth.signOut(); // تسجيل خروج عشان ما يفضلش معلق
    return;
  }

  // 2. التوجيه الطبيعي للحسابات المفعلة
  switch ((role || '').toLowerCase()) {
    case 'admin':  location.replace('admin-doctors.html'); break;
    case 'doctor': location.replace('doctor-dashboard.html'); break;
    case 'parent': location.replace('parent.html'); break;
    default:       location.replace('index.html');
  }
}

/* ========== الوظائف الرئيسية ========== */

// 1. تسجيل مستخدم جديد
async function handleSignUp(email, password, name, role) {
  try {
    // تحديد الحالة المبدئية: الطبيب = pending، الولي = active
    const initialStatus = (role === 'doctor') ? 'pending' : 'active';

    // أ. إنشاء الحساب في Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });

    if (authError) throw authError;

    // ب. إدخال البيانات في جدول users
    const { error: dbError } = await supabase.from('users').insert([
      {
        email: email,
        name: name,
        role: role, 
        auth_id: authData.user.id,
        status: initialStatus, // تسجيل الحالة
        is_active: true
      }
    ]);

    if (dbError) {
      console.error('DB Insert Error:', dbError);
      throw new Error('فشل في حفظ بيانات المستخدم الشخصية.');
    }

    showToast('تم إنشاء الحساب بنجاح! جاري التوجيه...');
    
    // توجيه بناءً على الحالة
    setTimeout(() => routeByRole(role, initialStatus), 1500);

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

    // جلب بيانات الدور والحالة من جدول users
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role, id, status')
      .eq('auth_id', data.user.id)
      .single();

    if (profileError || !userProfile) throw new Error('لم يتم العثور على بيانات المستخدم');

    sessionStorage.setItem('db_user_id', userProfile.id);

    showToast('تم تسجيل الدخول ✅');
    routeByRole(userProfile.role, userProfile.status);

  } catch (err) {
    console.error(err);
    showToast('البريد أو كلمة المرور غير صحيحة', true);
  }
}

/* ========== تفعيل النماذج ========== */

if (regForm) {
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPassword').value;
    const roleEl = document.querySelector('input[name="role"]:checked');
    const role = roleEl ? roleEl.value : 'parent';
    
    await handleSignUp(email, pass, name, role);
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    await handleLogin(email, pass);
  });
}

// التحقق عند فتح الصفحة (لو المستخدم عامل login من قبل)
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  const isAuthPage = /login\.html|register\.html|index\.html/.test(location.pathname);
  
  if (session && isAuthPage) {
     const { data: user } = await supabase
       .from('users')
       .select('role, status')
       .eq('auth_id', session.user.id)
       .single();
     
     if(user) routeByRole(user.role, user.status);
  }
}

checkAuth();
