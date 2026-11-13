import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  ArrowRight,
  Minus,
  RotateCcw,
  Monitor,
  CheckCircle2,
} from "lucide-react";
import { useDisplay } from "../display/DisplayProvider";
import { rpc } from "../../lib/api";
import {
  formatNumber,
  numberSchema,
  friendlyError,
} from "../../lib/validation";
import { Modal } from "../../components/Modal";
export default function AppointmentPage() {
  const { state, connected, refresh } = useDisplay();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ number: string }>();
  async function change(name: string, args?: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await rpc(name, args);
      await refresh();
      setNotice("බැතිමතුන්ගේ තිරය යාවත්කාලීන කරන ලදී.");
      setConfirm(false);
    } catch (e) {
      setError(friendlyError(e));
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || !connected || !state;
  const availabilityConfigured = typeof state?.service_paused === "boolean";
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">සෙත් කවි කියවීම</span>
        <h1>සෙත් කවි කියවීමේ අංක පාලනය</h1>
        <p className="muted">සෙත් කවි කියවීම සඳහා කැඳවන බැතිමතාගේ අංකය සකසන්න.</p>
      </div>
      <section
        className="card service-settings"
        aria-labelledby="service-setting-title"
      >
        <div>
          <h2 id="service-setting-title">සෙත් කවි සේවාව තාවකාලිකව නවතා ඇත</h2>
          <p className="muted">
            මෙය ක්‍රියාත්මක කළ විට අංක තිරය වෙනුවට සේවාව නොපැවැත්වෙන බවට දැනුම්දීම පෙන්වයි.
            අක්‍රිය කළ විට අංක තිරය නැවත දිස්වේ.
          </p>
          {!availabilityConfigured && state && (
            <p className="error">මෙම පහසුකම සඳහා නව දත්ත ගබඩා සැකසුම යෙදිය යුතුය.</p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          className={`toggle ${state?.service_paused ? "on" : ""}`}
          aria-label="සේවාව නොපැවැත්වෙන බවට පිටුව පෙන්වන්න"
          aria-checked={Boolean(state?.service_paused)}
          disabled={disabled || !availabilityConfigured}
          onClick={() =>
            void change("set_service_paused", {
              p_paused: !state?.service_paused,
            })
          }
        >
          <span />
        </button>
        <p className="service-mode-status">
          {state?.service_paused
            ? "දැනුම්දීමේ පිටුව ක්‍රියාත්මකයි"
            : "අංක තිරය ක්‍රියාත්මකයි"}
        </p>
      </section>
      <section className="card appointment-card">
        <div className="card-topline">
          <span>
            <Monitor size={17} />
            වත්මන් සෙත් කවි කියවීමේ අංකය
          </span>
          <span className={`status ${connected ? "live" : ""}`}>
            <i />
            {connected ? "තිරයේ පෙන්වයි" : "සම්බන්ධතාව නැත"}
          </span>
        </div>
        <div className="appointment-value">
          <p>දැනට කැඳවන අංකය</p>
          <strong aria-live="polite">
            {state ? formatNumber(state.current_number) : "—"}
          </strong>
          <span className="muted">
            {state ? "ඊළඟ බැතිමතා කැඳවීමට සූදානම්" : "විහාරස්ථාන පද්ධතියට සම්බන්ධ වෙමින්"}
          </span>
        </div>
        <div className="step-buttons">
          <button
            disabled={disabled || state?.current_number === 0}
            onClick={() => void change("decrement_appointment")}
          >
            <Minus size={19} />
            පෙර අංකය
          </button>
          <button
            className="primary"
            disabled={disabled || state?.current_number === 9999}
            onClick={() => void change("increment_appointment")}
          >
            ඊළඟ බැතිමතා
            <ArrowRight size={20} />
          </button>
        </div>
        <div className="manual-number">
          <form
            noValidate
            onSubmit={handleSubmit((v) =>
              change("set_appointment_number", { p_number: Number(v.number) }),
            )}
          >
            <label htmlFor="appointment-number">
              සෙත් කවි කියවීමේ අංකය ඇතුළත් කරන්න
            </label>
            <div className="input-row">
              <input
                id="appointment-number"
                inputMode="numeric"
                placeholder="අංකය ඇතුළත් කරන්න"
                {...register("number", {
                  validate: (v) =>
                    numberSchema.safeParse(v).success ||
                    "0 සිට 9999 දක්වා පූර්ණ සංඛ්‍යාවක් ඇතුළත් කරන්න.",
                })}
              />
              <button disabled={disabled}>අංකය සකසන්න</button>
            </div>
            <p className="field-hint">0 සිට 9999 දක්වා අංකයක් භාවිත කරන්න.</p>
            {errors.number && <p className="error">{errors.number.message}</p>}
          </form>
        </div>
        <button
          className="reset-button"
          disabled={disabled}
          onClick={() => setConfirm(true)}
        >
          <RotateCcw size={16} />
          අංකය මුලට සකසන්න
        </button>
      </section>
      {notice && (
        <p className="success feedback" role="status">
          <CheckCircle2 size={17} />
          {notice}
        </p>
      )}
      {error && (
        <p className="error feedback" role="alert">
          {error}
        </p>
      )}
      <p className="helper-line">
        <Monitor size={16} /> සම්බන්ධිත සියලු තිරවල වෙනස්කම් ස්වයංක්‍රීයව දිස්වේ.
      </p>
      {confirm && (
        <Modal
          title="සෙත් කවි කියවීමේ අංකය නැවත මුලට සකසන්නද?"
          busy={busy}
          onClose={() => setConfirm(false)}
        >
          <p className="muted">
            අංක තිරය 000 වෙත නැවත සකසනු ඇත. නිවේදන වෙනස් නොවේ.
          </p>
          <div className="dialog-actions">
            <button disabled={busy} onClick={() => setConfirm(false)}>
              අවලංගු කරන්න
            </button>
            <button
              className="danger"
              disabled={disabled}
              onClick={() => void change("reset_appointment_number")}
            >
              000 ලෙස සකසන්න
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
