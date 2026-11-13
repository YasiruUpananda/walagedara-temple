import { useCallback, useEffect, useState } from "react";
import {
  Images,
  Plus,
  Type,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Advertisement } from "../../types";
import { cleanupImage, listAds, rpc } from "../../lib/api";
import { friendlyError } from "../../lib/validation";
import { useDisplay } from "../display/DisplayProvider";
import { AdForm } from "./AdForm";
import { Modal } from "../../components/Modal";
export default function AdvertisementsPage() {
  const { connected, state } = useDisplay();
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Advertisement | "new" | null>(null);
  const [deleting, setDeleting] = useState<Advertisement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const reload = useCallback(async () => {
    try {
      setAds(await listAds());
    } catch {
      setError(
        "නිවේදන පූරණය කළ නොහැක. අන්තර්ජාල සම්බන්ධතාව පරීක්ෂා කර නැවත උත්සාහ කරන්න.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload, state?.revision]);
  async function action(
    name: string,
    args: Record<string, unknown>,
    path?: string | null,
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await rpc(name, args);
      setDeleting(null);
      setNotice("නිවේදන යාවත්කාලීන කරන ලදී.");
      if (path)
        try {
          await cleanupImage(path);
        } catch {
          setNotice("නිවේදනය මකන ලදී. රූපය ගබඩාවෙන් ඉවත් කළ යුතුය.");
        }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      await reload();
      setBusy(false);
    }
  }
  const disabled = busy || !connected;
  return (
    <>
      <div className="page-heading ads-heading">
        <div>
          <span className="eyebrow">විහාරස්ථානයෙන් බැතිමතුන්ට</span>
          <h1>නිවේදන</h1>
          <p className="muted">බැතිමතුන්ට පෙන්වන විහාරස්ථාන නිවේදන කළමනාකරණය කරන්න.</p>
        </div>
        <button
          className="primary"
          disabled={disabled}
          onClick={() => setEditing("new")}
        >
          <Plus size={18} />
          නිවේදනයක් එක් කරන්න
        </button>
      </div>
      <div className="list-summary">
        <span>නිවේදන {ads.length}ක්</span>
        <span className="active-count">
          <i />
          සක්‍රිය නිවේදන {ads.filter((a) => a.is_active).length}ක්
        </span>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button className="text-button" onClick={() => void reload()}>
            නැවත උත්සාහ කරන්න
          </button>
        </div>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <div className="card empty-state">නිවේදන පූරණය වෙමින්…</div>
      ) : ads.length === 0 ? (
        <section className="card empty-state">
          <span className="soft-icon">
            <Images size={32} />
          </span>
          <h2>තවම නිවේදන නොමැත.</h2>
          <p className="muted">බැතිමතුන්ට පෙන්වීමට පළමු නිවේදනය එක් කරන්න.</p>
          <button
            className="primary"
            disabled={disabled}
            onClick={() => setEditing("new")}
          >
            <Plus size={18} />
            නිවේදනයක් එක් කරන්න
          </button>
        </section>
      ) : (
        <div className="ad-list">
          {ads.map((ad, index) => (
            <article className="card ad-card" key={ad.id}>
              <div className="ad-thumbnail">
                {ad.type === "image" ? (
                  <img src={ad.image_url ?? ""} alt={ad.title} />
                ) : (
                  <Type size={30} />
                )}
              </div>
              <div className="ad-info">
                <span className="ad-order">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2>{ad.title}</h2>
                <p className="muted">
                  {ad.type === "image" ? "රූපය" : "පෙළ"} <span>·</span> තත්පර{" "}
                  {ad.duration_seconds}
                </p>
              </div>
              <div className="ad-controls">
                <button
                  role="switch"
                  aria-checked={ad.is_active}
                  aria-label={`සක්‍රිය කරන්න: ${ad.title}`}
                  className={`toggle ${ad.is_active ? "on" : ""}`}
                  disabled={disabled}
                  onClick={() =>
                    void action("set_advertisement_active", {
                      p_id: ad.id,
                      p_is_active: !ad.is_active,
                    })
                  }
                >
                  <span />
                </button>
                <span className="toggle-label">
                  {ad.is_active ? "සක්‍රියයි" : "අක්‍රියයි"}
                </span>
                <div className="ad-buttons">
                  <button
                    className="icon-button"
                    aria-label={`සංස්කරණය කරන්න: ${ad.title}`}
                    disabled={disabled}
                    onClick={() => setEditing(ad)}
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`ඉහළට ගෙනයන්න: ${ad.title}`}
                    disabled={disabled || index === 0}
                    onClick={() =>
                      void action("move_advertisement", {
                        p_id: ad.id,
                        p_direction: -1,
                      })
                    }
                  >
                    <ArrowUp size={17} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`පහළට ගෙනයන්න: ${ad.title}`}
                    disabled={disabled || index === ads.length - 1}
                    onClick={() =>
                      void action("move_advertisement", {
                        p_id: ad.id,
                        p_direction: 1,
                      })
                    }
                  >
                    <ArrowDown size={17} />
                  </button>
                  <button
                    className="icon-button delete"
                    aria-label={`මකන්න: ${ad.title}`}
                    disabled={disabled}
                    onClick={() => setDeleting(ad)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="helper-line">
        <Images size={16} /> සක්‍රිය නිවේදන මෙම අනුපිළිවෙළට සෙත් කවි කියවීමේ අංකයට පහළින් දිස්වේ.
      </p>
      {editing && (
        <AdForm
          connected={connected}
          ad={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
            void reload();
          }}
        />
      )}
      {deleting && (
        <Modal
          title="නිවේදනය මකන්නද?"
          busy={busy}
          onClose={() => setDeleting(null)}
        >
          <p className="muted">
            “{deleting.title}” නිවේදනය තිරයෙන් ඉවත් කරනු ඇත. මෙය ආපසු හැරවිය නොහැක.
          </p>
          <div className="dialog-actions">
            <button disabled={busy} onClick={() => setDeleting(null)}>
              අවලංගු කරන්න
            </button>
            <button
              className="danger"
              disabled={disabled}
              onClick={() =>
                void action(
                  "delete_advertisement",
                  { p_id: deleting.id },
                  deleting.storage_path,
                )
              }
            >
              නිවේදනය මකන්න
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
