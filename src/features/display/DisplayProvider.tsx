import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../../lib/supabase";
import { fetchState } from "../../lib/api";
import type { DisplayState } from "../../types";
export function reconcile(previous: DisplayState | null, next: DisplayState) {
  return !previous || next.revision > previous.revision ? next : previous;
}
const Context = createContext<{
  state: DisplayState | null;
  connected: boolean;
  refresh: () => Promise<void>;
}>({ state: null, connected: false, refresh: async () => {} });
export function DisplayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DisplayState | null>(null);
  const [connected, setසම්බන්ධයි] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const next = await fetchState();
      setState((old) => reconcile(old, next));
    } catch {
      setසම්බන්ධයි(false);
    }
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    let live = true;
    let subscribed = false;
    const fetch = async () => {
      try {
        const next = await fetchState();
        if (live) {
          setState((old) => reconcile(old, next));
          setසම්බන්ධයි(subscribed && navigator.onLine);
        }
      } catch {
        if (live) setසම්බන්ධයි(false);
      }
    };
    const channel = db
      .channel(`display-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "display_state",
          filter: "id=eq.1",
        },
        (payload) => {
          if (live)
            setState((old) => reconcile(old, payload.new as DisplayState));
        },
      )
      .subscribe((status) => {
        subscribed = status === "SUBSCRIBED";
        if (live) setසම්බන්ධයි(subscribed && navigator.onLine);
        if (subscribed) void fetch();
      });
    void fetch();
    const timer = setInterval(() => {
      void fetch();
    }, 15000);
    const offline = () => setසම්බන්ධයි(false);
    const online = () => void fetch();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", online);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", online);
      void db.removeChannel(channel);
    };
  }, []);
  return (
    <Context.Provider value={{ state, connected, refresh }}>
      {children}
    </Context.Provider>
  );
}
export const useDisplay = () => useContext(Context);
