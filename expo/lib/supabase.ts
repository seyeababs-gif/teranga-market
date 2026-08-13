import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Plan B : On utilise les variables d'environnement si elles existent, sinon on utilise directement tes accès.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ojsaqorisvvbwfaiwkov.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qc2Fxb3Jpc3Z2YndmYWl3a292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzA4ODcsImV4cCI6MjEwMTk0Njg4N30.qfM1QgXhubZKlo0iJxhh08wcGOYOAPuXdfSGiE2BznQ';

const getStorage = () => {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  }
  return AsyncStorage as any;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-application-name': 'marketplace-app',
    },
  },
});

export async function runSql(sql: string) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.error('SQL Error:', error);
      throw new Error(`Failed to run sql query: ${error.message}`);
    }
    return { data, error: null };
  } catch (error: any) {
    console.error('Error running SQL:', error);
    return { data: null, error: error.message || String(error) };
  }
}
