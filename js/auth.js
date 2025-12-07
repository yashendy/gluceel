import { supabase, supabaseUrl, supabaseAnonKey } from './supabase-config.js';

const loginForm = document.getElementById('loginForm');
const regForm = document.getElementById('registerForm');
const logoutBtn = document.getElementById('logoutBtn');
const toastEl = document.getElementById('toast');
const debugBox = document.getElementById('debugInfo');

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
      }

      session = signinData?.session || null;
    }

    const userId = session?.user?.id || authData?.user?.id;
    if (!userId) {
      showToast('لم يتم استرجاع معرّف المستخدم من Supabase.', true);
      showDebug('Missing user id after signup.');
      return;
    }

    const profile = {
      id: userId,
      email,
      name,
      role,
      status: role === 'doctor' ? 'pending' : 'active',
    };

    const { error: dbError } = await supabase.from('users').upsert(profile, { onConflict: 'id' });

    if (dbError) {
      const isTypeMismatch = dbError.message?.includes('uuid');
      const isRlsBlocked = dbError.message?.toLowerCase()?.includes('violates row-level security');
      const isForbidden = dbError.message?.toLowerCase()?.includes('permission');
      const hint = isTypeMismatch
        ? 'تأكد أن عمود id في جدول users نوعه uuid ومربوط بـ auth.users.'
        : isRlsBlocked
        ? 'فعّل RLS وأضف سياسات insert/select/update بحيث id = auth.uid().'
        : isForbidden
        ? 'تحقق من صحة الـ anon key وصلاحياته.'
        : 'راجع صلاحيات وسياسات جدول users في Supabase.';

      showDebug(`Database error: ${dbError.message || 'بدون رسالة صريحة'}`);
      showToast(`فشل حفظ بيانات الجدول: ${hint}`, true);
      return;
    }

    showToast('تم إنشاء الحساب والدخول فورًا! جاري التوجيه...');
    showDebug('');
    checkAuth();
  } catch (err) {
    showToast(`خطأ: ${err.message}`, true);
    showDebug(`Auth error: ${err.message}`);
  }
}

async function handleLogin(email, password) {
  try {
    showDebug('');

    const ready = await ensureSupabaseReady();
    if (!ready) return;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw error;

    showToast('تم تسجيل الدخول!');
    checkAuth();
  } catch (err) {
    showToast('البريد الإلكتروني أو كلمة المرور غير صحيحة', true);
    showDebug(`Login error: ${err.message}`);
  }
}

async function checkAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    const { data: user, error } = await supabase
      .from('users')
      .select('role, status, id')
      .eq('id', session.user.id)
      .single();

    if (user) {
      sessionStorage.setItem('db_user_id', user.id);

      const path = location.pathname;
      const isAuthPage = path.includes('index.html') || path.includes('register.html') || path === '/';

      if (isAuthPage) {
        routeByRole(user.role, user.status);
      }
    } else if (error) {
      showDebug(`Fetch user error: ${error.message}`);
    }
  }
}

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

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    sessionStorage.clear();
    window.location.href = 'index.html';
  });
}

checkAuth();
