import { supabase } from './supabase-config.js';

// عناصر سيتم ربطها بعد تحميل الصفحة
let loginForm;
let registerForm;
let toastEl;
let debugBox;

/** عرض رسالة للمستخدم */
function showToast(message, isError = false) {
  if (!toastEl) {
    alert(message);
    return;
  }
  toastEl.textContent = message;
  toastEl.style.display = 'block';
  toastEl.style.backgroundColor = isError ? '#dc3545' : '#198754';
  toastEl.style.color = '#fff';
  toastEl.style.padding = '10px';
  toastEl.style.borderRadius = '6px';

  setTimeout(() => {
    toastEl.style.display = 'none';
  }, 4000);
}

/** رسائل Debug بسيطة */
function showDebug(message) {
  if (!debugBox) return;

  if (!message) {
    debugBox.style.display = 'none';
    debugBox.textContent = '';
    return;
  }

  debugBox.style.display = 'block';
  debugBox.textContent = message;
}

/** فحص البريد */
function isValidEmail(value) {
  return /.+@.+\..+/.test((value || '').trim());
}

/** تأكد أن Supabase جاهز */
async function ensureSupabaseReady() {
  try {
    if (!supabase || !supabase.auth) {
      showToast('لم يتم تهيئة الاتصال بـ Supabase. تأكد من تحميل الملفات بشكل صحيح.', true);
      showDebug('Supabase client غير مهيأ – تأكدي من مسار ملفات js/ واستخدام type="module".');
      return false;
    }

    const { error } = await supabase.auth.getSettings();
    if (error) throw error;

    return true;
  } catch (err) {
    showToast('تعذر الاتصال بـ Supabase. راجعي إعدادات المشروع.', true);
    showDebug(`Supabase error: ${err.message}`);
    return false;
  }
}

/** التوجيه حسب الدور والحالة */
function routeByRole(role, status) {
  const r = (role || '').toLowerCase();

  if (status === 'pending') {
    // حساب في انتظار موافقة الأدمن (مثلاً دكتور جديد)
    document.body.innerHTML = `
      <div style="text-align:center; margin-top:50px; font-family:'Tajawal', sans-serif;">
        <h1>⏳ الحساب قيد المراجعة</h1>
        <p>تم تسجيل طلبك بنجاح. سيقوم المسؤول بتفعيل حسابك قريباً.</p>
        <a href="index.html">العودة لصفحة الدخول</a>
      </div>
    `;
    supabase.auth.signOut();
    return;
  }

  switch (r) {
    case 'admin':
      window.location.replace('admin-doctors.html');
      break;
    case 'doctor':
      window.location.replace('doctor-dashboard.html');
      break;
    case 'parent':
      window.location.replace('parent.html');
      break;
    default:
      window.location.replace('index.html');
      break;
  }
}

