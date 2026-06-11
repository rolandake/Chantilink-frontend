// 📁 src/App.jsx
// ✅ DIFF vs version précédente :
//
//   1. Header TOUJOURS visible — ne se cache plus jamais (transform retiré)
//   2. mainStyle.top = toujours 72 quand showHeader (header fixe)
//   3. Navbar mobile garde le scroll intelligent via navbarVisible
//   4. goProfile utilise user._id (AuthContext) au lieu de location.state?.userId
//      → corrige "profil introuvable" sur desktop quand state est absent
//   5. ChunkErrorBoundary ajouté — rechargement auto si un chunk Vite est introuvable
//      après redéploiement (ex: Home-C93V4j8a.js → 404)
//   6. lightboxOpen state — masque FloatingBackButton quand lightbox ProfileMediaGrid ouverte
//   7. showBackButton refactorisé — exclut toutes les pages ayant leur propre bouton retour :
//      /calculs (FormHeader), /chat, /profile/*, /admin/*, /opportunities, lightbox, /videos, /messages
//   8. ✅ Onglet "À propos" remplacé par "Opportunités" (route /opportunities)
//   9. ✅ Texte "Chantilink" supprimé de la sidebar desktop (logo seul)

import React, {
  useState, Suspense, useEffect, useMemo, useCallback, memo, useRef
} from "react";
import {
  Routes, Route, Navigate, useLocation, useNavigate
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Home, MessageSquare, Video, Calculator, Mail, User, Menu, ArrowLeft, Shield, Bell, X
} from "lucide-react";

import LoadingSpinner       from "./components/LoadingSpinner";
import WakeUpScreen         from "./components/WakeUpScreen";
import { Header }          from "./imports/importsComponents";
import { useAuth }         from "./imports/importsContext";
import { useStories }      from "./context/StoryContext";
import { useDarkMode }     from "./context/DarkModeContext";
import { useLanguage }     from "./context/LanguageContext";
import { useMessagesData } from "./pages/Chat/hooks/useMessagesData";
import { usePosts }        from "./context/PostsContext";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import { setupIndexedDB }    from "./utils/idbMigration";
import { initializeStorage } from "./utils/idbCleanup";
import { BACKEND_URL }       from "./api/axiosClientGlobal";

import { useSmartScroll } from "./hooks/useSmartScroll";

import {
  Home as HomePage, Profile, ChatPage, VideosPage, CalculsPage, Messages, AuthPage,
  ResetPasswordPage, AuthCallbackPage
} from "./imports/importsPages.js";

import AdminDashboard    from "./pages/Admin/AdminDashboard.jsx";
import StoryViewer       from "./pages/Home/StoryViewer";
import OpportunitiesPage from "./pages/Opportunities/OpportunitiesPage";
import { GlobalModalManager } from "./pages/Home/PostCard";
import {
  markPostNotified,
  shouldNotifyForPost,
} from "./utils/postNotificationPreferences";

export const HOME_REFRESH_EVENT    = "home:refresh";
export const HOME_SCROLL_TOP_EVENT = "home:scrollTop";

export const emitHomeRefresh = () =>
  window.dispatchEvent(new CustomEvent(HOME_REFRESH_EVENT));

// ============================================
// PRÉCHARGEMENT
// ============================================
const preloadPages = () => {
  const pages = [
    () => import("./pages/Chat/Messages"),
    () => import("./pages/Chat/ChatPage"),
    () => import("./pages/Videos/VideosPage"),
    () => import("./pages/Calculs/CalculsPage"),
  ];
  pages.forEach((load) => { try { load(); } catch (_) {} });
};

