// js/supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// بيانات الاتصال الخاصة بمشروعك (تم إضافتها تلقائيًا)
const supabaseUrl = 'https://mhbvibddozvzepebojvy.supabase.co';
const supabaseKey = 'sb_publishable_alBlGBefkBw00vVGklyK4g_WizpLWjl';

// إنشاء عميل Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// تصدير العميل لاستخدامه في باقي الملفات
export { supabase };
