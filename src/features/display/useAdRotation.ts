import { useEffect, useRef, useState } from "react";
import type { PublicAd } from "../../types";
export function useAdRotation(ads: PublicAd[]) {
  const sorted = [...ads].sort(
    (a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id),
  );
  const latest = useRef(sorted);
  const [id, setId] = useState<string | null>(sorted[0]?.id ?? null);
  const previousIndex = latest.current.findIndex((a) => a.id === id);
  const nextSurvivor =
    previousIndex < 0
      ? undefined
      : [
          ...latest.current.slice(previousIndex + 1),
          ...latest.current.slice(0, previousIndex),
        ].find((a) => sorted.some((next) => next.id === a.id));
  const current =
    sorted.find((a) => a.id === id) ??
    sorted.find((a) => a.id === nextSurvivor?.id) ??
    sorted[0] ??
    null;
  useEffect(() => {
    latest.current = sorted;
  });
  useEffect(() => {
    if (current?.id !== id) setId(current?.id ?? null);
  }, [current?.id, id]);
  // Depending only on identity/duration/count keeps number-only revisions from restarting playback.
  const multiple = sorted.length > 1;
  useEffect(() => {
    if (!current || !multiple) return;
    const timer = setTimeout(() => {
      const list = latest.current;
      const index = list.findIndex((a) => a.id === current.id);
      setId(list[(index + 1) % list.length]?.id ?? null);
    }, current.duration_seconds * 1000);
    return () => clearTimeout(timer);
  }, [current?.id, current?.duration_seconds, multiple]);
  useEffect(() => {
    if (!current || !multiple) return;
    const index = sorted.findIndex((a) => a.id === current.id);
    const next = sorted[(index + 1) % sorted.length];
    if (next?.image_url) {
      const image = new Image();
      image.src = next.image_url;
    }
  }, [current?.id, ads, multiple]);
  return current;
}
