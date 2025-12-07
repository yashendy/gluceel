import { supabase, supabaseUrl, supabaseAnonKey } from './supabase-config.js';

let loginForm = null;
let regForm = null;
let logoutBtn = null;
let toastEl = null;
let debugBox = null;

const showToast = (msg, isError = false) => {
  if (!toastEl) {
    alert(msg);
    return;
  }
  toastEl.textContent = msg;
  toastEl.style.backgroundColor = isError ? '#dc3545' : '#198754';
  toastEl.style.color = '#fff';
  toastEl.style.padding = '10px';
  toastEl.style.borderRadius = '6px';
  toastEl.style.display = 'block';
  setTimeout(() => (toastEl.style.display = 'none'), 3000);
};

const showDebug = (msg) => {
  if (!debugBox) return;
  if (!msg) {
    debugBox.style.display = 'none';
    debugBox.textContent = '';
    return;
  }
  debugBox.style.display = 'block';
  debugBox.textContent = msg;
};

const isValidEmail = (value) => /.+@.+\..+/.test((value || '').trim());

async function ensureSupabaseReady() {
  try {
    if (!supabase || !supabase.auth || typeof supabase.auth.getSettings !== 'function') {
      const maskedAnon = supabaseAnonKey
        ? `${supabaseAnonKey.slice(0, 6)}... (length ${supabaseAnonKey.length})`
        : 'مفقود';
      const configSnapshot = `Supabase URL: ${supabaseUrl || 'مفقود'} | anon key: ${maskedAnon} | origin: ${location.origin}`;

      showToast('لم يتم تهيئة عميل Supabase. تحقق من تحميل ملف التكوين.', true);
      showDebug(
        `Supabase client missing. تأكد من أن صفحة HTML تستورد js/supabase-config.js قبل js/auth.js عبر type="module" وبأن التحميل من شبكة عامة غير محظور.\n${configSnapshot}`
      );
      return false;
    }

    const { error } = await supabase.auth.getSettings();
    if (error) throw error;
    return true;
  } catch (err) {
    const maskedAnon = supabaseAnonKey ? `${supabaseAnonKey.slice(0, 6)}... (length ${supabaseAnonKey.length})` : 'مفقود';
    const configSnapshot = `Supabase URL: ${supabaseUrl || 'مفقود'} | anon key: ${maskedAnon} | origin: ${location.origin}`;
    const hint = err.message?.toLowerCase()?.includes('apikey')
      ? 'تأكد من وضع anon key الصحيح من لوحة Supabase.'
      : 'تأكد من صلاحية الـ URL و anon key وإتاحة الاتصال.';

    showToast('تعذر الاتصال بـ Supabase. راجع الإعدادات.', true);
    showDebug(`Supabase client error: ${err.message}. ${hint}\n${configSnapshot}\nتأكد من إعداد Site URL/Redirect في لوحة Auth للقيم الحقيقية للموقع، وتعطيل تأكيد البريد إذا أردت الدخول الفوري.`);
    return false;
  }
}

function routeByRole(role, status) {
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

  switch ((role || '').toLowerCase()) {
    case 'admin':
      location.replace('admin-doctors.html');
      break;
    case 'doctor':
      location.replace('doctor-dashboard.html');
      break;
    case 'parent':
      location.replace('parent.html');
      break;
    default:
      location.replace('index.html');
  }
}

async function handleSignUp(email, password, name, role) {
  try {
    showDebug('');

    const ready = await ensureSupabaseReady();
    if (!ready) return;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (authError) throw authError;

    let session = authData?.session || null;
    if (!session) {
      const { data: signinData, error: signinError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signinError) {
        showToast('تم إنشاء الحساب لكن تعذر تسجيل الدخول تلقائيًا. جرّب الدخول يدويًا.', true);
        showDebug(`Signin after signup failed: ${signinError.message}`);
        return;
