// Compatibility wrapper.
// The shared Nitro/Supabase logic now lives in /shared.

export { supabase } from '../shared/supabase-client.js';
export {
  getSession,
  getUser,
  signIn,
  signOut,
  onAuthChange,
} from '../shared/auth.js';
