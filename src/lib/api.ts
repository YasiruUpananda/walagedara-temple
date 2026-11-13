import { client } from "./supabase";
import type { Advertisement, DisplayState } from "../types";
import type { AdInput } from "./validation";
import { validateImage } from "./validation";
export async function rpc<T>(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client().rpc(name, args);
  if (error) throw error;
  return data as T;
}
export async function fetchState() {
  const { data, error } = await client()
    .from("display_state")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data as DisplayState;
}
export async function listAds() {
  const { data, error } = await client()
    .from("advertisements")
    .select("*")
    .order("display_order")
    .order("id");
  if (error) throw error;
  return data as Advertisement[];
}
export async function uploadImage(file: File) {
  validateImage(file);
  const extension = (
    { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<
      string,
      string
    >
  )[file.type];
  const path = `ads/${crypto.randomUUID()}.${extension}`;
  const { error } = await client()
    .storage.from("advertisements")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}
// Deletion policy checks references again in PostgreSQL; never delete on an uncertain save.
export async function cleanupImage(path: string | null) {
  if (!path) return;
  const { error } = await client()
    .storage.from("advertisements")
    .remove([path]);
  if (error) throw new Error("නිවේදනය සුරකින ලදී. පැරණි රූපය ගබඩාවෙන් ඉවත් කළ යුතුය.");
}
export async function saveAd(
  input: AdInput,
  existing: Advertisement | undefined,
  file: File | null,
) {
  let path = input.type === "image" ? (existing?.storage_path ?? null) : null;
  if (file && input.type === "image") path = await uploadImage(file);
  if (input.type === "image" && !path) throw new Error("රූපයක් තෝරන්න.");
  const result = await rpc<Advertisement>(
    existing ? "update_advertisement" : "create_advertisement",
    {
      ...(existing ? { p_id: existing.id } : {}),
      p_title: input.title,
      p_type: input.type,
      p_heading: input.type === "text" ? input.heading : null,
      p_message: input.type === "text" ? input.message : null,
      p_storage_path: path,
      p_duration_seconds: input.duration_seconds,
      p_is_active: input.is_active,
    },
  );
  return {
    result,
    oldPath:
      existing?.storage_path && existing.storage_path !== path
        ? existing.storage_path
        : null,
  };
}
