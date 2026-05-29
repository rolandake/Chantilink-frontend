import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CameraIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ShieldCheckIcon,
  SparklesIcon,
  MapPinIcon,
  CalendarIcon,
  ChartBarIcon,
  UserGroupIcon,
  UserPlusIcon,
  FlagIcon,
  EllipsisVerticalIcon,
  ChatBubbleLeftRightIcon
} from "@heroicons/react/24/outline";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";
import { useDarkMode } from "../../context/DarkModeContext";
import { useAuth } from "../../context/AuthContext";
import { ReportUserModal } from "./ReportUserModal";
import axios from "axios";
import { profileApiPath } from "./profileApi";
const API_URL = profileApiPath("").replace(/\/$/, "");
const EMOJIS = ["\u{1F60A}", "\u{1F525}", "\u{1F4A1}", "\u{1F389}", "\u{1F680}", "\u2764\uFE0F", "\u{1F60E}", "\u2728", "\u{1F3B5}"];
const debug = (section, msg, data) => {
  const style = "background:#f97316;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold";
  if (data !== void 0) console.log(`%c[ProfileHeader:${section}]`, style, msg, data);
  else console.log(`%c[ProfileHeader:${section}]`, style, msg);
};
function getUploadErrorMessage(err) {
  if (err.code === "ERR_NETWORK" || err.message === "Network Error")
    return "Serveur indisponible. R\xE9essayez dans quelques secondes.";
  if (err.code === "ECONNABORTED" || err.message?.includes("timeout"))
    return "Upload trop long. V\xE9rifiez votre connexion ou r\xE9duisez la taille du fichier.";
  if (err.response?.data?.message) return err.response.data.message;
  if (err.response?.data?.error) return err.response.data.error;
  if (err.response?.status === 401) return "Session expir\xE9e. Reconnectez-vous.";
  if (err.response?.status === 413) return "Fichier trop volumineux pour le serveur.";
  if (err.response?.status === 500) return "Erreur serveur lors de l'upload. R\xE9essayez.";
  return err.message || "Erreur lors de l'upload";
}
function formatCount(n) {
  if (!n) return "0";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}
