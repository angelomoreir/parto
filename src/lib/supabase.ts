import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const signInWithEmail = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
};

export const signUpWithEmail = async (email: string, password: string, name?: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: name ? { full_name: name } : undefined,
    },
  });
  if (error) throw error;
  return data;
};

export const updateDisplayName = async (name: string) => {
  const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
  if (error) throw error;
};

export const logout = async () => {
  await supabase.auth.signOut();
};
