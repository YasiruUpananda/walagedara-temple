import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { rpc } from "../../lib/api";
const Context = createContext({
  ready: false,
  admin: false,
  session: null as Session | null,
  recheck: async () => false,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  async function recheck() {
    try {
      const allowed = await rpc<boolean>("is_admin");
      setAdmin(allowed);
      return allowed;
    } catch {
      setAdmin(false);
      return false;
    }
  }
  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let alive = true;
    let generation = 0;
    const update = async (next: Session | null) => {
      const version = ++generation;
      if (alive) {
        setSession(next);
        setReady(false);
        setAdmin(false);
      }
      let allowed = false;
      if (next) {
        try {
          allowed = await rpc<boolean>("is_admin");
        } catch {
          /* Fail closed. */
        }
      }
      if (alive && version === generation) {
        setAdmin(allowed);
        setReady(true);
      }
    };
    void supabase.auth.getSession().then(({ data }) => update(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setTimeout(() => {
        if (alive) void update(next);
      }, 0);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <Context.Provider value={{ ready, admin, session, recheck }}>
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