// ============================================
// ✅ CHUNK ERROR BOUNDARY
// ============================================
class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    if (
      error?.name === "TypeError" &&
      error?.message?.includes("Failed to fetch dynamically imported module")
    ) {
      return { hasError: true };
    }
    return { hasError: false };
  }

  componentDidCatch(error) {
    if (error?.message?.includes("Failed to fetch dynamically imported module")) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ============================================
// ICÔNES 3D SVG
// ============================================
const Icon3D = memo(({ gradient, shadow, children, size = 40 }) => (
  <span
    className="flex items-center justify-center rounded-2xl flex-shrink-0 relative overflow-hidden"
    style={{
      width: size, height: size,
      background: gradient,
      boxShadow: `0 4px 14px ${shadow}40, 0 1px 3px ${shadow}30, inset 0 1px 0 rgba(255,255,255,0.35)`,
    }}
  >
    <span className="absolute top-0 left-0 right-0 rounded-t-2xl pointer-events-none"
      style={{ height: "45%", background: "linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.0) 100%)" }}
    />
    {children}
  </span>
));
Icon3D.displayName = "Icon3D";

const NAV_ICON_CONFIGS = {
  home: {
    gradient: "linear-gradient(145deg, #ff7a18 0%, #f43f5e 100%)",
    shadow: "#f97316",
    icon: (size) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" fill="rgba(255,255,255,0.95)" />
        <path d="M9 21V12h6v9" fill="rgba(255,255,255,0.5)" />
      </svg>
    ),
  },
  chat: {
    gradient: "linear-gradient(145deg, #6366f1 0%, #8b5cf6 100%)",
    shadow: "#6366f1",
    icon: (size) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill="rgba(255,255,255,0.95)" />
        <circle cx="8" cy="10" r="1" fill="rgba(99,102,241,0.6)" />
        <circle cx="12" cy="10" r="1" fill="rgba(99,102,241,0.6)" />
        <circle cx="16" cy="10" r="1" fill="rgba(99,102,241,0.6)" />
      </svg>
    ),
  },
  videos: {
    gradient: "linear-gradient(145deg, #06b6d4 0%, #0ea5e9 100%)",
    shadow: "#06b6d4",
    icon: (size) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="15" height="14" rx="2" fill="rgba(255,255,255,0.95)" />
        <path d="M17 9l5-3v12l-5-3V9z" fill="rgba(255,255,255,0.7)" />
      </svg>
    ),
  },
  calculs: {
    gradient: "linear-gradient(145deg, #10b981 0%, #059669 100%)",
    shadow: "#10b981",
    icon: (size) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="2" width="16" height="20" rx="2" fill="rgba(255,255,255,0.95)" />
        <rect x="7" y="5" width="10" height="4" rx="1" fill="rgba(16,185,129,0.5)" />
        <rect x="7" y="12" width="3" height="3" rx="0.5" fill="rgba(255,255,255,0.55)" />
        <rect x="10.5" y="12" width="3" height="3" rx="0.5" fill="rgba(255,255,255,0.55)" />
        <rect x="14" y="12" width="3" height="3" rx="0.5" fill="rgba(255,255,255,0.55)" />
        <rect x="7" y="16" width="3" height="3" rx="0.5" fill="rgba(255,255,255,0.55)" />
        <rect x="10.5" y="16" width="3" height="3" rx="0.5" fill="rgba(255,255,255,0.55)" />
        <rect x="14" y="16" width="3" height="3" rx="0.5" fill="rgba(255,255,255,0.55)" />
      </svg>
    ),
  },
  messages: {
    gradient: "linear-gradient(145deg, #f59e0b 0%, #ef4444 100%)",
    shadow: "#f59e0b",
    icon: (size) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" fill="rgba(255,255,255,0.95)" />
        <path d="M2 6l10 7 10-7" stroke="rgba(245,158,11,0.7)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  profile: {
    gradient: "linear-gradient(145deg, #ec4899 0%, #a855f7 100%)",
    shadow: "#ec4899",
    icon: (size) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" fill="rgba(255,255,255,0.95)" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="rgba(255,255,255,0.7)" />
      </svg>
    ),
  },
  opportunities: {
    gradient: "linear-gradient(145deg, #f59e0b 0%, #f97316 100%)",
    shadow: "#f59e0b",
    icon: (size) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="7" width="20" height="14" rx="2" fill="rgba(255,255,255,0.95)" />
        <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"
          stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        <line x1="12" y1="12" x2="12" y2="16"
          stroke="rgba(245,158,11,0.7)" strokeWidth="2" strokeLinecap="round" />
        <line x1="10" y1="14" x2="14" y2="14"
          stroke="rgba(245,158,11,0.7)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  admin: {
    gradient: "linear-gradient(145deg, #f43f5e 0%, #dc2626 100%)",
    shadow: "#f43f5e",
    icon: (size) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 2l2.5 5 5.5.8-4 3.9.9 5.5L12 15l-4.9 2.2.9-5.5L4 7.8 9.5 7z" fill="rgba(255,255,255,0.95)" />
      </svg>
    ),
  },
};

