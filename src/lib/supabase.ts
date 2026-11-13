import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
function valid() {
  try {
    if (key?.startsWith("eyJ")) {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon") return false;
    }
    return Boolean(
      url &&
      ["https:", "http:"].includes(new URL(url).protocol) &&
      key &&
      !key.startsWith("sb_secret_") &&
      key.length > 20,
    );
  } catch {
    return false;
  }
}
export const configured = valid();
export const supabase = configured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: {
        // Never replay a potentially committed mutation after an ambiguous timeout.
        fetch: (input, options) =>
          fetch(input, {
            ...options,
            signal: options?.signal
              ? AbortSignal.any([options.signal, AbortSignal.timeout(12000)])
              : AbortSignal.timeout(12000),
          }),
      },
    })
  : null;
export function client() {
  if (!supabase) throw new Error("Supabase සැකසුම් සම්පූර්ණ කර නොමැත.");
  return supabase;
}
