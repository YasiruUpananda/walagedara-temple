import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Flower2, ExternalLink, LogOut, Hash, Images } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../features/auth/AuthProvider";
import { useDisplay } from "../features/display/DisplayProvider";
import { client } from "../lib/supabase";
export default function AdminLayout() {
  const auth = useAuth();
  const { connected } = useDisplay();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  if (!auth.ready)
    return <main className="waiting">ප්‍රවේශ අවසර පරීක්ෂා කරමින්…</main>;
  if (!auth.session || !auth.admin)
    return <Navigate to="/admin/login" replace />;
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="header-inner">
          <span className="brand">
            <span className="brand-icon">
              <Flower2 size={23} />
            </span>
            පතිරාජ මන්තින්දාරාම විහාරය
          </span>
          <div className="header-actions">
            <span className={`status ${connected ? "live" : ""}`}>
              <i />
              {connected ? "සම්බන්ධයි" : "යළි සම්බන්ධ වෙමින්"}
            </span>
            <a
              className="button"
              href="/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} />
              <span>අංක තිරය විවෘත කරන්න</span>
            </a>
            <button
              className="icon-button"
              aria-label="ඉවත් වන්න"
              onClick={async () => {
                const { error } = await client().auth.signOut();
                if (error) setError("ඉවත් විය නොහැක. නැවත උත්සාහ කරන්න.");
                else navigate("/admin/login", { replace: true });
              }}
            >
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </header>
      <nav className="admin-nav" aria-label="පරිපාලනය">
        <div>
          <NavLink to="/admin/appointments">
            <Hash size={18} />
            සෙත් කවි කියවීමේ අංක පාලනය
          </NavLink>
          <NavLink to="/admin/advertisements">
            <Images size={18} />
            නිවේදන
          </NavLink>
        </div>
      </nav>
      {error && (
        <p className="error container" role="alert">
          {error}
        </p>
      )}
      <main className="container admin-main">
        <Outlet />
      </main>
      <footer className="admin-footer">
        <Flower2 size={14} /> කරුණාවෙන් ඔබගේ වාරය පැමිණෙන තුරු රැඳී සිටින්න.
      </footer>
    </div>
  );
}
