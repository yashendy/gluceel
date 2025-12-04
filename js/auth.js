@@ -48,57 +48,67 @@ async function handleSignUp(email, password, name, role) {
import { supabase } from './supabase-config.js';

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const toast = document.getElementById('toast');
const statusBanner = document.getElementById('authStatus');

function showToast(message, isError = false) {
  if (!toast) return;
  toast.style.display = 'block';
  toast.style.color = isError ? 'red' : 'green';
  toast.textContent = message;
}

function setStatus(message = '', isError = false) {
  if (!statusBanner) return;
  statusBanner.textContent = message;
  statusBanner.classList.toggle('error', Boolean(isError));
  statusBanner.style.display = message ? 'block' : 'none';
}

// تسجيل مستخدم جديد
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
      // ب. الإضافة اليدوية في جدول users
      const { error: dbError } = await supabase.from('users').insert([
        {
          id: authData.user.id, // نأخذ نفس الـ ID
          email: email,
          name: name,
          role: role,
          id: authData.user.id,
          email,
          name,
          role,
          status: role === 'doctor' ? 'pending' : 'active'
        }
      ]);

      if (dbError) {
        console.error("خطأ في قاعدة البيانات:", dbError);
        // لو حصل خطأ في الجدول، نحاول نمسح المستخدم من Auth عشان ميبقاش "معلق"
        await supabase.auth.admin.deleteUser(authData.user.id); 
        throw new Error("فشل حفظ بيانات الملف الشخصي. حاول مرة أخرى.");

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
        console.error('خطأ في قاعدة البيانات:', dbError);
        throw new Error('فشل حفظ بيانات الملف الشخصي. حاول مرة أخرى.');
      }

      showToast('تم إنشاء الحساب بنجاح! جاري الدخول...');
      

      // انتظار بسيط ثم التحقق والتوجيه
      setTimeout(() => {
         checkAuth();
      }, 1500);
      setTimeout(() => checkAuth(), 1200);
    }

  } catch (err) {
    console.error(err);
    showToast(`خطأ: ${err.message}`, true);
  }
}

// 2. تسجيل الدخول
// تسجيل الدخول
async function handleLogin(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    showToast('تم تسجيل الدخول!');
    checkAuth(); // التوجيه

    checkAuth();
  } catch (err) {
    console.error(err);
    showToast('البريد الإلكتروني أو كلمة المرور غير صحيحة', true);
  }
}

async function fetchUserProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('role,status')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('فشل جلب بيانات المستخدم:', error);
    showToast('تعذر التحقق من بيانات الحساب', true);
    return null;
  }

  return data;
}

async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  setStatus('جاري فحص جلسة الدخول...');
  if (!session) {
    setStatus('');
    return;
  }

  const profile = await fetchUserProfile(session.user.id);
  if (!profile) {
    setStatus('تعذر تحديد دور حسابك.', true);
    return;
  }

  if (profile.role === 'admin') {
    setStatus('مرحباً أيها المشرف، سيتم تحويلك إلى لوحة مراجعة الأطباء');
    window.location.href = 'admin-doctors.html';
    return;
  }

  if (profile.role === 'doctor') {
    if (profile.status !== 'active') {
      const pendingMsg = 'تم تسجيل حسابك كطبيب وهو في انتظار التفعيل من الإدارة.';
      showToast(pendingMsg, true);
      setStatus(pendingMsg, true);
      return;
    }
    setStatus('أهلاً بك دكتور، سيتم تحويلك إلى لوحة العيادة');
    window.location.href = 'doctor-dashboard.html';
    return;
  }

  if (profile.role === 'parent') {
    setStatus('مرحباً، سيتم تحويلك إلى لوحة ولي الأمر');
    window.location.href = 'parent.html';
    return;
  }

  showToast('لا يوجد توجيه مخصص لهذا الدور', true);
  setStatus('لا يوجد توجيه مخصص لهذا الدور', true);
}

// ربط الفورمات
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    await handleLogin(email, password);
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const role = document.querySelector('input[name="role"]:checked').value;

    await handleSignUp(email, password, name, role);
  });
}

// محاولة التوجيه التلقائي إذا كان المستخدم مسجلاً بالفعل
checkAuth();
