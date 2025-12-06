import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://mhbvibddozvzepebojvy.supabase.co'.trim();
const supabaseAnonKey = 'sb_publishable_alBlGBefkBw00vVGklyK4g_WizpLWjl'.trim();

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

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabase, supabaseUrl, supabaseAnonKey };
