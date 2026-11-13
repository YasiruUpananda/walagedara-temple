import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UploadCloud } from "lucide-react";
import {
  adSchema,
  type AdInput,
  validateImage,
  friendlyError,
} from "../../lib/validation";
import { cleanupImage, saveAd } from "../../lib/api";
import type { Advertisement } from "../../types";
import { Modal } from "../../components/Modal";
import { AdContent } from "../display/PublicDisplay";
export function AdForm({
  ad,
  onClose,
  onSaved,
  connected,
}: {
  ad?: Advertisement;
  onClose: () => void;
  onSaved: (message: string) => void;
  connected: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(ad?.image_url ?? "");
  const [error, setError] = useState("");
  const {
    register,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdInput>({
    resolver: zodResolver(adSchema),
    defaultValues: ad
      ? { ...ad, heading: ad.heading ?? "", message: ad.message ?? "" }
      : {
          title: "",
          type: "text",
          heading: "",
          message: "",
          duration_seconds: 10,
          is_active: true,
        },
  });
  const values = watch();
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(next?: File) {
    if (!next) return;
    try {
      validateImage(next);
      setFile(next);
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    }
  }
  return (
    <Modal
      title={ad ? "නිවේදනය සංස්කරණය කරන්න" : "නිවේදනයක් එක් කරන්න"}
      busy={isSubmitting}
      onClose={onClose}
    >
      <form
        noValidate
        onSubmit={handleSubmit(async (input) => {
          setError("");
          try {
            const { oldPath } = await saveAd(input, ad, file);
            let message = "නිවේදනය සුරකින ලදී.";
            try {
              await cleanupImage(oldPath);
            } catch {
              message = "නිවේදනය සුරකින ලදී. පැරණි රූපය ඉවත් කිරීමට සැකසුම් උපදෙස් බලන්න.";
            }
            onSaved(message);
          } catch (e) {
            setError(
              friendlyError(e) +
                " නැවත උත්සාහ කිරීමට පෙර ලැයිස්තුව යළි පූරණය කර සුරැකී ඇත්දැයි බලන්න.",
            );
          }
        })}
      >
        <fieldset disabled={isSubmitting || !connected}>
          <div className="form-grid">
            <label>
              නිවේදන වර්ගය
              <select {...register("type")}>
                <option value="text">පෙළ</option>
                <option value="image">රූපය</option>
              </select>
            </label>
            <label>
              පෙන්වන කාලය (තත්පර)
              <input
                type="number"
                min="3"
                max="120"
                {...register("duration_seconds", { valueAsNumber: true })}
              />
            </label>
          </div>
          <label>
            හඳුනාගැනීමේ නම
            <input
              maxLength={100}
              placeholder="ඔබගේ පහසුව සඳහා නමක්"
              {...register("title")}
            />
          </label>
          {values.type === "text" ? (
            <>
              <label>
                නිවේදන මාතෘකාව
                <input
                  maxLength={120}
                  placeholder="නිවේදනයේ කෙටි මාතෘකාව"
                  {...register("heading")}
                />
              </label>
              <label>
                නිවේදන පණිවිඩය
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="බැතිමතුන් දැනුවත් කිරීමට අවශ්‍ය පණිවිඩය ලියන්න"
                  {...register("message")}
                />
              </label>
            </>
          ) : (
            <label
              className="upload-area"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                choose(e.dataTransfer.files[0]);
              }}
            >
              <UploadCloud />
              <strong>රූපයක් තෝරන්න හෝ මෙතැනට ඇද දමන්න</strong>
              <span>JPEG, PNG හෝ WebP · උපරිම 5 MB</span>
              <input
                aria-label="නිවේදන රූපය"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => choose(e.target.files?.[0])}
              />
            </label>
          )}
          <label className="checkbox-label">
            <input type="checkbox" {...register("is_active")} />
            බැතිමතුන්ගේ තිරයේ පෙන්වන්න
          </label>
          {Object.values(errors).map((e, i) => (
            <p className="error" key={i}>
              {e.message}
            </p>
          ))}
          <p className="eyebrow preview-label">තිරයේ පෙරදසුන</p>
          <div className="ad-preview">
            {values.type === "image" && !preview ? (
              <span className="muted">පෙරදසුන සඳහා රූපයක් තෝරන්න.</span>
            ) : (
              <AdContent
                key={preview + values.type}
                ad={{
                  id: "preview",
                  type: values.type,
                  image_url: preview,
                  heading: values.heading || "ඔබගේ මාතෘකාව",
                  message: values.message || "ඔබගේ පණිවිඩය මෙහි දිස්වේ.",
                  duration_seconds: values.duration_seconds,
                  display_order: 0,
                }}
              />
            )}
          </div>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" disabled={isSubmitting} onClick={onClose}>
            අවලංගු කරන්න
          </button>
          <button className="primary" disabled={isSubmitting || !connected}>
            {isSubmitting ? "සුරකිමින්…" : "නිවේදනය සුරකින්න"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
