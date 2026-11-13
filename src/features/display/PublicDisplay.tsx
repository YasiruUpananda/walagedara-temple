import { useState } from "react";
import type { PublicAd } from "../../types";
import { formatNumber } from "../../lib/validation";
import { useDisplay } from "./DisplayProvider";
import { useAdRotation } from "./useAdRotation";
import ServicePausedPage from "./ServicePausedPage";
export function AdContent({ ad }: { ad: PublicAd }) {
  const [failed, setFailed] = useState(false);
  return ad.type === "image" ? (
    failed ? (
      <p className="muted">නිවේදන රූපය පූරණය කළ නොහැක.</p>
    ) : (
      <img
        src={ad.image_url ?? ""}
        alt="විහාරස්ථාන නිවේදන රූපය"
        onError={() => setFailed(true)}
      />
    )
  ) : (
    <div className="temple-notice-content">
      <h2>{ad.heading}</h2>
      <p>{ad.message}</p>
    </div>
  );
}
export default function PublicDisplay() {
  const { state, connected } = useDisplay();
  const ad = useAdRotation(
    state?.service_paused ? [] : (state?.active_ads ?? []),
  );
  if (state?.service_paused) return <ServicePausedPage connected={connected} />;
  if (!state)
    return (
      <main className="waiting">
        <img
          className="public-logo"
          src="/temple-emblem-transparent.png"
          alt="පතිරාජ මන්තින්දාරාම විහාරයේ ලාංඡනය"
        />
        <span className="loading-ring" />
        <p>
          {connected ? "අංක තිරය පූරණය වෙමින්…" : "විහාරස්ථාන අංක තිරයට සම්බන්ධ වෙමින්…"}
        </p>
      </main>
    );
  return (
    <main className={`public-display ${ad ? "has-notice" : ""}`}>
      <section className="number-section">
        <img
          className="public-logo"
          src="/temple-emblem-transparent.png"
          alt="පතිරාජ මන්තින්දාරාම විහාරයේ ලාංඡනය"
        />
        <h1 className="temple-name">පතිරාජ මන්තින්දාරාම විහාරය</h1>
        <p className="eyebrow">දැන් කැඳවන අංකය</p>
        <div
          className="public-number"
          key={state.current_number}
          aria-live="polite"
        >
          {formatNumber(state.current_number)}
        </div>
        <p className="number-caption">සෙත් කවි කියවීමේ අංකය</p>
      </section>
      {ad && (
        <section className="temple-notice-section" aria-label="නිවේදනය">
          <AdContent key={`${ad.id}-${ad.image_url}`} ad={ad} />
        </section>
      )}
      {!connected && (
        <p className="connection-warning" role="status">
          සම්බන්ධතාව බිඳී ඇත · අවසන් වරට තහවුරු වූ අංකය පෙන්වයි
        </p>
      )}
    </main>
  );
}
