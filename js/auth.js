import { supabase } from './supabase-config.js';

// عناصر الواجهة
const loginForm = document.getElementById('loginForm');
const regForm = document.getElementById('registerForm');
const toastEl = document.getElementById('toast');

// دالة عرض الرسائل
const showToast = (msg, isError = false) => {
  if (!toastEl) { alert(msg); return; }
  toastEl.textContent = msg;
  toastEl.style.backgroundColor = isError ? '#dc3545' : '#198754';
  toastEl.style.display = 'block';
  setTimeout(() => toastEl.style.display = 'none', 3000);
};

// التوجيه
function routeByRole(role, status) {
  if (status === 'pending') {
    document.body.innerHTML = '<h1 style="text-align:center; margin-top:50px;">⏳ الحساب قيد المراجعة</h1>';
    supabase.auth.signOut();
    return;
  }
  switch (role) {
    case 'admin': location.replace('admin-doctors.html'); break;
    case 'doctor': location.replace('doctor-dashboard.html'); break;
    case 'parent': location.replace('parent.html'); break;
    default: location.replace('index.html');
  }
}

// 1. تسجيل حساب جديد (Sign Up)
async function handleSignUp(email, password, name, role) {
  try {
    // كل اللي بنعمله نبعت البيانات لـ Supabase Auth
    // والداتا بيس هتتصرف في الباقي (Trigger)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: role // بنبعت الدور هنا عشان التريجر يلقطه
        }
      }
    });

    if (error) throw error;

    showToast('تم إنشاء الحساب بنجاح! جاري الدخول...');
    
    // نستنى ثانية عشان التريجر يلحق يكتب البيانات في القاعدة
    setTimeout(async () => {
       await checkAuth(); // نعيد التحقق عشان نوجهه
    }, 1500);

  } catch (err) {
    console.error(err);
    showToast(err.message, true);
  }
}

// 2. تسجيل الدخول (Login)
async function handleLogin(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    showToast('تم تسجيل الدخول!');
    checkAuth(); // التوجيه يتم هنا

  } catch (err) {
    showToast('بيانات الدخول غير صحيحة', true);
  }
}

// 3. التحقق والتوجيه
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    // نجيب الدور من جدول public.users
    const { data: user, error } = await supabase
      .from('users')
      .select('role, status, id')
      .eq('auth_id', session.user.id)
      .single();

    if (user) {
      sessionStorage.setItem('db_user_id', user.id); // نحفظ الـ ID للاستخدام لاحقاً
      routeByRole(user.role, user.status);
    }
  }
}

// تفعيل الأزرار
if (regForm) {
  regForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const role = document.querySelector('input[name="role"]:checked')?.value || 'parent';
    handleSignUp(
      document.getElementById('regEmail').value,
      document.getElementById('regPassword').value,
      document.getElementById('regName').value,
      role
    );
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin(
      document.getElementById('loginEmail').value,
      document.getElementById('loginPassword').value
    );
  });
}
