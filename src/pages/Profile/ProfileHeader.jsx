// src/pages/profile/ProfileHeader.jsx
// v9.2 — mode profil pro : badge "Profil pro" sur couverture, bouton "CV" owner,
//         vue identité pro (titre, statut, compétences, stats) dans AnimatePresence
// FIX v9.1 : balise <a> du lien site web (vue entreprise) qui avait perdu son tag d'ouverture

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  PhoneIcon,
  EnvelopeIcon,
  ClockIcon,
  BuildingOffice2Icon,
  StarIcon,
  BriefcaseIcon,
  DocumentTextIcon, // ✅ icône bouton CV
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import { ReportUserModal } from './ReportUserModal';
import CreateOpportunityModal from './Business/CreateOpportunityModal';
import CVModal from './Pro/CVModal'; // ✅ NOUVEAU
import axios from 'axios';
import { profileApiPath } from './profileApi';

const API_URL      = profileApiPath("").replace(/\/$/, "");
const R2_PUBLIC_URL = (import.meta.env.VITE_R2_PUBLIC_URL || "").replace(/\/+$/, "");
const EMOJIS       = ["😊","🔥","💡","🎉","🚀","❤️","😎","✨","🎵"];

// ─── debug ────────────────────────────────────────────────────────────────────
const debug = (section, msg, data) => {
  const style = 'background:#f97316;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold';
  if (data !== undefined) console.log(`%c[ProfileHeader:${section}]`, style, msg, data);
  else                    console.log(`%c[ProfileHeader:${section}]`, style, msg);
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function getUploadErrorMessage(err) {
  if (err.code === 'ERR_NETWORK' || err.message === 'Network Error')
    return 'Serveur indisponible. Réessayez dans quelques secondes.';
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout'))
    return 'Upload trop long. Vérifiez votre connexion ou réduisez la taille du fichier.';
  if (err.response?.data?.message) return err.response.data.message;
  if (err.response?.data?.error)   return err.response.data.error;
  if (err.response?.status === 401) return 'Session expirée. Reconnectez-vous.';
  if (err.response?.status === 413) return 'Fichier trop volumineux pour le serveur.';
  if (err.response?.status === 500) return "Erreur serveur lors de l'upload. Réessayez.";
  return err.message || "Erreur lors de l'upload";
}

function formatCount(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function resolveImageUrl(url) {
  if (!url) return url;
  const clean = String(url).trim();
  if (!clean || clean.startsWith('blob:') || clean.startsWith('data:')) return clean;
  if (/^https?:\/\//i.test(clean)) return clean;
  if (clean === '/default-avatar.png' || clean === '/default-cover.jpg') return clean;
  const publicId = clean.replace(/^\/+/, '');
  if (R2_PUBLIC_URL && (
    publicId.startsWith('chantilink/') ||
    publicId.startsWith('profile_photos/') ||
    publicId.startsWith('cover_photos/')
  )) return `${R2_PUBLIC_URL}/${publicId}`;
  return `${API_URL.replace(/\/api\/?$/, '')}/${publicId}`;
}

function bustCache(url) {
  if (!url) return url;
  const resolved = resolveImageUrl(url);
  if (!resolved || resolved.startsWith('blob:') || resolved.startsWith('data:')) return resolved;
  const base = resolved.replace(/[?&]v=\d+/, '').replace(/[?&]t=\d+/, '');
  const sep  = base.includes('?') ? '&' : '?';
  return `${base}${sep}v=${Date.now()}`;
}

function withCacheVersion(url, version) {
  const resolved = resolveImageUrl(url);
  if (!resolved || resolved.startsWith('blob:') || resolved.startsWith('data:')) return resolved;
  if (!version) return resolved;
  const raw  = typeof version === 'number' ? version : Date.parse(version);
  if (!Number.isFinite(raw)) return resolved;
  const base = resolved.replace(/[?&]v=\d+/, '').replace(/[?&]t=\d+/, '');
  const sep  = base.includes('?') ? '&' : '?';
  return `${base}${sep}v=${raw}`;
}

// ─── statut dispo pro ─────────────────────────────────────────────────────────
const PRO_STATUS_MAP = {
  open:      { label: "Disponible",     color: "#22c55e", bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.3)"  },
  freelance: { label: "Freelance",      color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)" },
  closed:    { label: "Non disponible", color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)"  },
};

// ─── modal followers / following ──────────────────────────────────────────────
const FollowersModal = ({
  isOpen, onClose, type, users,
  currentUserId, currentUserFollowing = [],
  onFollowToggle, isDarkMode
}) => {
  const navigate = useNavigate();
  const [followingStates, setFollowingStates] = useState({});
  const [loadingStates,   setLoadingStates]   = useState({});

  useEffect(() => {
    if (isOpen && users.length > 0) {
      const states    = {};
      const followIds = new Set(currentUserFollowing.map(f => typeof f === 'object' ? f._id : f));
      users.forEach(u => { states[u._id || u.id] = followIds.has(u._id || u.id); });
      setFollowingStates(states);
    }
  }, [isOpen, users, currentUserId, currentUserFollowing]);

  const handleFollowToggle = async (userId) => {
    if (loadingStates[userId]) return;
    setLoadingStates(prev => ({ ...prev, [userId]: true }));
    try {
      const isFollowing = followingStates[userId];
      await onFollowToggle(userId, !isFollowing);
      setFollowingStates(prev => ({ ...prev, [userId]: !isFollowing }));
    } catch (err) {
      console.error('Erreur follow toggle:', err);
    } finally {
      setLoadingStates(prev => ({ ...prev, [userId]: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 480, maxHeight: '80vh',
            borderRadius: 28, overflow: 'hidden',
            background: isDarkMode ? 'rgba(15,15,15,0.98)' : 'rgba(255,255,255,0.98)',
            border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{
            padding: '20px 24px 16px',
            borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: isDarkMode ? 'rgba(20,20,20,0.95)' : 'rgba(250,250,250,0.95)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: 'linear-gradient(135deg, #f97316, #ec4899)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <UserGroupIcon style={{ width: 18, height: 18, color: '#fff' }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: isDarkMode ? '#fff' : '#111' }}>
                {type === 'followers' ? 'Abonnés' : 'Abonnements'}
              </h2>
              <span style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                background: isDarkMode ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)',
                color: '#f97316',
              }}>{users.length}</span>
            </div>
            <motion.button
              onClick={onClose} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
              style={{
                width: 36, height: 36, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                color: isDarkMode ? '#9ca3af' : '#6b7280',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </motion.button>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 'calc(80vh - 80px)', padding: '12px 16px' }}>
            {users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: isDarkMode ? '#4b5563' : '#9ca3af' }}>
                <UserGroupIcon style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.4 }} />
                <p style={{ fontSize: 14 }}>
                  {type === 'followers' ? 'Aucun abonné' : 'Aucun abonnement'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {users.map((user) => {
                  const userId    = user._id || user.id;
                  const isOwnP    = userId === currentUserId;
                  const isFollow  = followingStates[userId] || false;
                  const isLoading = loadingStates[userId]   || false;
                  return (
                    <motion.div
                      key={userId}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', borderRadius: 18,
                        background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, cursor: 'pointer' }}
                        onClick={() => { navigate(`/profile/${userId}`); onClose(); }}
                      >
                        <div style={{ position: 'relative' }}>
                          <img
                            src={user.profilePhoto || '/default-avatar.png'}
                            alt={user.fullName}
                            style={{ width: 46, height: 46, borderRadius: 14, objectFit: 'cover', border: '2px solid rgba(249,115,22,0.3)' }}
                          />
                          {(user.isPremium || user.isVerified) && (
                            <div style={{
                              position: 'absolute', bottom: -3, right: -3,
                              width: 18, height: 18, borderRadius: 6,
                              background: 'linear-gradient(135deg,#f97316,#ec4899)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: isDarkMode ? '2px solid #0f0f0f' : '2px solid #fff',
                            }}>
                              {user.isPremium
                                ? <SparklesIcon style={{ width: 10, height: 10, color: '#fff' }} />
                                : <ShieldCheckIcon style={{ width: 10, height: 10, color: '#fff' }} />
                              }
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#fff' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.fullName}
                          </p>
                          <p style={{ fontSize: 12, color: isDarkMode ? '#6b7280' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            @{user.username || user.email?.split('@')[0] || 'user'}
                          </p>
                        </div>
                      </div>
                      {!isOwnP && (
                        <motion.button
                          onClick={() => handleFollowToggle(userId)}
                          disabled={isLoading}
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          style={{
                            padding: '7px 16px', borderRadius: 50, border: 'none', cursor: 'pointer',
                            fontWeight: 700, fontSize: 12,
                            background: isFollow
                              ? (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')
                              : 'linear-gradient(135deg,#f97316,#ec4899)',
                            color: isFollow ? (isDarkMode ? '#9ca3af' : '#6b7280') : '#fff',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          {isLoading
                            ? <div style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            : <><UserPlusIcon style={{ width: 13, height: 13 }} />{isFollow ? 'Abonné' : 'Suivre'}</>
                          }
                        </motion.button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── composant principal ──────────────────────────────────────────────────────
export default function ProfileHeader({
  user,
  isOwnProfile = false,
  posts        = [],
  followers    = [],
  following    = [],
  showToast,
  onUserUpdated,
}) {
  const { isDarkMode }                             = useDarkMode();
  const { updateUserProfile, getToken, user: authUser } = useAuth();
  const navigate                                   = useNavigate();

  // ── détection accountType ────────────────────────────────────────────────
  const isBusiness = user?.accountType === "business";
  const isPro      = user?.accountType === "pro"; // ✅ NOUVEAU
  const bi         = user?.businessInfo || {};
  const pi         = user?.proInfo      || {}; // ✅ NOUVEAU

  // ── photos ──────────────────────────────────────────────────────────────
  const [resolvedProfilePhoto, setResolvedProfilePhoto] = useState(
    user?.profilePhoto || '/default-avatar.png'
  );
  const [resolvedCoverPhoto, setResolvedCoverPhoto] = useState(
    user?.coverPhoto || '/default-cover.jpg'
  );
  const [localPhoto,      setLocalPhoto]      = useState(null);
  const [localCoverPhoto, setLocalCoverPhoto] = useState(null);

  useEffect(() => {
    const sourceUrl = user?.profilePhoto || (isOwnProfile ? authUser?.profilePhoto : null);
    const version   = user?.profilePhotoUpdatedAt || user?.updatedAt || authUser?.updatedAt;
    const url       = localPhoto || withCacheVersion(sourceUrl, version) || '/default-avatar.png';
    setResolvedProfilePhoto(url);
  }, [localPhoto, isOwnProfile, authUser?.profilePhoto, authUser?.updatedAt, user?.profilePhoto, user?.profilePhotoUpdatedAt, user?.updatedAt]);

  useEffect(() => {
    const sourceUrl = user?.coverPhoto || (isOwnProfile ? authUser?.coverPhoto : null);
    const version   = user?.coverPhotoUpdatedAt || user?.updatedAt || authUser?.updatedAt;
    const url       = localCoverPhoto || withCacheVersion(sourceUrl, version) || '/default-cover.jpg';
    setResolvedCoverPhoto(url);
  }, [localCoverPhoto, isOwnProfile, authUser?.coverPhoto, authUser?.updatedAt, user?.coverPhoto, user?.coverPhotoUpdatedAt, user?.updatedAt]);

  useEffect(() => {
    setLocalPhoto(null);
    setLocalCoverPhoto(null);
  }, [user?._id]);

  // ── états divers ─────────────────────────────────────────────────────────
  const [isEditingProfile,      setIsEditingProfile]      = useState(false);
  const [isUploadingProfile,    setIsUploadingProfile]    = useState(false);
  const [isUploadingCover,      setIsUploadingCover]      = useState(false);
  const [saving,                setSaving]                = useState(false);
  const [showStats,             setShowStats]             = useState(false);
  const [modalOpen,             setModalOpen]             = useState(false);
  const [modalType,             setModalType]             = useState(null);
  const [showReportModal,       setShowReportModal]       = useState(false);
  const [showOptionsMenu,       setShowOptionsMenu]       = useState(false);
  const [showOpportunityModal,  setShowOpportunityModal]  = useState(false);
  const [showCVModal,           setShowCVModal]           = useState(false); // ✅ NOUVEAU
  const [userPosts,             setUserPosts]             = useState(posts);
  const [userFollowers,         setUserFollowers]         = useState(followers);
  const [userFollowing,         setUserFollowing]         = useState(following);
  const [loadingStats,          setLoadingStats]          = useState(false);
  const [statsError,            setStatsError]            = useState(null);

  const [editData, setEditData] = useState({
    fullName: user?.fullName || '',
    username: user?.username || '',
    bio:      user?.bio      || '',
    location: user?.location || '',
    website:  user?.website  || '',
  });

  const profileInputRef = useRef(null);
  const coverInputRef   = useRef(null);
  const optionsMenuRef  = useRef(null);

  useEffect(() => {
    if (!isEditingProfile) {
      setEditData({
        fullName: user?.fullName || '',
        username: user?.username || '',
        bio:      user?.bio      || '',
        location: user?.location || '',
        website:  user?.website  || '',
      });
    }
  }, [user?.fullName, user?.username, user?.bio, user?.location, user?.website, isEditingProfile]);

  // ── click outside options menu ──────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target))
        setShowOptionsMenu(false);
    };
    if (showOptionsMenu) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showOptionsMenu]);

  // ── stats ────────────────────────────────────────────────────────────────
  const fetchUserStats = useCallback(async () => {
    if (!user?._id) return;
    setLoadingStats(true); setStatsError(null);
    try {
      const token = await getToken();
      const [postsRes, followersRes, followingRes] = await Promise.allSettled([
        axios.get(`${API_URL}/posts/user/${user._id}`,      { headers: token ? { Authorization: `Bearer ${token}` } : {}, timeout: 10000 }),
        axios.get(`${API_URL}/users/${user._id}/followers`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, timeout: 10000 }),
        axios.get(`${API_URL}/users/${user._id}/following`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, timeout: 10000 }),
      ]);
      if (postsRes.status    === 'fulfilled') setUserPosts(Array.isArray(postsRes.value.data?.posts || postsRes.value.data?.data)    ? (postsRes.value.data?.posts    || postsRes.value.data?.data)    : []);
      if (followersRes.status === 'fulfilled') setUserFollowers(Array.isArray(followersRes.value.data?.followers || followersRes.value.data?.data) ? (followersRes.value.data?.followers || followersRes.value.data?.data) : []);
      if (followingRes.status === 'fulfilled') setUserFollowing(Array.isArray(followingRes.value.data?.following || followingRes.value.data?.data) ? (followingRes.value.data?.following || followingRes.value.data?.data) : []);
    } catch (err) { setStatsError(err.message); }
    finally { setLoadingStats(false); }
  }, [user?._id, getToken]);

  useEffect(() => {
    if (user?._id && (!posts.length || !followers.length || !following.length)) fetchUserStats();
    else { setUserPosts(posts); setUserFollowers(followers); setUserFollowing(following); }
  }, [user?._id, posts, followers, following, fetchUserStats]);

  const handleFollowToggle = useCallback(async (userId, shouldFollow) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expirée");
      await axios.post(`${API_URL}/users/${userId}/follow`, {}, { headers: { Authorization: `Bearer ${token}` }, withCredentials: true });
      await fetchUserStats();
      showToast?.(shouldFollow ? 'Abonné ! 🎉' : 'Désabonné', 'success');
    } catch (err) { showToast?.("Erreur lors de l'action", 'error'); throw err; }
  }, [getToken, fetchUserStats, showToast]);

  const stats = {
    posts:     userPosts.length,
    followers: userFollowers.length,
    following: userFollowing.length,
  };

  // ── upload profil ────────────────────────────────────────────────────────
  const handleProfilePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast?.('Image requise.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024)    { showToast?.('5 Mo max.', 'error'); return; }
    const blobUrl = URL.createObjectURL(file);
    setLocalPhoto(blobUrl);
    setIsUploadingProfile(true);
    try {
      const formData = new FormData();
      formData.append('profilePhoto', file);
      const token = await getToken();
      if (!token) throw new Error("Session expirée");
      const response = await axios.put(
        `${API_URL}/users/${user._id}/images`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }, timeout: 60000 }
      );
      if (response.data?.user) {
        URL.revokeObjectURL(blobUrl);
        const serverUrl = resolveImageUrl(response.data.user.profilePhoto);
        const freshUrl  = serverUrl ? bustCache(serverUrl) : null;
        setLocalPhoto(freshUrl);
        onUserUpdated?.({ ...response.data.user, profilePhoto: serverUrl });
        updateUserProfile(user._id, { profilePhoto: serverUrl, profilePhotoPublicId: response.data.user.profilePhotoPublicId });
      }
      showToast?.('✅ Photo de profil mise à jour !', 'success');
    } catch (err) {
      URL.revokeObjectURL(blobUrl);
      setLocalPhoto(null);
      showToast?.(getUploadErrorMessage(err), 'error');
    } finally {
      setIsUploadingProfile(false);
      if (profileInputRef.current) profileInputRef.current.value = null;
    }
  };

  // ── upload couverture ────────────────────────────────────────────────────
  const handleCoverPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast?.('Image requise.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024)    { showToast?.('5 Mo max.', 'error'); return; }
    const blobUrl = URL.createObjectURL(file);
    setLocalCoverPhoto(blobUrl);
    setIsUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('coverPhoto', file);
      const token = await getToken();
      if (!token) throw new Error("Session expirée");
      const response = await axios.put(
        `${API_URL}/users/${user._id}/images`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }, timeout: 60000 }
      );
      if (response.data?.user) {
        URL.revokeObjectURL(blobUrl);
        const serverUrl = resolveImageUrl(response.data.user.coverPhoto);
        const freshUrl  = serverUrl ? bustCache(serverUrl) : null;
        setLocalCoverPhoto(freshUrl);
        onUserUpdated?.({ ...response.data.user, coverPhoto: serverUrl });
        updateUserProfile(user._id, { coverPhoto: serverUrl, coverPhotoPublicId: response.data.user.coverPhotoPublicId });
      }
      showToast?.('✅ Photo de couverture mise à jour !', 'success');
    } catch (err) {
      URL.revokeObjectURL(blobUrl);
      setLocalCoverPhoto(null);
      showToast?.(getUploadErrorMessage(err), 'error');
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = null;
    }
  };

  // ── sauvegarde profil texte ──────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!user?._id) { showToast?.('Utilisateur introuvable', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        fullName: editData.fullName.trim(),
        username: editData.username.trim(),
        bio:      editData.bio.trim(),
        location: editData.location.trim(),
        website:  editData.website.trim(),
      };
      const updated = await updateUserProfile(user._id, payload);
      onUserUpdated?.({ ...(updated?.user || updated || {}), ...payload, _id: user._id });
      setIsEditingProfile(false);
      showToast?.('Profil mis à jour !', 'success');
    } catch (err) {
      showToast?.(err.response?.data?.message || err.message || 'Erreur lors de la mise à jour', 'error');
    } finally { setSaving(false); }
  };

  const handleReportUser = useCallback(async (reportData) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expirée");
      await axios.post(`${API_URL}/reports/user`, reportData, { headers: { Authorization: `Bearer ${token}` }, withCredentials: true });
      showToast?.('Signalement envoyé. Merci ! 🙏', 'success');
      setShowReportModal(false);
      setShowOptionsMenu(false);
    } catch (err) { throw new Error(err.response?.data?.message || 'Erreur lors du signalement'); }
  }, [getToken, showToast]);

  const addEmoji      = (emoji) => setEditData(prev => ({ ...prev, bio: (prev.bio || '') + ' ' + emoji }));
  const memberSince   = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
    : null;

  // ── couleurs ─────────────────────────────────────────────────────────────
  const bg   = isDarkMode ? '#0a0a0a' : '#fff';
  const text = isDarkMode ? '#f5f5f5' : '#111';
  const sub  = isDarkMode ? '#6b7280' : '#9ca3af';
  const bdr  = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const card = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  // ── statut pro ────────────────────────────────────────────────────────────
  const proStatus = PRO_STATUS_MAP[pi.availableStatus || "closed"];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 0 rgba(249,115,22,0.55); }
          100% { box-shadow: 0 0 0 14px rgba(249,115,22,0); }
        }
        @keyframes pulseRingPro {
          0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.55); }
          100% { box-shadow: 0 0 0 14px rgba(99,102,241,0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .avatar-ring     { animation: pulseRing 2s ease-out infinite; }
        .avatar-ring-pro { animation: pulseRingPro 2s ease-out infinite; }
        .biz-logo-ring   { animation: pulseRing 2s ease-out infinite; }
        .stat-tile:hover { transform: translateY(-3px) scale(1.03); }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.8, 0.25, 1] }}
        style={{ overflow: 'hidden', background: bg, fontFamily: "'Sora', 'DM Sans', sans-serif" }}
      >

        {/* ── COUVERTURE ────────────────────────────────────────────────── */}
        <div style={{ position: 'relative', height: 150, overflow: 'hidden' }}>
          <motion.img
            src={resolvedCoverPhoto}
            alt="Couverture"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            whileHover={{ scale: 1.04 }}
            transition={{ duration: 0.6 }}
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/default-cover.jpg'; }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: isDarkMode
              ? 'linear-gradient(to bottom, rgba(10,10,10,0) 30%, rgba(10,10,10,0.95) 100%)'
              : 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)',
          }} />

          {/* ✅ Badge page entreprise */}
          {isBusiness && (
            <div style={{
              position: 'absolute', top: 12, left: 56,
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(249,115,22,0.9)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              fontSize: 11, fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 20,
            }}>
              <BuildingOffice2Icon style={{ width: 13, height: 13 }} />
              Page entreprise
            </div>
          )}

          {/* ✅ Badge profil pro — violet/indigo */}
          {isPro && (
            <div style={{
              position: 'absolute', top: 12, left: 56,
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(99,102,241,0.88)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              fontSize: 11, fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 20,
            }}>
              <BriefcaseIcon style={{ width: 13, height: 13 }} />
              Profil pro
            </div>
          )}

          {/* Bouton retour */}
          <div style={{ position: 'absolute', top: 12, left: 12 }}>
            <motion.button
              onClick={() => navigate(-1)}
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              style={{
                width: 38, height: 38, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, lineHeight: 1,
              }}
            >←</motion.button>
          </div>

          {/* Boutons droite */}
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8 }}>
            {!isOwnProfile && (
              <div style={{ position: 'relative' }} ref={optionsMenuRef}>
                <motion.button
                  onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                  whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                  style={{
                    width: 40, height: 40, borderRadius: 50, border: 'none', cursor: 'pointer',
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <EllipsisVerticalIcon style={{ width: 18, height: 18 }} />
                </motion.button>
                <AnimatePresence>
                  {showOptionsMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, y: -8 }}
                      style={{
                        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                        width: 220, borderRadius: 18, overflow: 'hidden', zIndex: 20,
                        background: isDarkMode ? '#1a1a1a' : '#fff',
                        border: `1px solid ${bdr}`,
                        boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
                      }}
                    >
                      <button
                        onClick={() => { setShowReportModal(true); setShowOptionsMenu(false); }}
                        style={{
                          width: '100%', padding: '14px 18px', border: 'none', cursor: 'pointer',
                          background: 'transparent', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 10,
                          color: isDarkMode ? '#e5e7eb' : '#374151', fontSize: 14, fontWeight: 500,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.04)' : '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <FlagIcon style={{ width: 18, height: 18, color: '#ef4444' }} />
                        Signaler
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {isOwnProfile && (
              <>
                <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverPhotoChange} style={{ display: 'none' }} />
                <motion.button
                  onClick={() => coverInputRef.current?.click()}
                  disabled={isUploadingCover}
                  whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                  style={{
                    width: 40, height: 40, borderRadius: 50, border: 'none',
                    cursor: isUploadingCover ? 'not-allowed' : 'pointer',
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: isUploadingCover ? 0.6 : 1,
                  }}
                >
                  {isUploadingCover
                    ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    : <CameraIcon style={{ width: 18, height: 18 }} />
                  }
                </motion.button>
              </>
            )}
          </div>
        </div>

        {/* ── BODY ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '0 10px 12px', position: 'relative' }}>

          {/* Avatar / Logo + bouton CTA */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            gap: 14, marginTop: -36, marginBottom: 10,
          }}>

            {/* Avatar/Logo */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                className={
                  isBusiness ? "biz-logo-ring"
                  : isPro     ? "avatar-ring-pro"
                  : "avatar-ring"
                }
                style={{
                  width:        76,
                  height:       76,
                  borderRadius: isBusiness ? 14 : '50%',
                  overflow:     'hidden',
                  border:       isDarkMode ? '3px solid #0a0a0a' : '3px solid #fff',
                  background:   isDarkMode ? '#1a1a1a' : '#f3f4f6',
                }}
              >
                <img
                  src={resolvedProfilePhoto}
                  alt={user?.fullName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    if (e.currentTarget.src !== window.location.origin + '/default-avatar.png')
                      e.currentTarget.src = '/default-avatar.png';
                  }}
                />
              </div>

              {(user?.isPremium || user?.isVerified) && (
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  style={{
                    position: 'absolute', bottom: -3, right: -3,
                    width: 26, height: 26, borderRadius: isBusiness ? 8 : 9,
                    background: isPro
                      ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                      : 'linear-gradient(135deg,#f97316,#ec4899)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: isDarkMode ? '3px solid #0a0a0a' : '3px solid #fff',
                    boxShadow: isPro
                      ? '0 2px 8px rgba(99,102,241,0.5)'
                      : '0 2px 8px rgba(249,115,22,0.5)',
                  }}
                >
                  {user?.isPremium
                    ? <SparklesIcon style={{ width: 13, height: 13, color: '#fff' }} />
                    : <ShieldCheckIcon style={{ width: 13, height: 13, color: '#fff' }} />
                  }
                </motion.div>
              )}

              {isOwnProfile && (
                <>
                  <input ref={profileInputRef} type="file" accept="image/*" onChange={handleProfilePhotoChange} style={{ display: 'none' }} />
                  <motion.button
                    onClick={() => profileInputRef.current?.click()}
                    disabled={isUploadingProfile}
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    style={{
                      position: 'absolute', bottom: -2, right: -2,
                      width: 28, height: 28,
                      borderRadius: isBusiness ? 8 : 10,
                      border: 'none', cursor: isUploadingProfile ? 'not-allowed' : 'pointer',
                      background: isDarkMode ? '#222' : '#fff',
                      color: isDarkMode ? '#d1d5db' : '#374151',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                      opacity: isUploadingProfile ? 0.6 : 1, zIndex: 2,
                    }}
                  >
                    {isUploadingProfile
                      ? <div style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      : <CameraIcon style={{ width: 13, height: 13 }} />
                    }
                  </motion.button>
                </>
              )}
            </div>

            {/* ── Bouton CTA owner : Modifier / Créer opportunité / CV ── */}
            {isOwnProfile && (
              isBusiness ? (
                <motion.button
                  onClick={() => setShowOpportunityModal(true)}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 999,
                    border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg,#f97316,#ec4899)',
                    color: '#fff',
                    fontWeight: 700, fontSize: 13,
                    boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <BriefcaseIcon style={{ width: 15, height: 15 }} />
                  Créer une opportunité
                </motion.button>
              ) : isPro ? (
                // ✅ NOUVEAU — bouton CV profil pro
                <motion.button
                  onClick={() => setShowCVModal(true)}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 999,
                    border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: '#fff',
                    fontWeight: 700, fontSize: 13,
                    boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <DocumentTextIcon style={{ width: 15, height: 15 }} />
                  CV
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => setIsEditingProfile(true)}
                  whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 999,
                    border: `1px solid ${bdr}`, cursor: 'pointer',
                    background: isDarkMode ? 'rgba(255,255,255,0.06)' : '#fff',
                    color: isDarkMode ? '#f9fafb' : '#111827',
                    fontWeight: 700, fontSize: 13,
                  }}
                >
                  <PencilIcon style={{ width: 15, height: 15 }} />
                  Modifier
                </motion.button>
              )
            )}
          </div>

          {/* ── Infos du profil ──────────────────────────────────────── */}
          <AnimatePresence mode="wait">

            {/* ── Formulaire édition ── */}
            {isEditingProfile ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}
              >
                {['fullName', 'username', 'bio', 'location', 'website'].map(field => (
                  field === 'bio' ? (
                    <div key={field}>
                      <textarea
                        value={editData.bio}
                        onChange={e => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                        maxLength={300} rows={4}
                        placeholder={isBusiness ? "Courte description affichée sur votre page…" : "Bio…"}
                        style={{
                          width: '100%', padding: '12px 16px', borderRadius: 16, resize: 'none',
                          background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                          border: `1.5px solid ${bdr}`, color: text, fontSize: 14, outline: 'none',
                          fontFamily: 'inherit',
                        }}
                        onFocus={e => e.target.style.borderColor = '#f97316'}
                        onBlur={e  => e.target.style.borderColor = bdr}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {EMOJIS.map(em => (
                            <motion.button key={em} onClick={() => addEmoji(em)} whileHover={{ scale: 1.2 }}
                              style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                              {em}
                            </motion.button>
                          ))}
                        </div>
                        <span style={{ fontSize: 11, color: sub }}>{editData.bio.length}/300</span>
                      </div>
                    </div>
                  ) : (
                    <input
                      key={field}
                      value={editData[field]}
                      onChange={e => setEditData(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder={field === 'fullName' ? (isBusiness ? "Nom de l'entreprise" : 'Nom complet') : field === 'username' ? '@username' : field}
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: 16,
                        background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        border: `1.5px solid ${bdr}`, color: text, fontSize: 14, outline: 'none',
                        fontFamily: 'inherit',
                      }}
                      onFocus={e => e.target.style.borderColor = '#f97316'}
                      onBlur={e  => e.target.style.borderColor = bdr}
                    />
                  )
                ))}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <motion.button
                    onClick={() => { setIsEditingProfile(false); setEditData({ fullName: user?.fullName || '', username: user?.username || '', bio: user?.bio || '', location: user?.location || '', website: user?.website || '' }); }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{ padding: '9px 20px', borderRadius: 50, border: `1px solid ${bdr}`, cursor: 'pointer', background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', color: sub, fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <XMarkIcon style={{ width: 15, height: 15 }} /> Annuler
                  </motion.button>
                  <motion.button
                    onClick={handleSaveProfile} disabled={saving}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{ padding: '9px 20px', borderRadius: 50, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? <div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <CheckIcon style={{ width: 15, height: 15 }} />}
                    Enregistrer
                  </motion.button>
                </div>
              </motion.div>

            ) : isBusiness ? (
              /* ── Vue page entreprise ── */
              <motion.div key="biz-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: text, margin: 0, letterSpacing: -0.3 }}>
                      {bi.name || user?.fullName || 'Entreprise'}
                    </h1>
                    {user?.isVerified && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>
                        <ShieldCheckIcon style={{ width: 12, height: 12 }} /> Vérifié
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: sub }}>
                    @{user?.username || user?.email?.split('@')[0] || 'user'}
                  </span>
                  {bi.category && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 12px', borderRadius: 20,
                        background: isDarkMode ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.08)',
                        border: '1px solid rgba(249,115,22,0.25)',
                        color: '#f97316', fontSize: 12, fontWeight: 700,
                      }}>
                        <BuildingOffice2Icon style={{ width: 13, height: 13 }} />
                        {bi.category}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 0, margin: '12px 0', borderRadius: 14, overflow: 'hidden', border: `1px solid ${bdr}`, background: card }}>
                  {[
                    { value: stats.posts,     label: 'Publications', modal: null        },
                    { value: stats.followers, label: 'Abonnés',      modal: 'followers' },
                    { value: stats.following, label: 'Abonnements',  modal: 'following' },
                    { value: '★',             label: 'Avis',         modal: null, accent: true },
                  ].map((item, i) => {
                    const clickable = !!item.modal;
                    const Tag = clickable ? 'button' : 'div';
                    return (
                      <Tag
                        key={i}
                        type={clickable ? 'button' : undefined}
                        onClick={clickable ? () => { setModalType(item.modal); setModalOpen(true); } : undefined}
                        className="stat-tile"
                        style={{ padding: '12px 4px', textAlign: 'center', background: item.accent ? (isDarkMode ? 'rgba(249,115,22,0.08)' : 'rgba(249,115,22,0.05)') : 'transparent', cursor: clickable ? 'pointer' : 'default', border: 'none', fontFamily: 'inherit', transition: 'all 0.2s', borderRight: i < 3 ? `1px solid ${bdr}` : 'none' }}
                      >
                        <div style={{ fontSize: 15, fontWeight: 800, color: item.accent ? '#f97316' : text }}>
                          {item.value === '★' ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                              <StarIcon style={{ width: 14, height: 14, color: '#f97316', fill: '#f97316' }} />—
                            </span>
                          ) : formatCount(item.value)}
                        </div>
                        <div style={{ fontSize: 9, color: item.accent ? '#f97316' : sub, marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {item.label}
                        </div>
                      </Tag>
                    );
                  })}
                </div>

                {bi.description && (
                  <p style={{ fontSize: 13, color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: 1.6, margin: '0 0 12px' }}>
                    {bi.description}
                  </p>
                )}

                {(bi.phone || bi.email || bi.openingHours || bi.address) && (
                  <div style={{ borderRadius: 14, border: `1px solid ${bdr}`, overflow: 'hidden', marginBottom: 12 }}>
                    {[
                      { icon: PhoneIcon,    label: bi.phone,        href: bi.phone  ? `tel:${bi.phone}`      : null },
                      { icon: EnvelopeIcon, label: bi.email,        href: bi.email  ? `mailto:${bi.email}`   : null },
                      { icon: ClockIcon,    label: bi.openingHours, href: null                                      },
                      { icon: MapPinIcon,   label: bi.address,      href: null                                      },
                    ].filter(r => r.label).map((row, i, arr) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${bdr}` : 'none', background: card }}>
                        <row.icon style={{ width: 15, height: 15, color: '#f97316', flexShrink: 0 }} />
                        {row.href ? (
                          <a href={row.href} style={{ fontSize: 12, color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>{row.label}</a>
                        ) : (
                          <span style={{ fontSize: 12, color: isDarkMode ? '#d1d5db' : '#374151' }}>{row.label}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {bi.services?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {bi.services.map((s) => (
                      <span key={s} style={{ padding: '4px 10px', borderRadius: 20, background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', border: `1px solid ${bdr}`, color: isDarkMode ? '#d1d5db' : '#374151', fontSize: 11, fontWeight: 600 }}>{s}</span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', color: sub }}>
                  {user?.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPinIcon style={{ width: 13, height: 13, color: '#f97316' }} />
                      <span style={{ fontSize: 12 }}>{user.location}</span>
                    </div>
                  )}
                  {memberSince && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CalendarIcon style={{ width: 13, height: 13, color: '#f97316' }} />
                      <span style={{ fontSize: 12 }}>Depuis {memberSince}</span>
                    </div>
                  )}
                  {(bi.website || user?.website) && (
                    <a
                      href={(() => { const w = bi.website || user.website; return w.startsWith('http') ? w : `https://${w}`; })()}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: '#f97316', textDecoration: 'none', fontWeight: 600 }}
                    >
                      🔗 {(bi.website || user.website).replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </motion.div>

            ) : isPro ? (
              /* ── ✅ Vue profil pro ── */
              <motion.div key="pro-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: text, margin: 0, letterSpacing: -0.3 }}>
                      {user?.fullName || 'Professionnel'}
                    </h1>
                    {user?.isVerified && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>
                        <ShieldCheckIcon style={{ width: 12, height: 12 }} /> Vérifié
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: sub }}>@{user?.username || user?.email?.split('@')[0] || 'user'}</span>
                    {/* badge "Profil pro" inline */}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', fontSize: 11, fontWeight: 700, color: '#6366f1' }}>
                      <BriefcaseIcon style={{ width: 11, height: 11 }} /> Profil pro
                    </span>
                  </div>

                  {/* Titre du poste */}
                  {pi.jobTitle && (
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#6366f1', margin: '0 0 8px' }}>
                      {pi.jobTitle}
                    </p>
                  )}

                  {/* Localisation */}
                  {user?.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <MapPinIcon style={{ width: 13, height: 13, color: '#6366f1' }} />
                      <span style={{ fontSize: 12, color: sub }}>{user.location}</span>
                    </div>
                  )}

                  {/* Compétences (3 premières + compteur) */}
                  {pi.skills?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {pi.skills.slice(0, 3).map((s) => (
                        <span key={s} style={{
                          padding:    '4px 10px', borderRadius: 20,
                          background: 'rgba(99,102,241,0.1)',
                          border:     '1px solid rgba(99,102,241,0.2)',
                          color:      '#6366f1', fontSize: 11, fontWeight: 600,
                        }}>{s}</span>
                      ))}
                      {pi.skills.length > 3 && (
                        <span style={{
                          padding:    '4px 10px', borderRadius: 20,
                          background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                          border:     `1px solid ${bdr}`,
                          color:      sub, fontSize: 11, fontWeight: 600,
                        }}>+{pi.skills.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Stats : Projets / Abonnés / Statut */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, margin: '8px 0 10px' }}>
                    {[
                      { value: stats.posts,     label: 'Projets'   },
                      {
                        value: stats.followers,
                        label: 'Abonnés',
                        modal: 'followers',
                      },
                      {
                        value: proStatus.label,
                        label: 'Statut',
                        accent: proStatus.color,
                        accentBg: proStatus.bg,
                      },
                    ].map((item) => {
                      const clickable = !!item.modal;
                      const Tag = clickable ? 'button' : 'div';
                      return (
                        <Tag
                          key={item.label}
                          type={clickable ? 'button' : undefined}
                          onClick={clickable ? () => { setModalType(item.modal); setModalOpen(true); } : undefined}
                          className="stat-tile"
                          style={{
                            padding:    '8px 4px',
                            background: item.accentBg || 'transparent',
                            border:     'none',
                            borderRadius: 10,
                            textAlign:  'center',
                            cursor:     clickable ? 'pointer' : 'default',
                            fontFamily: 'inherit',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div style={{ fontSize: item.accentBg ? 12 : 14, fontWeight: 800, color: item.accent || text }}>
                            {typeof item.value === 'number' ? formatCount(item.value) : item.value}
                          </div>
                          <span style={{ fontSize: 10, color: item.accent || sub }}>{item.label}</span>
                        </Tag>
                      );
                    })}
                  </div>
                </div>
              </motion.div>

            ) : (
              /* ── Vue profil personnel ── */
              <motion.div key="perso-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0, color: text, margin: 0 }}>
                      {user?.fullName || 'Utilisateur'}
                    </h1>
                    {user?.isVerified && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>
                        <ShieldCheckIcon style={{ width: 12, height: 12 }} /> Vérifié
                      </span>
                    )}
                    {user?.isPremium && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', fontSize: 11, fontWeight: 700, color: '#f97316' }}>
                        <SparklesIcon style={{ width: 12, height: 12 }} /> Premium
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: sub }}>@{user?.username || user?.email?.split('@')[0] || 'user'}</span>
                    {user?.website && (
                      <a href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 13, color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>
                        🔗 {user.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, margin: '8px 0 10px' }}>
                    {[
                      { value: stats.posts,     label: 'Publications' },
                      { value: stats.followers, label: 'Abonnés',     modal: 'followers' },
                      { value: stats.following, label: 'Abonnements', modal: 'following' },
                    ].map((item) => {
                      const clickable = !!item.modal;
                      const Tag = clickable ? 'button' : 'div';
                      return (
                        <Tag
                          key={item.label}
                          type={clickable ? 'button' : undefined}
                          onClick={clickable ? () => { setModalType(item.modal); setModalOpen(true); } : undefined}
                          className="stat-tile"
                          style={{ padding: '4px 2px', background: 'transparent', border: 'none', textAlign: 'center', cursor: clickable ? 'pointer' : 'default', fontFamily: 'inherit' }}
                        >
                          <div style={{ fontSize: 14, fontWeight: 800, color: text }}>{formatCount(item.value)}</div>
                          <span style={{ fontSize: 10, color: sub }}>{item.label}</span>
                        </Tag>
                      );
                    })}
                  </div>

                  {user?.bio && (
                    <p style={{ fontSize: 13, color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: 1.35, margin: '0 0 4px' }}>
                      {user.bio}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', color: sub }}>
                    {user?.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <MapPinIcon style={{ width: 14, height: 14, color: '#f97316' }} />
                        <span style={{ fontSize: 13 }}>{user.location}</span>
                      </div>
                    )}
                    {memberSince && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <CalendarIcon style={{ width: 14, height: 14, color: '#f97316' }} />
                        <span style={{ fontSize: 13 }}>Membre depuis {memberSince}</span>
                      </div>
                    )}
                    {user?.website && (
                      <a href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 13, color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>
                        🔗 {user.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Modals ── */}
      <FollowersModal
        isOpen={modalOpen} onClose={() => setModalOpen(false)}
        type={modalType}
        users={modalType === 'followers' ? userFollowers : userFollowing}
        currentUserId={authUser?._id || authUser?.id}
        currentUserFollowing={userFollowing}
        onFollowToggle={handleFollowToggle}
        isDarkMode={isDarkMode}
      />
      <ReportUserModal
        isOpen={showReportModal} onClose={() => setShowReportModal(false)}
        user={user} onSubmit={handleReportUser} isDarkMode={isDarkMode}
      />

      {/* Modal création opportunité — page entreprise */}
      <CreateOpportunityModal
        isOpen={showOpportunityModal}
        onClose={() => setShowOpportunityModal(false)}
        user={user}
        showToast={showToast}
        onCreated={() => setShowOpportunityModal(false)}
      />

      {/* ✅ Modal CV — profil pro uniquement */}
      {isPro && (
        <CVModal
          isOpen={showCVModal}
          onClose={() => setShowCVModal(false)}
          user={user}
          showToast={showToast}
          onUserUpdated={onUserUpdated}
        />
      )}
    </>
  );
}