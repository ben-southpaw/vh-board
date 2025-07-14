import { createClient } from '@supabase/supabase-js';

// Strip quotes from environment variables if they exist
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Remove any quotes from the URL and key
supabaseUrl = supabaseUrl?.replace(/^"|"$|\/"/g, '');
supabaseAnonKey = supabaseAnonKey?.replace(/^"|"$|\/"/g, '');

console.log('Cleaned URL:', supabaseUrl);
console.log('Cleaned Key:', supabaseAnonKey?.substring(0, 5) + '...');

// Only create the client if both variables are defined
let supabase;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.error('Supabase URL or key is missing');
  // Create a mock client for SSR if variables are missing
  supabase = {
    from: () => ({
      select: () => ({ data: null, error: new Error('Supabase not initialized') })
    }),
    // Add other needed mock methods
  } as any;
}

export { supabase };
