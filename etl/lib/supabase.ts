import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.\n' +
    'Create a .env file in the scripts/ directory with:\n' +
    'SUPABASE_URL=https://your-project.supabase.co\n' +
    'SUPABASE_SERVICE_KEY=your-service-role-key'
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

export async function checkConnection(): Promise<boolean> {
  const { error } = await supabase.from('locations').select('id').limit(1);
  if (error && error.code !== 'PGRST116') {
    // PGRST116 = table doesn't exist, which is fine before schema is created
    console.error('Supabase connection error:', error.message);
    return false;
  }
  return true;
}