function bustCache(url) {
  if (!url) return url;
  const base = url.replace(/[?&]v=\d+/, "").replace(/[?&]t=\d+/, "");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}v=${Date.now()}`;
}
function withCacheVersion(url, version) {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (!version) return url;
  const raw = typeof version === "number" ? version : Date.parse(version);
  if (!Number.isFinite(raw)) return url;
  const base = url.replace(/[?&]v=\d+/, "").replace(/[?&]t=\d+/, "");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}v=${raw}`;
}
const FollowersModal = ({
  isOpen,
  onClose,
  type,
  users,
  currentUserId,
  currentUserFollowing = [],
  onFollowToggle,
  isDarkMode
}) => {
  const navigate = useNavigate();
  const [followingStates, setFollowingStates] = useState({});
  const [loadingStates, setLoadingStates] = useState({});
  useEffect(() => {
    if (isOpen && users.length > 0) {
      const states = {};
      const followingIds = new Set(
        currentUserFollowing.map((f) => typeof f === "object" ? f._id : f)
      );
      users.forEach((u) => {
        states[u._id || u.id] = followingIds.has(u._id || u.id);
      });
      setFollowingStates(states);
    }
  }, [isOpen, users, currentUserId, currentUserFollowing]);
  const handleFollowToggle = async (userId) => {
    if (loadingStates[userId]) return;
    setLoadingStates((prev) => ({ ...prev, [userId]: true }));
    try {
      const isFollowing = followingStates[userId];
      await onFollowToggle(userId, !isFollowing);
      setFollowingStates((prev) => ({ ...prev, [userId]: !isFollowing }));
    } catch (err) {
      console.error("Erreur follow toggle:", err);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [userId]: false }));
    }
  };
  if (!isOpen) return null;
  return /* @__PURE__ */ React.createElement(AnimatePresence, null, /* @__PURE__ */ React.createElement(
    motion.div,
    {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      className: "fixed inset-0 z-50 flex items-center justify-center p-4",
      style: { background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" },
      onClick: onClose
    },
    /* @__PURE__ */ React.createElement(
      motion.div,
      {
        initial: { scale: 0.9, opacity: 0, y: 20 },
        animate: { scale: 1, opacity: 1, y: 0 },
        exit: { scale: 0.9, opacity: 0, y: 20 },
        onClick: (e) => e.stopPropagation(),
        style: {
          width: "100%",
          maxWidth: 480,
          maxHeight: "80vh",
          borderRadius: 28,
          overflow: "hidden",
          background: isDarkMode ? "rgba(15,15,15,0.98)" : "rgba(255,255,255,0.98)",
          border: isDarkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)"
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: {
        padding: "20px 24px 16px",
        borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: isDarkMode ? "rgba(20,20,20,0.95)" : "rgba(250,250,250,0.95)",
        backdropFilter: "blur(20px)"
      } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("div", { style: {
        width: 36,
        height: 36,
        borderRadius: 12,
        background: "linear-gradient(135deg, #f97316, #ec4899)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      } }, /* @__PURE__ */ React.createElement(UserGroupIcon, { style: { width: 18, height: 18, color: "#fff" } })), /* @__PURE__ */ React.createElement("h2", { style: { fontSize: 18, fontWeight: 800, color: isDarkMode ? "#fff" : "#111" } }, type === "followers" ? "Abonn\xE9s" : "Abonnements"), /* @__PURE__ */ React.createElement("span", { style: {
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: isDarkMode ? "rgba(249,115,22,0.15)" : "rgba(249,115,22,0.1)",
        color: "#f97316"
      } }, users.length)), /* @__PURE__ */ React.createElement(
        motion.button,
        {
          onClick: onClose,
          whileHover: { scale: 1.1, rotate: 90 },
          whileTap: { scale: 0.9 },
          style: {
            width: 36,
            height: 36,
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            background: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            color: isDarkMode ? "#9ca3af" : "#6b7280",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }
        },
        /* @__PURE__ */ React.createElement(XMarkIcon, { style: { width: 18, height: 18 } })
      )),
      /* @__PURE__ */ React.createElement("div", { style: { overflowY: "auto", maxHeight: "calc(80vh - 80px)", padding: "12px 16px" } }, users.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "48px 0", color: isDarkMode ? "#4b5563" : "#9ca3af" } }, /* @__PURE__ */ React.createElement(UserGroupIcon, { style: { width: 48, height: 48, margin: "0 auto 12px", opacity: 0.4 } }), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14 } }, type === "followers" ? "Aucun abonn\xE9 pour le moment" : "Aucun abonnement pour le moment")) : /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, users.map((user) => {
        const userId = user._id || user.id;
        const isOwnP = userId === currentUserId;
        const isFollow = followingStates[userId] || false;
        const isLoading = loadingStates[userId] || false;
        return /* @__PURE__ */ React.createElement(
          motion.div,
          {
            key: userId,
            initial: { opacity: 0, x: -16 },
            animate: { opacity: 1, x: 0 },
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderRadius: 18,
              background: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              border: isDarkMode ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.05)",
              transition: "all 0.2s"
            }
          },
          /* @__PURE__ */ React.createElement(
            "div",
            {
              style: { display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer" },
              onClick: () => {
                navigate(`/profile/${userId}`);
                onClose();
              }
            },
            /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React.createElement(
              "img",
              {
                src: user.profilePhoto || "/default-avatar.png",
                alt: user.fullName,
                style: { width: 46, height: 46, borderRadius: 14, objectFit: "cover", border: "2px solid rgba(249,115,22,0.3)" }
              }
            ), (user.isPremium || user.isVerified) && /* @__PURE__ */ React.createElement("div", { style: {
              position: "absolute",
              bottom: -3,
              right: -3,
              width: 18,
              height: 18,
              borderRadius: 6,
              background: "linear-gradient(135deg,#f97316,#ec4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: isDarkMode ? "2px solid #0f0f0f" : "2px solid #fff"
            } }, user.isPremium ? /* @__PURE__ */ React.createElement(SparklesIcon, { style: { width: 10, height: 10, color: "#fff" } }) : /* @__PURE__ */ React.createElement(ShieldCheckIcon, { style: { width: 10, height: 10, color: "#fff" } }))),
            /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14, fontWeight: 700, color: isDarkMode ? "#fff" : "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, user.fullName), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 12, color: isDarkMode ? "#6b7280" : "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "@", user.username || user.email?.split("@")[0] || "user"))
          ),
          !isOwnP && /* @__PURE__ */ React.createElement(
            motion.button,
            {
              onClick: () => handleFollowToggle(userId),
              disabled: isLoading,
              whileHover: { scale: 1.05 },
              whileTap: { scale: 0.95 },
              style: {
                padding: "7px 16px",
                borderRadius: 50,
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
                background: isFollow ? isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" : "linear-gradient(135deg,#f97316,#ec4899)",
                color: isFollow ? isDarkMode ? "#9ca3af" : "#6b7280" : "#fff",
                display: "flex",
                alignItems: "center",
                gap: 4,
                boxShadow: isFollow ? "none" : "0 4px 12px rgba(249,115,22,0.35)"
              }
            },
            isLoading ? /* @__PURE__ */ React.createElement("div", { style: { width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" } }) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(UserPlusIcon, { style: { width: 13, height: 13 } }), isFollow ? "Abonn\xE9" : "Suivre")
          )
        );
      })))
    )
  ));
};
function ProfileHeader({
  user,
  isOwnProfile = false,
  posts = [],
  followers = [],
  following = [],
  showToast,
  onUserUpdated
}) {
  const { isDarkMode } = useDarkMode();
  const { updateUserProfile, getToken, user: authUser } = useAuth();
  const navigate = useNavigate();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [resolvedProfilePhoto, setResolvedProfilePhoto] = useState(
    user?.profilePhoto || "/default-avatar.png"
  );
  const [resolvedCoverPhoto, setResolvedCoverPhoto] = useState(
    user?.coverPhoto || "/default-cover.jpg"
  );
  const [localPhoto, setLocalPhoto] = useState(null);
  const [localCoverPhoto, setLocalCoverPhoto] = useState(null);
  useEffect(() => {
    const sourceUrl = user?.profilePhoto || (isOwnProfile ? authUser?.profilePhoto : null);
    const version = user?.profilePhotoUpdatedAt || user?.updatedAt || authUser?.updatedAt;
    const url = localPhoto || withCacheVersion(sourceUrl, version) || "/default-avatar.png";
    debug("Photo", "\u{1F5BC} resolvedProfilePhoto =", url);
    setResolvedProfilePhoto(url);
  }, [localPhoto, isOwnProfile, authUser?.profilePhoto, authUser?.updatedAt, user?.profilePhoto, user?.profilePhotoUpdatedAt, user?.updatedAt]);
  useEffect(() => {
    const sourceUrl = user?.coverPhoto || (isOwnProfile ? authUser?.coverPhoto : null);
    const version = user?.coverPhotoUpdatedAt || user?.updatedAt || authUser?.updatedAt;
    const url = localCoverPhoto || withCacheVersion(sourceUrl, version) || "/default-cover.jpg";
    debug("Photo", "\u{1F5BC} resolvedCoverPhoto =", url);
    setResolvedCoverPhoto(url);
  }, [localCoverPhoto, isOwnProfile, authUser?.coverPhoto, authUser?.updatedAt, user?.coverPhoto, user?.coverPhotoUpdatedAt, user?.updatedAt]);
  useEffect(() => {
    debug("Reset", `\u{1F504} Reset photos locales (user._id chang\xE9: ${user?._id})`);
    setLocalPhoto(null);
    setLocalCoverPhoto(null);
  }, [user?._id]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [userPosts, setUserPosts] = useState(posts);
  const [userFollowers, setUserFollowers] = useState(followers);
  const [userFollowing, setUserFollowing] = useState(following);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [editData, setEditData] = useState({
    fullName: user?.fullName || "",
    username: user?.username || "",
    bio: user?.bio || "",
    location: user?.location || "",
    website: user?.website || ""
  });
  const profileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const optionsMenuRef = useRef(null);
  useEffect(() => {
    debug("AuthUser", "\u{1F464} authUser mis \xE0 jour", {
      profilePhoto: authUser?.profilePhoto,
      coverPhoto: authUser?.coverPhoto
    });
  }, [authUser?.profilePhoto, authUser?.coverPhoto]);
  useEffect(() => {
    if (!isEditingProfile) {
      setEditData({
        fullName: user?.fullName || "",
        username: user?.username || "",
        bio: user?.bio || "",
        location: user?.location || "",
        website: user?.website || ""
      });
    }
  }, [user?.fullName, user?.username, user?.bio, user?.location, user?.website, isEditingProfile]);
  const handleSendMessage = useCallback(() => {
    if (!user) {
      showToast?.("Impossible d'envoyer un message", "error");
      return;
    }
    navigate("/messages", {
      state: {
        selectedContact: {
          id: user._id || user.id,
          fullName: user.fullName,
          username: user.username,
          profilePhoto: user.profilePhoto,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen
        },
        openChat: true
      }
    });
  }, [user, navigate, showToast]);
  const handleReportUser = useCallback(async (reportData) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expir\xE9e");
      await axios.post(`${API_URL}/reports/user`, reportData, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      showToast?.("Signalement envoy\xE9. Merci pour votre aide ! \u{1F64F}", "success");
      setShowReportModal(false);
      setShowOptionsMenu(false);
    } catch (err) {
      throw new Error(err.response?.data?.message || "Erreur lors du signalement");
    }
  }, [getToken, showToast]);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target))
        setShowOptionsMenu(false);
    };
    if (showOptionsMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showOptionsMenu]);
  const fetchUserStats = useCallback(async () => {
    if (!user?._id) return;
    setLoadingStats(true);
    setStatsError(null);
    try {
      const token = await getToken();
      const [postsRes, followersRes, followingRes] = await Promise.allSettled([
        axios.get(`${API_URL}/posts/user/${user._id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, timeout: 1e4 }),
        axios.get(`${API_URL}/users/${user._id}/followers`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, timeout: 1e4 }),
        axios.get(`${API_URL}/users/${user._id}/following`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, timeout: 1e4 })
      ]);
      if (postsRes.status === "fulfilled")
        setUserPosts(Array.isArray(postsRes.value.data?.posts || postsRes.value.data?.data) ? postsRes.value.data?.posts || postsRes.value.data?.data : []);
      if (followersRes.status === "fulfilled")
        setUserFollowers(Array.isArray(followersRes.value.data?.followers || followersRes.value.data?.data) ? followersRes.value.data?.followers || followersRes.value.data?.data : []);
      if (followingRes.status === "fulfilled")
        setUserFollowing(Array.isArray(followingRes.value.data?.following || followingRes.value.data?.data) ? followingRes.value.data?.following || followingRes.value.data?.data : []);
    } catch (err) {
      setStatsError(err.message);
    } finally {
      setLoadingStats(false);
    }
  }, [user?._id, getToken]);
  useEffect(() => {
    if (user?._id && (!posts.length || !followers.length || !following.length)) fetchUserStats();
    else {
      setUserPosts(posts);
      setUserFollowers(followers);
      setUserFollowing(following);
    }
  }, [user?._id, posts, followers, following, fetchUserStats]);
  const handleFollowToggle = useCallback(async (userId, shouldFollow) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expir\xE9e");
      await axios.post(`${API_URL}/users/${userId}/follow`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      await fetchUserStats();
      showToast?.(shouldFollow ? "Abonn\xE9 ! \u{1F389}" : "D\xE9sabonn\xE9", "success");
    } catch (err) {
      showToast?.("Erreur lors de l'action", "error");
      throw err;
    }
  }, [getToken, fetchUserStats, showToast]);
  const stats = {
    posts: userPosts.length,
    followers: userFollowers.length,
    following: userFollowing.length,
    likes: userPosts.reduce((s, p) => s + (Array.isArray(p.likes) ? p.likes.length : p.likes || 0), 0)
  };
  const graphData = [
    { name: "Posts", value: stats.posts },
    { name: "Abonn\xE9s", value: stats.followers },
    { name: "Abonnements", value: stats.following },
    { name: "Likes", value: stats.likes }
  ];
  const handleProfilePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast?.("Fichier non valide. Image requise.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast?.("Fichier trop volumineux (5 Mo max)", "error");
      return;
    }
    debug("Upload", "\u{1F4E4} D\xE9but upload photo profil", { name: file.name, size: file.size });
    const blobUrl = URL.createObjectURL(file);
    setLocalPhoto(blobUrl);
    setIsUploadingProfile(true);
    try {
      const formData = new FormData();
      formData.append("profilePhoto", file);
      const token = await getToken();
      if (!token) throw new Error("Session expir\xE9e");
      debug("Upload", "\u{1F310} Envoi requ\xEAte PUT /images...");
      const response = await axios.put(
        `${API_URL}/users/${user._id}/images`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }, timeout: 6e4 }
      );
      debug("Upload", "\u2705 R\xE9ponse serveur re\xE7ue", {
        status: response.status,
        hasUser: !!response.data?.user,
        profilePhoto: response.data?.user?.profilePhoto
      });
      if (response.data?.user) {
        URL.revokeObjectURL(blobUrl);
        const serverUrl = response.data.user.profilePhoto;
        debug("Upload", "\u{1F517} URL serveur profilePhoto =", serverUrl);
        const freshUrl = serverUrl ? bustCache(serverUrl) : null;
        debug("Upload", "\u{1F504} freshUrl avec cache-bust =", freshUrl);
        setLocalPhoto(freshUrl);
        onUserUpdated?.({
          ...response.data.user,
          profilePhoto: serverUrl
        });
        updateUserProfile(user._id, {
          profilePhoto: serverUrl,
          profilePhotoPublicId: response.data.user.profilePhotoPublicId
        });
        debug("Upload", "\u2705 Contexte Auth mis \xE0 jour");
      } else {
        debug("Upload", "\u26A0\uFE0F R\xE9ponse sans user \u2014 on garde le blob");
      }
      showToast?.("\u2705 Photo de profil mise \xE0 jour !", "success");
    } catch (err) {
      debug("Upload", "\u274C Erreur upload profilePhoto", {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
      URL.revokeObjectURL(blobUrl);
      setLocalPhoto(null);
      showToast?.(getUploadErrorMessage(err), "error");
    } finally {
      setIsUploadingProfile(false);
      if (profileInputRef.current) profileInputRef.current.value = null;
    }
  };
  const handleCoverPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast?.("Fichier non valide. Image requise.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast?.("Fichier trop volumineux (5 Mo max)", "error");
      return;
    }
    debug("Upload", "\u{1F4E4} D\xE9but upload couverture", { name: file.name, size: file.size });
    const blobUrl = URL.createObjectURL(file);
    setLocalCoverPhoto(blobUrl);
    setIsUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("coverPhoto", file);
      const token = await getToken();
      if (!token) throw new Error("Session expir\xE9e");
      debug("Upload", "\u{1F310} Envoi requ\xEAte PUT /images (cover)...");
      const response = await axios.put(
        `${API_URL}/users/${user._id}/images`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }, timeout: 6e4 }
      );
      debug("Upload", "\u2705 R\xE9ponse serveur re\xE7ue (cover)", {
        status: response.status,
        hasUser: !!response.data?.user,
        coverPhoto: response.data?.user?.coverPhoto
      });
      if (response.data?.user) {
        URL.revokeObjectURL(blobUrl);
        const serverUrl = response.data.user.coverPhoto;
        debug("Upload", "\u{1F517} URL serveur coverPhoto =", serverUrl);
        const freshUrl = serverUrl ? bustCache(serverUrl) : null;
        debug("Upload", "\u{1F504} freshUrl cover avec cache-bust =", freshUrl);
        setLocalCoverPhoto(freshUrl);
        onUserUpdated?.({
          ...response.data.user,
          coverPhoto: serverUrl
        });
        updateUserProfile(user._id, {
          coverPhoto: serverUrl,
          coverPhotoPublicId: response.data.user.coverPhotoPublicId
        });
        debug("Upload", "\u2705 Contexte Auth mis \xE0 jour (cover)");
      } else {
        debug("Upload", "\u26A0\uFE0F R\xE9ponse sans user (cover) \u2014 on garde le blob");
      }
      showToast?.("\u2705 Photo de couverture mise \xE0 jour !", "success");
    } catch (err) {
      debug("Upload", "\u274C Erreur upload coverPhoto", {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
      URL.revokeObjectURL(blobUrl);
      setLocalCoverPhoto(null);
      showToast?.(getUploadErrorMessage(err), "error");
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = null;
    }
  };
  const handleSaveProfile = async () => {
    if (!user?._id) {
      showToast?.("Utilisateur introuvable", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fullName: editData.fullName.trim(),
        username: editData.username.trim(),
        bio: editData.bio.trim(),
        location: editData.location.trim(),
        website: editData.website.trim()
      };
      const updated = await updateUserProfile(user._id, payload);
      onUserUpdated?.({
        ...updated?.user || updated || {},
        ...payload,
        _id: user._id
      });
      setIsEditingProfile(false);
      showToast?.("Profil mis \xE0 jour !", "success");
    } catch (err) {
      showToast?.(err.response?.data?.message || err.message || "Erreur lors de la mise \xE0 jour", "error");
    } finally {
      setSaving(false);
    }
  };
  const addEmoji = (emoji) => setEditData((prev) => ({ ...prev, bio: (prev.bio || "") + " " + emoji }));
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long" }) : null;
  const bg = isDarkMode ? "#0a0a0a" : "#fff";
  const text = isDarkMode ? "#f5f5f5" : "#111";
  const sub = isDarkMode ? "#6b7280" : "#9ca3af";
  const card = isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const bdr = isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("style", null, `
        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 0 rgba(249,115,22,0.55); }
          100% { box-shadow: 0 0 0 14px rgba(249,115,22,0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .avatar-ring { animation: pulseRing 2s ease-out infinite; }
        .stat-tile:hover { transform: translateY(-3px) scale(1.03); }
      `), /* @__PURE__ */ React.createElement(
    motion.div,
    {
      initial: { opacity: 0, y: 24 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.45, ease: [0.25, 0.8, 0.25, 1] },
      style: {
        overflow: "hidden",
        border: "none",
        background: bg,
        boxShadow: "none",
        fontFamily: "'Sora', 'DM Sans', sans-serif"
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { position: "relative", height: 150, overflow: "hidden" } }, /* @__PURE__ */ React.createElement(
      motion.img,
      {
        src: resolvedCoverPhoto,
        alt: "Couverture",
        style: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
        whileHover: { scale: 1.04 },
        transition: { duration: 0.6 },
        onLoad: () => debug("Img", "\u2705 Cover charg\xE9e depuis:", resolvedCoverPhoto),
        onError: (e) => {
          debug("Img", "\u274C Erreur chargement cover:", resolvedCoverPhoto);
          e.target.src = "/default-cover.jpg";
        }
      }
    ), /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      inset: 0,
      background: isDarkMode ? "linear-gradient(to bottom, rgba(10,10,10,0) 30%, rgba(10,10,10,0.95) 100%)" : "linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)"
    } }), /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      inset: 0,
      opacity: 0.25,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`,
      backgroundSize: "160px",
      pointerEvents: "none"
    } }), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: 12, left: 12, display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement(
      motion.button,
      {
        onClick: () => navigate(-1),
        whileHover: { scale: 1.06 },
        whileTap: { scale: 0.94 },
        "aria-label": "Retour",
        style: {
          width: 38,
          height: 38,
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(12px)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          fontSize: 24,
          lineHeight: 1
        }
      },
      "\u2190"
    )), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: 12, right: 12, display: "flex", gap: 8 } }, !isOwnProfile && /* @__PURE__ */ React.createElement("div", { style: { position: "relative" }, ref: optionsMenuRef }, /* @__PURE__ */ React.createElement(
      motion.button,
      {
        onClick: () => setShowOptionsMenu(!showOptionsMenu),
        whileHover: { scale: 1.08 },
        whileTap: { scale: 0.92 },
        style: {
          width: 40,
          height: 40,
          borderRadius: 50,
          border: "none",
          cursor: "pointer",
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(12px)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.3)"
        }
      },
      /* @__PURE__ */ React.createElement(EllipsisVerticalIcon, { style: { width: 18, height: 18 } })
    ), /* @__PURE__ */ React.createElement(AnimatePresence, null, showOptionsMenu && /* @__PURE__ */ React.createElement(
      motion.div,
      {
        initial: { opacity: 0, scale: 0.92, y: -8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.92, y: -8 },
        style: {
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: 220,
          borderRadius: 18,
          overflow: "hidden",
          zIndex: 20,
          background: isDarkMode ? "#1a1a1a" : "#fff",
          border: `1px solid ${bdr}`,
          boxShadow: "0 16px 48px rgba(0,0,0,0.35)"
        }
      },
      /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => {
            setShowReportModal(true);
            setShowOptionsMenu(false);
          },
          style: {
            width: "100%",
            padding: "14px 18px",
            border: "none",
            cursor: "pointer",
            background: "transparent",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: isDarkMode ? "#e5e7eb" : "#374151",
            fontSize: 14,
            fontWeight: 500,
            transition: "background 0.15s"
          },
          onMouseEnter: (e) => e.currentTarget.style.background = isDarkMode ? "rgba(255,255,255,0.04)" : "#f9fafb",
          onMouseLeave: (e) => e.currentTarget.style.background = "transparent"
        },
        /* @__PURE__ */ React.createElement(FlagIcon, { style: { width: 18, height: 18, color: "#ef4444" } }),
        "Signaler cet utilisateur"
      )
    ))), isOwnProfile && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("input", { ref: coverInputRef, type: "file", accept: "image/*", onChange: handleCoverPhotoChange, style: { display: "none" } }), /* @__PURE__ */ React.createElement(
      motion.button,
      {
        onClick: () => coverInputRef.current?.click(),
        disabled: isUploadingCover,
        whileHover: { scale: 1.08 },
        whileTap: { scale: 0.92 },
        style: {
          width: 40,
          height: 40,
          borderRadius: 50,
          border: "none",
          cursor: isUploadingCover ? "not-allowed" : "pointer",
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(12px)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: isUploadingCover ? 0.6 : 1,
          boxShadow: "0 2px 12px rgba(0,0,0,0.3)"
        }
      },
      isUploadingCover ? /* @__PURE__ */ React.createElement("div", { style: { width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" } }) : /* @__PURE__ */ React.createElement(CameraIcon, { style: { width: 18, height: 18 } })
    )))),
    /* @__PURE__ */ React.createElement("div", { style: { padding: "0 10px 12px", position: "relative" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, marginTop: -36, marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { position: "relative", flexShrink: 0 } }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "avatar-ring",
        style: {
          width: 76,
          height: 76,
          borderRadius: "50%",
          overflow: "hidden",
          border: isDarkMode ? "3px solid #0a0a0a" : "3px solid #fff",
          background: isDarkMode ? "#1a1a1a" : "#f3f4f6",
          boxShadow: "none"
        }
      },
      /* @__PURE__ */ React.createElement(
        "img",
        {
          src: resolvedProfilePhoto,
          alt: user?.fullName,
          style: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
          onLoad: () => debug("Img", "\u2705 Photo profil charg\xE9e depuis:", resolvedProfilePhoto),
          onError: (e) => {
            debug("Img", "\u274C Erreur chargement photo profil:", resolvedProfilePhoto);
            if (e.target.src !== window.location.origin + "/default-avatar.png")
              e.target.src = "/default-avatar.png";
          }
        }
      )
    ), (user?.isPremium || user?.isVerified) && /* @__PURE__ */ React.createElement(
      motion.div,
      {
        initial: { scale: 0 },
        animate: { scale: 1 },
        style: {
          position: "absolute",
          bottom: -3,
          right: -3,
          width: 26,
          height: 26,
          borderRadius: 9,
          background: "linear-gradient(135deg,#f97316,#ec4899)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: isDarkMode ? "3px solid #0a0a0a" : "3px solid #fff",
          boxShadow: "0 2px 8px rgba(249,115,22,0.5)"
        }
      },
      user?.isPremium ? /* @__PURE__ */ React.createElement(SparklesIcon, { style: { width: 13, height: 13, color: "#fff" } }) : /* @__PURE__ */ React.createElement(ShieldCheckIcon, { style: { width: 13, height: 13, color: "#fff" } })
    ), isOwnProfile && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("input", { ref: profileInputRef, type: "file", accept: "image/*", onChange: handleProfilePhotoChange, style: { display: "none" } }), /* @__PURE__ */ React.createElement(
      motion.button,
      {
        onClick: () => profileInputRef.current?.click(),
        disabled: isUploadingProfile,
        whileHover: { scale: 1.1 },
        whileTap: { scale: 0.9 },
        style: {
          position: "absolute",
          bottom: -2,
          right: -2,
          width: 28,
          height: 28,
          borderRadius: 10,
          border: "none",
          cursor: isUploadingProfile ? "not-allowed" : "pointer",
          background: isDarkMode ? "#222" : "#fff",
          color: isDarkMode ? "#d1d5db" : "#374151",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
          opacity: isUploadingProfile ? 0.6 : 1,
          zIndex: 2
        }
      },
      isUploadingProfile ? /* @__PURE__ */ React.createElement("div", { style: { width: 12, height: 12, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" } }) : /* @__PURE__ */ React.createElement(CameraIcon, { style: { width: 13, height: 13 } })
    ))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, paddingBottom: 0 } }, isOwnProfile && /* @__PURE__ */ React.createElement(
      motion.button,
      {
        onClick: () => setIsEditingProfile(true),
        whileHover: { scale: 1.03, y: -1 },
        whileTap: { scale: 0.97 },
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          borderRadius: 999,
          border: `1px solid ${bdr}`,
          cursor: "pointer",
          background: isDarkMode ? "rgba(255,255,255,0.06)" : "#fff",
          color: isDarkMode ? "#f9fafb" : "#111827",
          fontWeight: 700,
          fontSize: 13,
          boxShadow: "none"
        }
      },
      /* @__PURE__ */ React.createElement(PencilIcon, { style: { width: 15, height: 15 } }),
      "Modifier"
    ))), /* @__PURE__ */ React.createElement(AnimatePresence, { mode: "wait" }, isEditingProfile ? /* @__PURE__ */ React.createElement(
      motion.div,
      {
        key: "edit",
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -16 },
        style: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }
      },
      ["fullName", "username", "bio", "location", "website"].map((field) => field === "bio" ? /* @__PURE__ */ React.createElement("div", { key: field }, /* @__PURE__ */ React.createElement(
        "textarea",
        {
          value: editData.bio,
          onChange: (e) => setEditData((prev) => ({ ...prev, bio: e.target.value })),
          maxLength: 300,
          rows: 4,
          placeholder: "Bio...",
          style: {
            width: "100%",
            padding: "12px 16px",
            borderRadius: 16,
            resize: "none",
            background: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
            border: `1.5px solid ${bdr}`,
            color: text,
            fontSize: 14,
            outline: "none",
            fontFamily: "inherit",
            transition: "border-color 0.2s"
          },
          onFocus: (e) => e.target.style.borderColor = "#f97316",
          onBlur: (e) => e.target.style.borderColor = bdr
        }
      ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 8, alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, EMOJIS.map((em) => /* @__PURE__ */ React.createElement(
        motion.button,
        {
          key: em,
          onClick: () => addEmoji(em),
          whileHover: { scale: 1.2 },
          style: { fontSize: 18, background: "none", border: "none", cursor: "pointer", padding: 0 }
        },
        em
      ))), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: sub } }, editData.bio.length, "/300"))) : /* @__PURE__ */ React.createElement(
        "input",
        {
          key: field,
          value: editData[field],
          onChange: (e) => setEditData((prev) => ({ ...prev, [field]: e.target.value })),
          placeholder: field === "fullName" ? "Nom complet" : field === "username" ? "@username" : field,
          style: {
            width: "100%",
            padding: "12px 16px",
            borderRadius: 16,
            background: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
            border: `1.5px solid ${bdr}`,
            color: text,
            fontSize: 14,
            outline: "none",
            fontFamily: "inherit",
            transition: "border-color 0.2s"
          },
          onFocus: (e) => e.target.style.borderColor = "#f97316",
          onBlur: (e) => e.target.style.borderColor = bdr
        }
      )),
      /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 } }, /* @__PURE__ */ React.createElement(
        motion.button,
        {
          onClick: () => {
            setIsEditingProfile(false);
            setEditData({
              fullName: user?.fullName || "",
              username: user?.username || "",
              bio: user?.bio || "",
              location: user?.location || "",
              website: user?.website || ""
            });
          },
          whileHover: { scale: 1.02 },
          whileTap: { scale: 0.98 },
          style: { padding: "9px 20px", borderRadius: 50, border: `1px solid ${bdr}`, cursor: "pointer", background: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", color: sub, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }
        },
        /* @__PURE__ */ React.createElement(XMarkIcon, { style: { width: 15, height: 15 } }),
        " Annuler"
      ), /* @__PURE__ */ React.createElement(
        motion.button,
        {
          onClick: handleSaveProfile,
          disabled: saving,
          whileHover: { scale: 1.02 },
          whileTap: { scale: 0.98 },
          style: { padding: "9px 20px", borderRadius: 50, border: "none", cursor: saving ? "not-allowed" : "pointer", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 14px rgba(34,197,94,0.4)", opacity: saving ? 0.7 : 1 }
        },
        saving ? /* @__PURE__ */ React.createElement("div", { style: { width: 15, height: 15, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" } }) : /* @__PURE__ */ React.createElement(CheckIcon, { style: { width: 15, height: 15 } }),
        "Enregistrer"
      ))
    ) : /* @__PURE__ */ React.createElement(motion.div, { key: "view", initial: { opacity: 0 }, animate: { opacity: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 6 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 } }, /* @__PURE__ */ React.createElement("h1", { style: {
      fontSize: 20,
      fontWeight: 800,
      letterSpacing: 0,
      color: text,
      margin: 0
    } }, user?.fullName || "Utilisateur"), user?.isVerified && /* @__PURE__ */ React.createElement("span", { style: { display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", fontSize: 11, fontWeight: 700, color: "#3b82f6" } }, /* @__PURE__ */ React.createElement(ShieldCheckIcon, { style: { width: 12, height: 12 } }), " V\xE9rifi\xE9"), user?.isPremium && /* @__PURE__ */ React.createElement("span", { style: { display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)", fontSize: 11, fontWeight: 700, color: "#f97316" } }, /* @__PURE__ */ React.createElement(SparklesIcon, { style: { width: 12, height: 12 } }), " Premium")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: sub } }, "@", user?.username || user?.email?.split("@")[0] || "user"), user?.website && /* @__PURE__ */ React.createElement(
      "a",
      {
        href: user.website.startsWith("http") ? user.website : `https://${user.website}`,
        target: "_blank",
        rel: "noopener noreferrer",
        style: { fontSize: 13, color: "#f97316", textDecoration: "none", fontWeight: 600 }
      },
      "\u{1F517} ",
      user.website.replace(/^https?:\/\//, "")
    )), /* @__PURE__ */ React.createElement("div", { style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: 6,
      margin: "8px 0 10px"
    } }, [
      { value: stats.posts, label: "Publications" },
      { value: stats.followers, label: "Abonn\xE9s", modal: "followers" },
      { value: stats.following, label: "Abonnements", modal: "following" }
    ].map((item) => {
      const clickable = !!item.modal;
      const Tag = clickable ? "button" : "div";
      return /* @__PURE__ */ React.createElement(
        Tag,
        {
          key: item.label,
          type: clickable ? "button" : void 0,
          onClick: clickable ? () => {
            setModalType(item.modal);
            setModalOpen(true);
          } : void 0,
          className: "stat-tile",
          style: {
            padding: "4px 2px",
            borderRadius: 0,
            background: "transparent",
            border: "none",
            boxShadow: "none",
            textAlign: "center",
            cursor: clickable ? "pointer" : "default",
            fontFamily: "inherit"
          }
        },
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: text } }, formatCount(item.value)),
        /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, color: sub } }, item.label)
      );
    })), user?.bio && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 13, color: isDarkMode ? "#d1d5db" : "#374151", lineHeight: 1.35, margin: "0 0 4px" } }, user.bio), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", color: sub } }, user?.location && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 7 } }, /* @__PURE__ */ React.createElement(MapPinIcon, { style: { width: 14, height: 14, color: "#f97316" } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13 } }, user.location)), memberSince && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 7 } }, /* @__PURE__ */ React.createElement(CalendarIcon, { style: { width: 14, height: 14, color: "#f97316" } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13 } }, "Membre depuis ", memberSince)), user?.website && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 7 } }, /* @__PURE__ */ React.createElement(
      "a",
      {
        href: user.website.startsWith("http") ? user.website : `https://${user.website}`,
        target: "_blank",
        rel: "noopener noreferrer",
        style: { fontSize: 13, color: "#f97316", textDecoration: "none", fontWeight: 600 }
      },
      "\u{1F517} ",
      user.website.replace(/^https?:\/\//, "")
    )))))), /* @__PURE__ */ React.createElement("div", { style: { display: "none", paddingTop: 20, borderTop: `1px solid ${bdr}` } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 } }, /* @__PURE__ */ React.createElement("h3", { style: { fontSize: 15, fontWeight: 700, color: text, margin: 0, display: "flex", alignItems: "center", gap: 8 } }, "Statistiques", loadingStats && /* @__PURE__ */ React.createElement("div", { style: { width: 14, height: 14, border: "2px solid #f97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" } })), /* @__PURE__ */ React.createElement(
      motion.button,
      {
        onClick: () => setShowStats(!showStats),
        whileHover: { scale: 1.1 },
        whileTap: { scale: 0.9 },
        style: {
          width: 34,
          height: 34,
          borderRadius: 12,
          border: `1px solid ${bdr}`,
          background: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
          color: sub,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      },
      /* @__PURE__ */ React.createElement(ChartBarIcon, { style: { width: 16, height: 16 } })
    )), statsError && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" } }, /* @__PURE__ */ React.createElement("p", { style: { fontSize: 12, color: "#ef4444", margin: 0 } }, "Erreur de chargement des stats")), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 } }, graphData.map((s, i) => /* @__PURE__ */ React.createElement(
      motion.div,
      {
        key: i,
        className: "stat-tile",
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: i * 0.06 },
        onClick: () => {
          if (s.name === "Abonn\xE9s") {
            setModalType("followers");
            setModalOpen(true);
          }
          if (s.name === "Abonnements") {
            setModalType("following");
            setModalOpen(true);
          }
        },
        style: {
          borderRadius: 16,
          padding: "12px 6px",
          textAlign: "center",
          background: card,
          border: `1px solid ${bdr}`,
          cursor: s.name === "Abonn\xE9s" || s.name === "Abonnements" ? "pointer" : "default",
          transition: "all 0.2s"
        }
      },
      /* @__PURE__ */ React.createElement("p", { style: { fontSize: 20, fontWeight: 800, margin: "0 0 4px", background: "linear-gradient(135deg,#f97316,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } }, formatCount(s.value)),
      /* @__PURE__ */ React.createElement("p", { style: { fontSize: 10, color: sub, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" } }, s.name)
    ))), /* @__PURE__ */ React.createElement(AnimatePresence, null, showStats && /* @__PURE__ */ React.createElement(
      motion.div,
      {
        initial: { opacity: 0, height: 0 },
        animate: { opacity: 1, height: "auto" },
        exit: { opacity: 0, height: 0 },
        style: { borderRadius: 20, padding: 16, background: card, border: `1px solid ${bdr}`, overflow: "hidden" }
      },
      /* @__PURE__ */ React.createElement(ResponsiveContainer, { width: "100%", height: 200 }, /* @__PURE__ */ React.createElement(BarChart, { data: graphData }, /* @__PURE__ */ React.createElement(XAxis, { dataKey: "name", tick: { fontSize: 11, fill: sub }, axisLine: false, tickLine: false }), /* @__PURE__ */ React.createElement(
        Tooltip,
        {
          contentStyle: { backgroundColor: isDarkMode ? "rgba(15,15,15,0.97)" : "rgba(255,255,255,0.97)", borderRadius: 14, border: `1px solid ${bdr}`, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" },
          cursor: { fill: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }
        }
      ), /* @__PURE__ */ React.createElement(Bar, { dataKey: "value", fill: "url(#grad)", radius: [10, 10, 0, 0] }), /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: "grad", x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: "#f97316" }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: "#ec4899", stopOpacity: 0.7 })))))
    ))))
  ), /* @__PURE__ */ React.createElement(
    FollowersModal,
    {
      isOpen: modalOpen,
      onClose: () => setModalOpen(false),
      type: modalType,
      users: modalType === "followers" ? userFollowers : userFollowing,
      currentUserId: authUser?._id || authUser?.id,
      currentUserFollowing: userFollowing,
      onFollowToggle: handleFollowToggle,
      isDarkMode
    }
  ), /* @__PURE__ */ React.createElement(
    ReportUserModal,
    {
      isOpen: showReportModal,
      onClose: () => setShowReportModal(false),
      user,
      onSubmit: handleReportUser,
      isDarkMode
    }
  ));
}
export {
  ProfileHeader as default
};
