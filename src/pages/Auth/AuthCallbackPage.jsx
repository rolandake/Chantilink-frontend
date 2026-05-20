import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const AUTH_API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://chantilink-backend.onrender.com/api" : "http://localhost:5000/api");
const AUTH_BACKEND_URL = AUTH_API_URL.replace(/\/api\/?$/, "");

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthData } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const error = searchParams.get("error");

    if (error) {
      const messages = {
        google_failed: "Connexion Google annulée ou refusée.",
        no_user: "Impossible de récupérer le compte Google.",
        server_error: "Erreur serveur. Réessayez.",
      };
      navigate(`/login?msg=${encodeURIComponent(messages[error] || "Erreur de connexion.")}`, {
        replace: true,
      });
      return undefined;
    }

    const finishLogin = async () => {
      try {
        const res = await fetch(`${AUTH_BACKEND_URL}/api/auth/refresh-token`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.success && data?.token && typeof setAuthData === "function") {
          await setAuthData(data);
        }
      } catch {
        // AuthProvider can still recover through its normal session loader.
      } finally {
        if (!cancelled) navigate("/", { replace: true });
      }
    };

    finishLogin();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams, setAuthData]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#09090b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16,
        color: "#f0f0f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f97316"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ animation: "spin .75s linear infinite" }}
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ margin: 0, fontSize: 15, color: "#5c5c6e" }}>
        Connexion Google en cours...
      </p>
    </div>
  );
}
