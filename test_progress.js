import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/REACT_APP_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/REACT_APP_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function check() {
  const { data, error } = await supabase.rpc('get_progresso_constraints'); // Or just fetch one row to see if there are duplicates
  const { data: rows, error: err } = await supabase.from('progresso').select('user_id, aula_id').limit(10);
  console.log('Rows:', rows);
}

check();
