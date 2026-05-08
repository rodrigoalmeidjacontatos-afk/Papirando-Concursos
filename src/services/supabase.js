import { createClient } from '@supabase/supabase-js';

// Correção de Emergência para garantir o funcionamento imediato no Deploy
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://wqvtimtgvlhhpmmfhhdi.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxdnRpbXRndmxoaHBtbWZoaGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMTAyMDMsImV4cCI6MjA5Mjc4NjIwM30.nrWy9vI87oqUpkHq6thdzu-ns12RmCC1R9sjxqgcGeY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);