/** تسجيل مستخدم جديد (ولي أمر أو دكتور) */
async function handleRegister(event) {
  event.preventDefault();
  showDebug('');

  const nameInput =
    registerForm.querySelector('#regName') ||
    registerForm.querySelector('input[name="fullName"]');
  const emailInput =
    registerForm.querySelector('#regEmail') ||
    registerForm.querySelector('input[type="email"]');
  const passwordInput =
    registerForm.querySelector('#regPassword') ||
    registerForm.querySelector('input[type="password"]');
  const roleInput =
    registerForm.querySelector('input[name="role"]:checked') ||
    registerForm.querySelector('select[name="role"]');

  const name = (nameInput?.value || '').trim();
  const email = (emailInput?.value || '').trim();
  const password = passwordInput?.value || '';
  let role = (roleInput?.value || 'parent').toLowerCase();

  if (!name) {
    showToast('من فضلك أدخل الاسم الكامل.', true);
    return;
  }
  if (!isValidEmail(email)) {
    showToast('من فضلك أدخل بريدًا إلكترونيًا صحيحًا.', true);
    return;
  }
  if (!password || password.length < 6) {
    showToast('كلمة السر يجب ألا تقل عن 6 أحرف.', true);
    return;
  }
  if (role !== 'parent' && role !== 'doctor') {
    // أمان إضافي – الأدمن لا يتم من الواجهة
    role = 'parent';
  }

  const ready = await ensureSupabaseReady();
  if (!ready) return;

  try {
    // إنشاء الحساب في Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, role },
      },
    });

    if (signUpError) {
      showToast('تعذر إنشاء الحساب. حاول مرة أخرى.', true);
      showDebug(`signUp error: ${signUpError.message}`);
      return;
    }

    let session = signUpData.session || null;
    let user = signUpData.user || null;

    // لو تأكيد البريد مفعّل، مش هيكون فيه session
    if (!session || !user) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        showToast('تم إنشاء الحساب، لكن تعذر تسجيل الدخول تلقائيًا. جرّبي الدخول يدويًا.', true);
        showDebug(`signin after signup error: ${signInError.message}`);
        return;
      }

      session = signInData.session;
      user = signInData.user;
    }

    if (!user) {
      showToast('تم إنشاء الحساب ولكن لم نستطع قراءة بيانات المستخدم.', true);
      showDebug('No user object after signup/signin.');
      return;
    }

    const status = role === 'doctor' ? 'pending' : 'active';

    // إنشاء/تحديث صف في جدول users
    const { error: profileError } = await supabase.from('users').upsert(
      {
        id: user.id,
        email: user.email,
        name,
        role,
        status,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      // مش هنمنع المستخدم من المتابعة، لكن نعرض Debug
      showDebug(`users upsert error: ${profileError.message}`);
    }

    showToast('تم إنشاء الحساب بنجاح 🎉');
    routeByRole(role, status);
  } catch (err) {
    showToast('حدث خطأ غير متوقع أثناء إنشاء الحساب.', true);
    showDebug(`handleRegister error: ${err.message}`);
  }
}

/** تسجيل الدخول */
async function handleLogin(event) {
  event.preventDefault();
  showDebug('');

  const emailInput =
    loginForm.querySelector('#loginEmail') ||
    loginForm.querySelector('input[type="email"]');
  const passwordInput =
    loginForm.querySelector('#loginPassword') ||
    loginForm.querySelector('input[type="password"]');

  const email = (emailInput?.value || '').trim();
  const password = passwordInput?.value || '';

  if (!isValidEmail(email)) {
    showToast('من فضلك أدخل بريدًا إلكترونيًا صحيحًا.', true);
    return;
  }
  if (!password) {
    showToast('من فضلك أدخل كلمة السر.', true);
    return;
  }

  const ready = await ensureSupabaseReady();
  if (!ready) return;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showToast('بيانات الدخول غير صحيحة أو الحساب غير مفعّل.', true);
      showDebug(`signIn error: ${error.message}`);
      return;
    }

    const user = data.user;
    if (!user) {
      showToast('لم نستطع قراءة بيانات المستخدم.', true);
      showDebug('No user returned from signInWithPassword.');
      return;
    }

    // قراءة الدور والحالة من جدول users
    let role = 'parent';
    let status = 'active';

    const { data: row, error: profileError } = await supabase
      .from('users')
      .select('role,status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      showDebug(`users select error: ${profileError.message}`);
    } else if (row) {
      role = row.role || role;
      status = row.status || status;
    }

    showToast('تم تسجيل الدخول بنجاح ✅');
    routeByRole(role, status);
  } catch (err) {
    showToast('حدث خطأ غير متوقع أثناء تسجيل الدخول.', true);
    showDebug(`handleLogin error: ${err.message}`);
  }
}

/** تهيئة الربط مع الفورمات عند تحميل الصفحة */
function initAuth() {
  loginForm = document.getElementById('loginForm');
  registerForm = document.getElementById('registerForm');
  toastEl =
    document.getElementById('toast') ||
    document.querySelector('.toast-message') ||
    document.querySelector('[data-toast]');
  debugBox =
    document.getElementById('debugInfo') ||
    document.getElementById('debugBox') ||
    document.querySelector('[data-debug]');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
}

// نشتغل بعد تحميل الـ DOM
document.addEventListener('DOMContentLoaded', initAuth);