// ============================================
// SKELETON
// ============================================
const PageSkeleton = memo(({ isDarkMode }) => (
  <div className={`flex flex-col gap-4 p-4 ${isDarkMode ? "bg-gray-900" : "bg-gray-50"}`} style={{ minHeight: "100%" }}>
    {[1, 2, 3].map((i) => (
      <div key={i} className={`rounded-2xl ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`}
        style={{ height: 120, opacity: 1 - i * 0.2, animation: "skeleton-pulse 1.4s ease-in-out infinite", animationDelay: `${i * 150}ms` }}
      />
    ))}
    <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }`}</style>
  </div>
));
PageSkeleton.displayName = "PageSkeleton";

// ============================================
// BOUTON RETOUR FLOTTANT
// ============================================
const FloatingBackButton = memo(({ isDarkMode, onBack }) => {
  const { t } = useTranslation();
  return (
    <motion.button
      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={onBack}
      className="fixed z-[90] flex items-center gap-2 pl-2 pr-4 py-2 rounded-full transition-all active:scale-95"
      style={{
        top:    "max(16px, env(safe-area-inset-top, 16px))",
        left:   16,
        background: "transparent",
        border: "none",
        color:  isDarkMode ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.55)",
      }}
    >
      <span className="flex items-center justify-center w-7 h-7 rounded-full"
        style={{ background: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
        <ArrowLeft size={16} strokeWidth={2.5} />
      </span>
      <span className="text-sm font-semibold">{t("common.back")}</span>
    </motion.button>
  );
});
FloatingBackButton.displayName = "FloatingBackButton";

const LANGUAGE_PROMPT_KEY = "chantilink_language_prompt_v1";
const LANGUAGE_PROMPT_DELAY_MS = 45000;
const LANGUAGE_PROMPT_MIN_NAV = 3;

const getLanguagePromptUserId = (user) => user?._id || user?.id || user?.email || "anonymous";

const SmartLanguagePrompt = memo(({ user, isDarkMode }) => {
  const { language, supportedLanguages, changeLanguage, isChanging } = useLanguage();
  const [open, setOpen] = useState(false);
  const navCountRef = useRef(0);
  const timerRef = useRef(null);
  const dismissedRef = useRef(false);
  const location = useLocation();

  const userKey = getLanguagePromptUserId(user);

  const hasPromptBeenDismissed = useCallback(() => {
    if (!user) return true;
    if (dismissedRef.current) return true;
    try {
      const stored = JSON.parse(localStorage.getItem(LANGUAGE_PROMPT_KEY) || "{}");
      return stored?.userId === userKey && stored?.dismissed === true;
    } catch {
      return false;
    }
  }, [user, userKey]);

  useEffect(() => {
    if (!user) return;
    dismissedRef.current = hasPromptBeenDismissed();
    if (dismissedRef.current) {
      setOpen(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      if (!hasPromptBeenDismissed() && navCountRef.current >= LANGUAGE_PROMPT_MIN_NAV) setOpen(true);
    }, LANGUAGE_PROMPT_DELAY_MS);

    return () => clearTimeout(timerRef.current);
  }, [hasPromptBeenDismissed, user]);

  useEffect(() => {
    if (!user || open || hasPromptBeenDismissed()) return;
    navCountRef.current += 1;
    if (navCountRef.current >= LANGUAGE_PROMPT_MIN_NAV && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (!hasPromptBeenDismissed()) setOpen(true);
      }, 1200);
    }
  }, [hasPromptBeenDismissed, location.pathname, user, open]);

  const persistChoice = useCallback((langCode, dismissed = true) => {
    dismissedRef.current = dismissed;
    clearTimeout(timerRef.current);
    try {
      localStorage.setItem(LANGUAGE_PROMPT_KEY, JSON.stringify({
        userId: userKey,
        language: langCode,
        dismissed,
        at: Date.now(),
      }));
    } catch {}
  }, [userKey]);

  const selectLanguage = useCallback(async (langCode) => {
    await changeLanguage(langCode, { sync: true });
    persistChoice(langCode, true);
    window.dispatchEvent(new CustomEvent("feed:language-changed", { detail: { language: langCode } }));
    setOpen(false);
  }, [changeLanguage, persistChoice]);

  const dismiss = useCallback(() => {
    persistChoice(language, true);
    setOpen(false);
  }, [language, persistChoice]);

  if (!open || !user) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[500] flex items-center justify-center p-4"
        style={{ background: "rgba(15,23,42,0.58)", backdropFilter: "blur(10px)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className="w-full max-w-md overflow-hidden rounded-[28px] shadow-2xl"
          style={{
            background: isDarkMode ? "#0b1120" : "#ffffff",
            border: isDarkMode ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em]" style={{ color: "#f97316" }}>
                  Préférence de navigation
                </p>
                <h2 className="mt-2 text-xl font-black" style={{ color: isDarkMode ? "#f8fafc" : "#0f172a" }}>
                  Dans quelle langue voulez-vous continuer ?
                </h2>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-full p-2 transition-colors"
                style={{ color: isDarkMode ? "#94a3b8" : "#64748b", background: isDarkMode ? "rgba(255,255,255,0.06)" : "#f1f5f9" }}
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-3 text-sm leading-6" style={{ color: isDarkMode ? "#94a3b8" : "#64748b" }}>
              Ce choix adapte automatiquement les vidéos, textes et publications du feed. Les vidéos des services externes seront priorisées dans cette langue, avec une forte orientation génie civil.
            </p>

            <div className="mt-5 grid gap-2">
              {supportedLanguages.map((lang) => {
                const active = language === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    disabled={isChanging}
                    onClick={() => selectLanguage(lang.code)}
                    className="flex items-center justify-between rounded-2xl px-4 py-3 text-left transition-all"
                    style={{
                      background: active ? "rgba(249,115,22,0.13)" : (isDarkMode ? "rgba(255,255,255,0.05)" : "#f8fafc"),
                      border: active ? "1px solid rgba(249,115,22,0.45)" : (isDarkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0"),
                      color: isDarkMode ? "#f8fafc" : "#0f172a",
                    }}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xl">{lang.flag}</span>
                      <span className="font-bold">{lang.label}</span>
                    </span>
                    {active && <span className="text-xs font-black uppercase" style={{ color: "#f97316" }}>Actuelle</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});
SmartLanguagePrompt.displayName = "SmartLanguagePrompt";

// ============================================
// useBackendReady
// ============================================
function useBackendReady() {
  const [serverReady, setServerReady] = useState(false);
  const [showWakeUp,  setShowWakeUp]  = useState(false);
  const pollingRef    = useRef(null);
  const mountedRef    = useRef(true);
  const firstPingDone = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const ping = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${BACKEND_URL}/api/health`, { method: "GET", signal: controller.signal });
        clearTimeout(timer);
        if (res.ok && mountedRef.current) {
          clearInterval(pollingRef.current);
          setServerReady(true);
          setShowWakeUp(false);
        }
      } catch {
        if (!firstPingDone.current && mountedRef.current) setShowWakeUp(true);
      } finally {
        firstPingDone.current = true;
      }
    };
    const showDelay = setTimeout(() => {
      if (!firstPingDone.current && mountedRef.current) setShowWakeUp(true);
    }, 1500);
    ping();
    pollingRef.current = setInterval(ping, 3000);
    return () => {
      mountedRef.current = false;
      clearInterval(pollingRef.current);
      clearTimeout(showDelay);
    };
  }, []);

  return { serverReady, showWakeUp };
}

