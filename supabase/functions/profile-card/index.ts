import { createProfileCardHandler } from './handler.js';

// Public credentials only. This endpoint cannot bypass profiles RLS.
Deno.serve(createProfileCardHandler({
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  publicKey: Deno.env.get('SUPABASE_ANON_KEY'),
}));
