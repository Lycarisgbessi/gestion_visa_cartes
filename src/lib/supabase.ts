import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://unkrmxptasyqyukkptdm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G084d_9FsdmeSBkflmURlw_7wDDEzGS';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
