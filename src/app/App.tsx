import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Flower2 } from "lucide-react";
import { configured } from "../lib/supabase";
import { AuthProvider } from "../features/auth/AuthProvider";
import { DisplayProvider } from "../features/display/DisplayProvider";
import PublicDisplay from "../features/display/PublicDisplay";
const Login = lazy(() => import("../features/auth/LoginPage"));
const Layout = lazy(() => import("../layouts/AdminLayout"));
const Appointments = lazy(
  () => import("../features/appointments/AppointmentPage"),
);
const Ads = lazy(() => import("../features/advertisements/AdvertisementsPage"));
export default function App() {
  if (!configured)
    return (
      <main className="waiting configuration">
        <span className="brand-icon">
          <Flower2 />
        </span>
        <h1>පතිරාජ මන්තින්දාරාම විහාරය</h1>
        <h2>ආරම්භ කිරීමට විහාරස්ථාන පද්ධතිය සම්බන්ධ කරන්න</h2>
        <p>
          Supabase ව්‍යාපෘතියේ URL සහ publishable key පරිසර සැකසුම්වලට එක් කර යෙදුම
          නැවත ආරම්භ කරන්න.
        </p>
        <code>
          VITE_SUPABASE_URL
          <br />
          VITE_SUPABASE_PUBLISHABLE_KEY
        </code>
        <p className="muted">README.md ගොනුවේ සැකසුම් උපදෙස් අනුගමනය කරන්න.</p>
      </main>
    );
  return (
    <BrowserRouter>
      <AuthProvider>
        <DisplayProvider>
          <Suspense fallback={<main className="waiting">පූරණය වෙමින්…</main>}>
            <Routes>
              <Route path="/" element={<PublicDisplay />} />
              <Route path="/admin/login" element={<Login />} />
              <Route path="/admin" element={<Layout />}>
                <Route index element={<Navigate to="appointments" replace />} />
                <Route path="appointments" element={<Appointments />} />
                <Route path="advertisements" element={<Ads />} />
              </Route>
              <Route
                path="*"
                element={
                  <main className="waiting">
                    <h1>පිටුව හමු නොවීය</h1>
                    <a href="/">අංක තිරයට යන්න</a>
                  </main>
                }
              />
            </Routes>
          </Suspense>
        </DisplayProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