// ============================================
// APP
// ============================================
export default function App() {
  const [ready, setReady] = useState(false);
  const { isDarkMode } = useDarkMode();
  const { serverReady, showWakeUp } = useBackendReady();

  useEffect(() => {
    setReady(true);
    Promise.all([
      setupIndexedDB().catch(() => console.warn("IDB init failed")),
      initializeStorage().catch((err) => console.error("❌ [App] Erreur init storage:", err)),
    ]).catch(() => {});
    const timer = setTimeout(preloadPages, 1000);
    const fixVh = () => document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    fixVh();
    window.addEventListener("resize", fixVh, { passive: true });
    return () => { window.removeEventListener("resize", fixVh); clearTimeout(timer); };
  }, []);

  if (!ready) return null;
  if (showWakeUp && !serverReady) return <WakeUpScreen isDarkMode={isDarkMode} />;

  return (
    <Suspense fallback={null}>
      <AppContent />
    </Suspense>
  );
}

function AppContent() {
  const { user, token, socket, ready: authReady } = useAuth();
  const { isDarkMode }  = useDarkMode();
  const { t }           = useTranslation();
  const location        = useLocation();
  const navigate        = useNavigate();
  const { deleteSlide } = useStories();

  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerData, setStoryViewerData] = useState({ stories: [], owner: null });
  const [liveNotifications, setLiveNotifications] = useState([]);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  useEffect(() => {
    const onOpen  = () => setLightboxOpen(true);
    const onClose = () => setLightboxOpen(false);
    window.addEventListener("lightbox:open",  onOpen);
    window.addEventListener("lightbox:close", onClose);
    return () => {
      window.removeEventListener("lightbox:open",  onOpen);
      window.removeEventListener("lightbox:close", onClose);
    };
  }, []);

  const { navbarVisible } = useSmartScroll();

  useEffect(() => {
    if (typeof window.__hideSplash === "function") window.__hideSplash();
  }, []);

  const { data: messagesData } = useMessagesData(token, null);
  const unreadCount = useMemo(() => {
    if (!messagesData?.conversations) return undefined;
    return messagesData.conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);
  }, [messagesData?.conversations]);

  const [liveUnreadCount, setLiveUnreadCount] = useState(null);
  useEffect(() => {
    if (liveUnreadCount === null && unreadCount !== undefined) setLiveUnreadCount(unreadCount);
  }, [unreadCount, liveUnreadCount]);

  useEffect(() => {
    if (!socket) return;
    const onMsg  = () => setLiveUnreadCount((p) => (p ?? 0) + 1);
    const onRead = (d) => setLiveUnreadCount(typeof d?.unreadCount === "number" ? d.unreadCount : 0);
    socket.on("receiveMessage", onMsg);
    socket.on("messagesRead",   onRead);
    return () => { socket.off("receiveMessage", onMsg); socket.off("messagesRead", onRead); };
  }, [socket]);

  const unreadChannel = useRef(null);
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    unreadChannel.current = new BroadcastChannel("chantilink_unread");
    unreadChannel.current.onmessage = (e) => {
      if (typeof e.data === "number") setLiveUnreadCount(e.data);
    };
    return () => { unreadChannel.current?.close(); unreadChannel.current = null; };
  }, []);
  useEffect(() => {
    if (!unreadChannel.current || liveUnreadCount === null) return;
    unreadChannel.current.postMessage(liveUnreadCount);
  }, [liveUnreadCount]);

  const safeUnread = Math.max(0, liveUnreadCount ?? 0);

  const notificationQueue = useRef([]);
  const notificationTimer = useRef(null);
  const addNotification = useCallback((notification) => {
    notificationQueue.current.push(notification);
    if (notificationTimer.current) clearTimeout(notificationTimer.current);
    notificationTimer.current = setTimeout(() => {
      if (!notificationQueue.current.length) return;
      const grouped = notificationQueue.current.reduce((acc, n) => {
        if (!acc[n.type]) acc[n.type] = [];
        acc[n.type].push(n);
        return acc;
      }, {});
      Object.entries(grouped).forEach(([type, notifs]) => {
        const count   = notifs.length;
        const groupedLabel = type === "message"
          ? t("messages.title").toLowerCase()
          : type === "post" || type === "post_suggestion"
            ? "publications"
            : "stories";
        const message = count > 1
          ? `${count} ${groupedLabel}`
          : notifs[0].message;
        const id = Date.now() + Math.random();
        setLiveNotifications((prev) => [...prev.slice(-4), { id, type, message, timestamp: Date.now() }]);
        setTimeout(() => setLiveNotifications((prev) => prev.filter((n) => n.id !== id)), 5000);
      });
      notificationQueue.current = [];
    }, 300);
  }, [t]);

  useEffect(() => {
    if (!socket) return;
    const onMsg   = (d) => {
      if (location.pathname !== "/messages")
        addNotification({ type: "message", message: `${d.senderName || t("common.someone")} ${t("common.sent_message")}` });
    };
    const onStory = (d) => {
      if (location.pathname !== "/")
        addNotification({ type: "story", message: `${d.userName || t("common.someone")} ${t("common.posted_story")}` });
    };
    socket.on("new_message", onMsg);
    socket.on("new_story",   onStory);
    return () => {
      socket.off("new_message", onMsg);
      socket.off("new_story",   onStory);
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
    };
  }, [socket, location.pathname, addNotification, t]);

  useEffect(() => {
    const notifyPost = (post) => {
      const notification = shouldNotifyForPost(post, user);
      if (!notification) return;
      markPostNotified(post._id);
      addNotification(notification);

      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("Chantilink", {
            body: notification.message,
            tag: `post-${post._id}`,
          });
        } catch {}
      }
    };

    const onLocalPostNotification = (e) => {
      const { post, type = "post", message } = e.detail || {};
      if (!post?._id || !message) return;
      addNotification({ type, message });
    };

    window.addEventListener("post:notify", onLocalPostNotification);

    if (!socket) {
      return () => window.removeEventListener("post:notify", onLocalPostNotification);
    }

    const onNewPost = (payload) => {
      const post = payload?.post || payload?.data || payload;
      notifyPost(post);
    };

    socket.on("new_post", onNewPost);
    socket.on("newPost", onNewPost);
    socket.on("post_created", onNewPost);
    socket.on("postCreated", onNewPost);

    return () => {
      window.removeEventListener("post:notify", onLocalPostNotification);
      socket.off("new_post", onNewPost);
      socket.off("newPost", onNewPost);
      socket.off("post_created", onNewPost);
      socket.off("postCreated", onNewPost);
    };
  }, [socket, user, addNotification]);

  const handleCloseStory = useCallback(() => setStoryViewerOpen(false), []);

  const homeRefreshPending = useRef(false);
  const handleHomeClick = useCallback(() => {
    if (location.pathname === "/") {
      window.dispatchEvent(new CustomEvent(HOME_SCROLL_TOP_EVENT));
      if (homeRefreshPending.current) return;
      homeRefreshPending.current = true;
      setTimeout(() => {
        homeRefreshPending.current = false;
        window.dispatchEvent(new CustomEvent(HOME_REFRESH_EVENT));
      }, 300);
    } else {
      navigate("/");
    }
  }, [location.pathname, navigate]);

  const isHome          = location.pathname === "/";
  const isAuth          = location.pathname === "/auth";
  const isVideos        = location.pathname === "/videos";
  const isMessages      = location.pathname === "/messages";
  const isCalculs       = location.pathname === "/calculs";
  const isChat          = location.pathname === "/chat";
  const isProfile       = location.pathname.startsWith("/profile");
  const isAdminPage     = location.pathname.startsWith("/admin");
  const isOpportunities = location.pathname === "/opportunities";
  const isAdmin         = user?.role === "admin" || user?.role === "superadmin";

  const showNav    = !!user && !isAuth && !storyViewerOpen && isHome;
  const showHeader = !!user && !isAuth && !storyViewerOpen && isHome;

  const showBackButton = !!user
    && !isAuth
    && !isHome
    && !isVideos
    && !isMessages
    && !isCalculs
    && !isChat
    && !isProfile
    && !isAdminPage
    && !isOpportunities
    && !storyViewerOpen
    && !lightboxOpen;

  const handleBack = useCallback(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  const mainStyle = useMemo(() => ({
    top: showHeader ? 72 : 0,
    bottom: showNav
      ? (navbarVisible ? 64 : 0)
      : 0,
    transition: "bottom 220ms cubic-bezier(0.4,0,0.2,1)",
    overflowX: "hidden",
    overflowY: isHome ? "hidden" : "auto",
    WebkitOverflowScrolling: "touch",
    paddingBottom: isHome ? 0 : "env(safe-area-inset-bottom)",
  }), [showHeader, showNav, isHome, navbarVisible]);

  return (
    <div className={`fixed inset-0 overflow-hidden ${isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>

      {/* NOTIFICATIONS LIVE */}
      <AnimatePresence>
        {liveNotifications.map((notif) => (
          <LiveNotification
            key={notif.id}
            notification={notif}
            isDarkMode={isDarkMode}
            onClose={() => setLiveNotifications((prev) => prev.filter((n) => n.id !== notif.id))}
          />
        ))}
      </AnimatePresence>

      <SmartLanguagePrompt user={user} isDarkMode={isDarkMode} />

      {/* HEADER */}
      {showHeader && (
        <div
          className="fixed top-0 right-0 z-40 lg:left-[260px] left-0"
          style={{ height: 72 }}
        >
          <Header />
        </div>
      )}

      {/* BOUTON RETOUR FLOTTANT */}
      <AnimatePresence>
        {showBackButton && (
          <FloatingBackButton
            key={location.pathname}
            isDarkMode={isDarkMode}
            onBack={handleBack}
          />
        )}
      </AnimatePresence>

      {/* SIDEBAR DESKTOP */}
      {showNav && (
        <SidebarDesktopMemo
          isDarkMode={isDarkMode}
          isAdminUser={isAdmin}
          unreadCount={safeUnread}
          onHomeClick={handleHomeClick}
          currentUser={user}
        />
      )}

      {/* CONTENU PRINCIPAL */}
      <main className="absolute left-0 right-0 z-10" style={mainStyle}>
        <div className={`${showNav ? "lg:ml-[260px]" : ""} ${isHome ? "h-full" : ""}`}>
          <ChunkErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes location={location}>
                <Route path="/auth" element={
                  <AuthRoute redirectIfAuthenticated authReady={authReady} isDarkMode={isDarkMode}>
                    <AuthPage />
                  </AuthRoute>
                } />
                <Route path="/login" element={
                  <AuthRoute redirectIfAuthenticated authReady={authReady} isDarkMode={isDarkMode}>
                    <AuthPage />
                  </AuthRoute>
                } />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/" element={
                  <AuthRoute authReady={authReady} isDarkMode={isDarkMode}>
                    <HomePage
                      openStoryViewer={(s, o) => {
                        setStoryViewerData({ stories: s, owner: o });
                        setStoryViewerOpen(true);
                      }}
                    />
                  </AuthRoute>
                } />
                <Route path="/chat"            element={<AuthRoute authReady={authReady} isDarkMode={isDarkMode}><ChatPage /></AuthRoute>} />
                <Route path="/videos"          element={<AuthRoute authReady={authReady} isDarkMode={isDarkMode}><VideosPage /></AuthRoute>} />
                <Route path="/calculs"         element={<AuthRoute authReady={authReady} isDarkMode={isDarkMode}><CalculsPage /></AuthRoute>} />
                <Route path="/messages"        element={<AuthRoute authReady={authReady} isDarkMode={isDarkMode}><Messages /></AuthRoute>} />
                <Route path="/profile/:userId" element={<AuthRoute authReady={authReady} isDarkMode={isDarkMode}><Profile /></AuthRoute>} />
                <Route path="/admin/*"         element={
                  <AuthRoute authReady={authReady} isDarkMode={isDarkMode}>
                    <ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>
                  </AuthRoute>
                } />
                <Route path="/opportunities" element={
                  <AuthRoute authReady={authReady} isDarkMode={isDarkMode}>
                    <OpportunitiesPage />
                  </AuthRoute>
                } />
                <Route path="*" element={<Navigate to={user ? "/" : "/auth"} replace />} />
              </Routes>
            </Suspense>
          </ChunkErrorBoundary>
        </div>
      </main>

      {/* NAVBAR MOBILE */}
      {showNav && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50"
          style={{
            transform:  navbarVisible ? "translateY(0)" : "translateY(100%)",
            transition: "transform 220ms cubic-bezier(0.4,0,0.2,1)",
            willChange: "transform",
          }}
        >
          <NavbarMobileMemo
            isDarkMode={isDarkMode}
            isAdminUser={isAdmin}
            user={user}
            location={location}
            unreadCount={safeUnread}
            onHomeClick={handleHomeClick}
          />
        </div>
      )}

      {/* STORY VIEWER */}
      {storyViewerOpen && (
        <StoryViewer
          stories={storyViewerData.stories}
          currentUser={user}
          onClose={handleCloseStory}
          onDelete={async (id, idx) => await deleteSlide(id, idx)}
        />
      )}

      <GlobalModalManager />
    </div>
  );
}

// ============================================
// LIVE NOTIFICATION
// ============================================
const LiveNotification = memo(({ notification, isDarkMode, onClose }) => {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: 100 }} animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, x: 100 }} transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed top-20 right-4 z-[100] max-w-sm" onClick={onClose}
    >
      <div className={`relative flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border cursor-pointer overflow-hidden ${
        isDarkMode ? "bg-gray-800/95 border-gray-700" : "bg-white/95 border-gray-200"
      }`}>
        <div className={`flex-shrink-0 p-2 rounded-full ${
          notification.type === "message" ? "bg-orange-500/20 text-orange-500" : "bg-blue-500/20 text-blue-500"
        }`}>
          {notification.type === "message" ? <MessageSquare size={18} /> : <Bell size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>{notification.message}</p>
          <p className={`text-xs mt-0.5 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{t("common.just_now")}</p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 origin-left rounded-b-2xl"
          style={{ background: "linear-gradient(90deg, #f97316, #ec4899)", animation: "notif-progress 5s linear forwards" }}
        />
        <style>{`@keyframes notif-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
      </div>
    </motion.div>
  );
});
LiveNotification.displayName = "LiveNotification";

// ============================================
// BADGE
// ============================================
const Badge = memo(({ count }) => {
  if (!count || count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-black border-2"
      style={{ minWidth: 18, height: 18, fontSize: 10, background: "linear-gradient(135deg, #f43f5e, #fb923c)", borderColor: "inherit", lineHeight: 1, padding: "0 3px", boxShadow: "0 2px 6px rgba(244,63,94,0.5)" }}>
      {count > 99 ? "99+" : count}
    </span>
  );
});
Badge.displayName = "Badge";

// ============================================
// NAVBAR MOBILE
// ============================================
const NavBtn = memo(({ icon: Icon, label, active, onClick, badge, isDarkMode }) => (
  <button onClick={onClick}
    className="relative flex flex-col items-center justify-center flex-1 gap-1 py-2 select-none active:scale-95 transition-transform"
    style={{ WebkitTapHighlightColor: "transparent" }}>
    <span className="relative">
      <Icon size={24} strokeWidth={active ? 2.5 : 1.8} fill={active ? "currentColor" : "none"}
        className={`transition-all duration-150 ${active ? "text-orange-500" : isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
      <Badge count={badge} />
    </span>
    <span className={`text-[10px] font-semibold transition-colors duration-150 ${active ? "text-orange-500" : isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
      {label}
    </span>
  </button>
));
NavBtn.displayName = "NavBtn";

const NavbarMobileMemo = memo(({ isDarkMode, isAdminUser, user, location, unreadCount, onHomeClick }) => {
  const { t }     = useTranslation();
  const navigate  = useNavigate();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const isActive  = useCallback((path) => location.pathname === path, [location.pathname]);
  const goVideos  = useCallback(() => navigate("/videos"), [navigate]);
  const goChat    = useCallback(() => navigate("/chat"),   [navigate]);
  const openMenu  = useCallback(() => setMenuOpen(true),  []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <>
      <nav
        className={`lg:hidden flex justify-around items-stretch border-t ${isDarkMode ? "bg-gray-900/95 border-gray-800/80" : "bg-white/95 border-gray-100"}`}
        style={{ height: 64, backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <NavBtn icon={Home}          label={t("navbar.home")}   active={isActive("/")}       onClick={onHomeClick} isDarkMode={isDarkMode} />
        <NavBtn icon={Video}         label={t("videos.title")}  active={isActive("/videos")} onClick={goVideos}    isDarkMode={isDarkMode} />
        <NavBtn icon={MessageSquare} label={t("navbar.chat")}   active={isActive("/chat")}   onClick={goChat}      isDarkMode={isDarkMode} />
        <NavBtn icon={Menu}          label={t("navbar.more")}   active={false}               onClick={openMenu}    badge={unreadCount} isDarkMode={isDarkMode} />
      </nav>
      {isMenuOpen && (
        <MenuOverlay user={user} isAdminUser={isAdminUser} isDarkMode={isDarkMode} onClose={closeMenu} unreadCount={unreadCount} />
      )}
    </>
  );
});
NavbarMobileMemo.displayName = "NavbarMobileMemo";

// ============================================
// NAV ITEM DESKTOP
// ============================================
const NavItemDesktop = memo(({ iconKey, label, onClick, isDarkMode, active, badge }) => {
  const cfg = NAV_ICON_CONFIGS[iconKey] || NAV_ICON_CONFIGS.home;
  return (
    <button onClick={onClick}
      className={`group relative flex items-center gap-4 w-full px-3 py-3 rounded-2xl transition-all duration-200 active:scale-[0.97] ${
        active ? isDarkMode ? "bg-white/6" : "bg-black/[0.05]" : isDarkMode ? "hover:bg-white/5" : "hover:bg-black/[0.04]"
      }`} style={{ WebkitTapHighlightColor: "transparent" }}>
      <span className="relative flex-shrink-0">
        <Icon3D gradient={cfg.gradient} shadow={cfg.shadow} size={42}>{cfg.icon(20)}</Icon3D>
        {!!badge && badge > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-black"
            style={{ minWidth: 18, height: 18, fontSize: 10, background: "linear-gradient(135deg, #f43f5e, #fb923c)", boxShadow: "0 2px 6px rgba(244,63,94,0.5)", border: `2px solid ${isDarkMode ? "#111827" : "#ffffff"}`, padding: "0 3px" }}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className={`text-[16px] leading-none transition-all duration-200 ${active ? "font-black" : "font-semibold"}`}
        style={{ color: active ? isDarkMode ? "#ffffff" : "#111827" : isDarkMode ? "rgba(255,255,255,0.60)" : "rgba(0,0,0,0.55)" }}>
        {label}
      </span>
      {active && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
          style={{ background: cfg.gradient, boxShadow: `0 0 8px ${cfg.shadow}80` }} />
      )}
    </button>
  );
});
NavItemDesktop.displayName = "NavItemDesktop";

// ============================================
// SIDEBAR DESKTOP
// ============================================
const SidebarDesktopMemo = memo(({ isDarkMode, isAdminUser, unreadCount, onHomeClick, currentUser }) => {
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive        = useCallback((path) => location.pathname === path, [location.pathname]);
  const goChat          = useCallback(() => navigate("/chat"),          [navigate]);
  const goVideos        = useCallback(() => navigate("/videos"),        [navigate]);
  const goCalculs       = useCallback(() => navigate("/calculs"),       [navigate]);
  const goMessages      = useCallback(() => navigate("/messages"),      [navigate]);
  const goAdmin         = useCallback(() => navigate("/admin"),         [navigate]);
  const goOpportunities = useCallback(() => navigate("/opportunities"), [navigate]);

  const goProfile = useCallback(() => {
    if (currentUser?._id) navigate(`/profile/${currentUser._id}`);
  }, [navigate, currentUser?._id]);

  const NAV_ITEMS = useMemo(() => [
    { key: "home",          label: t("navbar.home"),     onClick: onHomeClick,    path: "/" },
    { key: "chat",          label: t("navbar.chat"),     onClick: goChat,         path: "/chat" },
    { key: "videos",        label: t("videos.title"),    onClick: goVideos,       path: "/videos" },
    { key: "calculs",       label: t("navbar.calculs"),  onClick: goCalculs,      path: "/calculs" },
    { key: "messages",      label: t("navbar.messages"), onClick: goMessages,     path: "/messages", badge: unreadCount },
    { key: "opportunities", label: "Opportunités",       onClick: goOpportunities, path: "/opportunities" },
    { key: "profile",       label: t("navbar.profile"),  onClick: goProfile,      path: "/profile" },
  ], [t, onHomeClick, goChat, goVideos, goCalculs, goMessages, goProfile, goOpportunities, unreadCount]);

  return (
    <aside
      className={`hidden lg:flex fixed left-0 top-0 bottom-0 w-[260px] flex-col z-30 border-r ${isDarkMode ? "border-gray-800/50" : "border-gray-200/80"}`}
      style={{ background: isDarkMode ? "linear-gradient(180deg, #0d0d0f 0%, #111115 100%)" : "linear-gradient(180deg, #ffffff 0%, #f9f9fb 100%)" }}
    >

      <nav className="flex flex-col px-3 py-4 flex-1 overflow-hidden">
        <div className="flex flex-col justify-between h-full">
          <div className="flex flex-col gap-1.5">
            {NAV_ITEMS.map((item) => (
              <NavItemDesktop key={item.key} iconKey={item.key} label={item.label} onClick={item.onClick}
                isDarkMode={isDarkMode}
                active={
                  item.path === "/"
                    ? isActive("/")
                    : item.path === "/profile"
                      ? location.pathname.includes("/profile")
                      : isActive(item.path)
                }
                badge={item.badge}
              />
            ))}
            {isAdminUser && (
              <>
                <div className={`w-full h-px my-2 ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
                <NavItemDesktop iconKey="admin" label="Admin" onClick={goAdmin} isDarkMode={isDarkMode} active={location.pathname.includes("/admin")} />
              </>
            )}
          </div>
          <div className={`pt-3 pb-2 border-t ${isDarkMode ? "border-gray-800/60" : "border-gray-100"}`}>
            <p className={`text-[12px] font-semibold px-3 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>© {new Date().getFullYear()} Chantilink</p>
          </div>
        </div>
      </nav>
    </aside>
  );
});
SidebarDesktopMemo.displayName = "SidebarDesktopMemo";

// ============================================
// MENU OVERLAY
// ============================================
const MenuOverlay = memo(({ user, isAdminUser, isDarkMode, onClose, unreadCount }) => {
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const items = useMemo(() => {
    const base = [
      { label: t("navbar.profile"),  iconKey: "profile",       path: `/profile/${user?._id}` },
      { label: "Opportunités",       iconKey: "opportunities", path: "/opportunities" },
      { label: t("navbar.calculs"),  iconKey: "calculs",       path: "/calculs" },
      { label: t("navbar.messages"), iconKey: "messages",      path: "/messages", badge: unreadCount },
    ];
    if (isAdminUser) base.push({ label: "Admin", iconKey: "admin", path: "/admin" });
    return base;
  }, [user?._id, isAdminUser, unreadCount, t]);

  return (
    <div className="fixed inset-0 z-[110] flex items-end">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, ease: "easeOut" }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
        className={`relative w-full rounded-t-3xl pb-8 px-6 pt-4 ${isDarkMode ? "bg-gray-900" : "bg-white"}`}
        style={{ boxShadow: "0 -12px 48px rgba(0,0,0,0.25)", paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
        <div className={`mx-auto mb-5 rounded-full ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: 36, height: 4 }} />
        <button onClick={onClose}
          className={`absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full ${isDarkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
          <X size={16} />
        </button>
        <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{t("messages.nav_label")}</p>
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => {
            const cfg = NAV_ICON_CONFIGS[item.iconKey] || NAV_ICON_CONFIGS.home;
            return (
              <button key={item.path} onClick={() => { navigate(item.path); onClose(); }}
                className={`relative flex flex-col items-center gap-3 py-4 px-2 rounded-2xl transition-all active:scale-95 ${isDarkMode ? "bg-gray-800/70 hover:bg-gray-800" : "bg-gray-50 hover:bg-gray-100"}`}
                style={{ WebkitTapHighlightColor: "transparent" }}>
                <Icon3D gradient={cfg.gradient} shadow={cfg.shadow} size={46}>{cfg.icon(22)}</Icon3D>
                <span className={`text-xs font-bold ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>{item.label}</span>
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute top-2 right-2 flex items-center justify-center rounded-full text-white font-black text-[10px] border-2"
                    style={{ minWidth: 18, height: 18, background: "linear-gradient(135deg, #f43f5e, #fb923c)", borderColor: isDarkMode ? "#1f2937" : "#fff", padding: "0 3px" }}>
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
});
MenuOverlay.displayName = "MenuOverlay";

// ============================================
// AUTH ROUTE
// ============================================
function AuthRoute({ children, redirectIfAuthenticated = false, authReady, isDarkMode }) {
  const { user } = useAuth();
  if (!authReady) return <PageSkeleton isDarkMode={isDarkMode} />;
  if (redirectIfAuthenticated && user) return <Navigate to="/" replace />;
  if (!redirectIfAuthenticated && !user) return <Navigate to="/auth" replace />;
  return children;
}