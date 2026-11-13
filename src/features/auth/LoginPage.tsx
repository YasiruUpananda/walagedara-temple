import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Flower2, Eye, EyeOff, ArrowRight, LockKeyhole } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { client } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";
const schema = z.object({
  email: z.email("වලංගු ඊමේල් ලිපිනයක් ඇතුළත් කරන්න."),
  password: z.string().min(1, "ඔබගේ මුරපදය ඇතුළත් කරන්න."),
});
export default function LoginPage() {
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const auth = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (auth.ready && auth.admin)
    return <Navigate to="/admin/appointments" replace />;
  return (
    <main className="login-page">
      <div className="login-brand">
        <span className="brand-icon">
          <Flower2 />
        </span>
        පතිරාජ මන්තින්දාරාම විහාරය
      </div>
      <section className="card login-card">
        <span className="soft-icon">
          <LockKeyhole size={25} />
        </span>
        <h1>පරිපාලක පිවිසුම</h1>
        <p className="muted">
          බැතිමතුන්ගේ අංක සහ විහාරස්ථාන නිවේදන කළමනාකරණය කිරීමට පිවිසෙන්න.
        </p>
        <form
          noValidate
          onSubmit={handleSubmit(async (value) => {
            setError("");
            try {
              const { error } = await client().auth.signInWithPassword(value);
              if (error) throw error;
              if (!(await auth.recheck())) {
                await client().auth.signOut();
                setError("මෙම ගිණුමට පරිපාලක අවසර නොමැත.");
                return;
              }
              navigate("/admin/appointments", { replace: true });
            } catch {
              setError(
                "පිවිසිය නොහැක. ඊමේල් ලිපිනය, මුරපදය සහ අන්තර්ජාල සම්බන්ධතාව පරීක්ෂා කරන්න.",
              );
            }
          })}
        >
          <label>
            ඊමේල් ලිපිනය
            <input
              type="email"
              autoComplete="username"
              placeholder="admin@example.com"
              {...register("email")}
            />
          </label>
          {errors.email && <p className="error">{errors.email.message}</p>}
          <label>
            මුරපදය
            <div className="password-field">
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                {...register("password")}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={show ? "මුරපදය සඟවන්න" : "මුරපදය පෙන්වන්න"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {errors.password && (
            <p className="error">{errors.password.message}</p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={isSubmitting}>
            {isSubmitting ? "පිවිසෙමින්…" : "පිවිසෙන්න"}
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
      <p className="login-foot">සෙත් කවි කියවීම සඳහා අංක කළමනාකරණය</p>
    </main>
  );
}
