import { z } from "zod";
export const numberSchema = z
  .string()
  .regex(/^\d+$/, "0 සිට 9999 දක්වා පූර්ණ සංඛ්‍යාවක් ඇතුළත් කරන්න.")
  .refine((v) => Number(v) <= 9999, "උපරිම අංකය 9999 වේ.");
export const adSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "නමක් ඇතුළත් කරන්න.")
      .max(100, "නම අක්ෂර 100කට සීමා කරන්න."),
    type: z.enum(["text", "image"]),
    heading: z.string().trim().max(120, "මාතෘකාව අක්ෂර 120කට සීමා කරන්න."),
    message: z.string().trim().max(500, "පණිවිඩය අක්ෂර 500කට සීමා කරන්න."),
    duration_seconds: z
      .number({ error: "වලංගු කාලයක් ඇතුළත් කරන්න." })
      .int("පූර්ණ තත්පර ගණනක් ඇතුළත් කරන්න.")
      .min(3, "අවම කාලය තත්පර 3කි.")
      .max(120, "උපරිම කාලය තත්පර 120කි."),
    is_active: z.boolean(),
  })
  .superRefine((v, c) => {
    if (v.type === "text") {
      for (const key of ["heading", "message"] as const)
        if (!v[key])
          c.addIssue({
            code: "custom",
            path: [key],
            message:
              key === "heading" ? "මාතෘකාවක් ඇතුළත් කරන්න." : "පණිවිඩයක් ඇතුළත් කරන්න.",
          });
    }
  });
export type AdInput = z.infer<typeof adSchema>;
export const formatNumber = (n: number) => String(n).padStart(3, "0");
export function validateImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPEG, PNG හෝ WebP රූපයක් තෝරන්න.");
  if (file.size > 5 * 1024 * 1024) throw new Error("රූපය 5 MB හෝ ඊට අඩු විය යුතුය.");
  if (!file.size) throw new Error("රූප ගොනුව හිස්ය.");
}
export function friendlyError(error: unknown) {
  if (
    error instanceof Error &&
    [
      "JPEG, PNG හෝ WebP රූපයක් තෝරන්න.",
      "රූපය 5 MB හෝ ඊට අඩු විය යුතුය.",
      "රූප ගොනුව හිස්ය.",
      "රූපයක් තෝරන්න.",
    ].includes(error.message)
  )
    return error.message;
  return "වෙනස් කිරීම තහවුරු කළ නොහැකි විය. නැවත උත්සාහ කිරීමට පෙර වත්මන් තත්ත්වය පරීක්ෂා කරන්න.";
}
