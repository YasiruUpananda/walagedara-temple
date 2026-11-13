export default function ServicePausedPage({
  connected,
}: {
  connected: boolean;
}) {
  return (
    <main className="service-paused-page">
      <img
        className="public-logo"
        src="/temple-emblem-transparent.png"
        alt="පතිරාජ මන්තින්දාරාම විහාරයේ ලාංඡනය"
      />
      <h1 className="temple-name">පතිරාජ මන්තින්දාරාම විහාරය</h1>
      <section className="service-paused-notice" aria-labelledby="paused-title">
        <p className="eyebrow">බැතිමතුන් වෙත කෙරෙන දැනුම්දීමයි</p>
        <h2 id="paused-title">මේ දිනවල සෙත් කවි කියන්නේ නොමැති බව කරුණාවෙන් සලකන්න.</h2>
        <p className="muted">ඔබගේ අවබෝධය පිළිබඳව ස්තුතියි.</p>
      </section>
      {!connected && (
        <p className="error" role="status">
          සම්බන්ධතාව බිඳී ඇත · අවසන් වරට තහවුරු වූ දැනුම්දීම පෙන්වයි.
        </p>
      )}
    </main>
  );
}
