import { createClient } from "@supabase/supabase-js";

// Cliente administrativo de Supabase (service_role). SOLO uso en servidor:
// invitar usuarios, eliminar usuarios de Supabase, etc. Nunca exponer al frontend.
export function crearSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
