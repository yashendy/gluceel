// js/supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// بيانات الاتصال الخاصة بمشروعك (تم إضافتها تلقائيًا)
const supabaseUrl = 'https://mhbvibddozvzepebojvy.supabase.co';
const supabaseKey = 'sb_publishable_alBlGBefkBw00vVGklyK4g_WizpLWjl';
// بيانات الاتصال الخاصة بمشروع Supabase (استخدم قيم الـ URL و anon key من لوحة التحكم)
const supabaseUrl = 'https://mhbvibddozvzepebojvy.supabase.co'.trim();
const supabaseAnonKey = 'sb_publishable_alBlGBefkBw00vVGklyK4g_WizpLWjl'.trim();

// تحقق سريع للتأكد من عدم نسيان ملء البيانات أو ترك قِيَم تجريبية
const missingCreds = !supabaseUrl || !supabaseAnonKey;
const placeholderCreds = [
  'https://your-project.supabase.co',
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY'
].some((placeholder) => supabaseUrl === placeholder || supabaseAnonKey === placeholder);

const invalidFormat =
  !supabaseUrl.startsWith('https://') ||
  !supabaseUrl.includes('.supabase.co') ||
  !supabaseAnonKey.startsWith('sb_');

if (missingCreds || placeholderCreds || invalidFormat) {
  throw new Error('Supabase URL و anon key مطلوبة ويجب أن تكون بصيغة صحيحة وليست قيماً تجريبية.');
}

// إنشاء عميل Supabase
const supabase = createClient(supabaseUrl, supabaseKey);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// تصدير العميل لاستخدامه في باقي الملفات
export { supabase };
export { supabase, supabaseUrl, supabaseAnonKey };
