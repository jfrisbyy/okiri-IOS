import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ubclvjqvddglcsvgxlaz.supabase.co';
const envAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const JWT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViY2x2anF2ZGRnbGNzdmd4bGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODIwMjUsImV4cCI6MjA4ODY1ODAyNX0.cTrafAYEUjXNPo_xwRXZr1Kj0IudkIaLQE4et6VVVc4';
const supabaseAnonKey = (envAnonKey && envAnonKey.startsWith('eyJ')) ? envAnonKey : JWT_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
