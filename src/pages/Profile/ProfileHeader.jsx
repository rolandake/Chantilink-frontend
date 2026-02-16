// src/components/ProfileHeader.jsx - VERSION COMPLÈTE AVEC BOUTON MESSAGE
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CameraIcon, 
  PencilIcon, 
  CheckIcon, 
  XMarkIcon,
  ShieldCheckIcon,
  SparklesIcon,
  MapPinIcon,
  LinkIcon,
  CalendarIcon,
  ChartBarIcon,
  UserGroupIcon,
  UserPlusIcon,
  FlagIcon,
  EllipsisVerticalIcon,
  ChatBubbleLeftRightIcon  // ✅ ICÔNE MESSAGE
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import { ReportUserModal } from './ReportUserModal';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const EMOJIS = ["😊", "🔥", "💡", "🎉", "🚀", "❤️", "😎", "✨", "🎵"];

// ============================================
// 🎨 MODAL FOLLOWERS/FOLLOWING
// ============================================
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
        currentUserFollowing.map(f => typeof f === 'object' ? f._id : f)
      );
      
      users.forEach(user => {
        const userId = user._id || user.id;
        states[userId] = followingIds.has(userId);
      });
      
      setFollowingStates(states);
    }
  }, [isOpen, users, currentUserId, currentUserFollowing]);

  const handleFollowToggle = async (userId) => {
    if (loadingStates[userId]) return;

    setLoadingStates(prev => ({ ...prev, [userId]: true }));

    try {
      const isFollowing = followingStates[userId];
      await onFollowToggle(userId, !isFollowing);
      
      setFollowingStates(prev => ({
        ...prev,
        [userId]: !isFollowing
      }));
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-lg max-h-[80vh] rounded-3xl shadow-2xl border ${
            isDarkMode 
              ? 'bg-gray-900 border-white/10' 
              : 'bg-white border-gray-200'
          } overflow-hidden`}
        >
          <div className={`sticky top-0 z-10 px-6 py-4 border-b backdrop-blur-xl ${
            isDarkMode 
              ? 'bg-gray-900/95 border-white/10' 
              : 'bg-white/95 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserGroupIcon className={`w-6 h-6 ${isDarkMode ? 'text-orange-500' : 'text-orange-600'}`} />
                <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {type === 'followers' ? 'Abonnés' : 'Abonnements'}
                </h2>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                }`}>
                  {users.length}
                </span>
              </div>
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`p-2 rounded-xl transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-gray-800 text-gray-400 hover:text-white' 
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                }`}
              >
                <XMarkIcon className="w-6 h-6" />
              </motion.button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[calc(80vh-80px)] px-6 py-4">
            {users.length === 0 ? (
              <div className="text-center py-12">
                <UserGroupIcon className={`w-16 h-16 mx-auto mb-4 ${
                  isDarkMode ? 'text-gray-700' : 'text-gray-300'
                }`} />
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {type === 'followers' 
                    ? 'Aucun abonné pour le moment' 
                    : 'Aucun abonnement pour le moment'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => {
                  const userId = user._id || user.id;
                  const isOwnProfile = userId === currentUserId;
                  const isFollowing = followingStates[userId] || false;
                  const isLoading = loadingStates[userId] || false;

                  return (
                    <motion.div
                      key={userId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-center justify-between p-4 rounded-2xl transition-all ${
                        isDarkMode
                          ? 'bg-gray-800/50 hover:bg-gray-800/70 border border-white/5'
                          : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => {
                          navigate(`/profile/${userId}`);
                          onClose();
                        }}
                      >
                        <div className="relative">
                          <motion.img
                            src={user.profilePhoto || '/default-avatar.png'}
                            alt={user.fullName}
                            className="w-12 h-12 rounded-2xl object-cover border-2 border-orange-500/30"
                            whileHover={{ scale: 1.05 }}
                          />
                          {(user.isPremium || user.isVerified) && (
                            <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 shadow-lg">
                              {user.isPremium ? (
                                <SparklesIcon className="w-3 h-3 text-white" />
                              ) : (
                                <ShieldCheckIcon className="w-3 h-3 text-white" />
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`font-semibold truncate ${
                              isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                              {user.fullName}
                            </p>
                            {user.isVerified && (
                              <ShieldCheckIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className={`text-sm truncate ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            @{user.username || user.email?.split('@')[0] || 'user'}
                          </p>
                          {user.bio && (
                            <p className={`text-xs mt-1 truncate ${
                              isDarkMode ? 'text-gray-500' : 'text-gray-500'
                            }`}>
                              {user.bio}
                            </p>
                          )}
                        </div>
                      </div>

                      {!isOwnProfile && (
                        type === 'followers' ? (
                          !isFollowing && (
                            <motion.button
                              onClick={() => handleFollowToggle(userId)}
                              disabled={isLoading}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <UserPlusIcon className="w-4 h-4" />
                                  Suivre
                                </>
                              )}
                            </motion.button>
                          )
                        ) : (
                          <motion.button
                            onClick={() => handleFollowToggle(userId)}
                            disabled={isLoading}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                              isFollowing
                                ? (isDarkMode
                                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700')
                                : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white shadow-lg'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {isLoading ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <UserPlusIcon className="w-4 h-4" />
                                {isFollowing ? 'Abonné' : 'Suivre'}
                              </>
                            )}
                          </motion.button>
                        )
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

// ============================================
// 📱 COMPOSANT PRINCIPAL
// ============================================
export default function ProfileHeader({ 
  user, 
  isOwnProfile = false,
  posts = [],
  followers = [],
  following = [],
  showToast
}) {
  const { isDarkMode, bgColor, textColor, borderColor } = useDarkMode();
  const { updateUserProfile, getToken, user: authUser } = useAuth();
  const navigate = useNavigate();
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
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
    fullName: user?.fullName || '',
    username: user?.username || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || ''
  });
  
  const profileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const optionsMenuRef = useRef(null);

  // ============================================
  // 💬 NOUVELLE FONCTION: OUVRIR CONVERSATION
  // ============================================
  const handleSendMessage = useCallback(() => {
    if (!user) {
      showToast?.('Impossible d\'envoyer un message', 'error');
      return;
    }

    // Créer l'objet contact pour la conversation
    const contact = {
      id: user._id || user.id,
      fullName: user.fullName,
      username: user.username,
      profilePhoto: user.profilePhoto,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    };

    console.log('💬 [ProfileHeader] Ouverture conversation avec:', contact);

    // Naviguer vers la page Messages avec le contact pré-sélectionné
    navigate('/messages', { 
      state: { 
        selectedContact: contact,
        openChat: true 
      } 
    });
  }, [user, navigate, showToast]);

  // ============================================
  // 🚨 GESTION DU SIGNALEMENT
  // ============================================
  const handleReportUser = useCallback(async (reportData) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expirée");

      await axios.post(
        `${API_URL}/reports/user`,
        reportData,
        {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true
        }
      );

      showToast?.('Signalement envoyé. Merci pour votre aide ! 🙏', 'success');
      setShowReportModal(false);
      setShowOptionsMenu(false);
    } catch (err) {
      console.error('❌ Erreur signalement:', err);
      throw new Error(err.response?.data?.message || 'Erreur lors du signalement');
    }
  }, [getToken, showToast]);

  // ============================================
  // 🔄 FERMETURE MENU OPTIONS (clic extérieur)
  // ============================================
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target)) {
        setShowOptionsMenu(false);
      }
    };

    if (showOptionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOptionsMenu]);

  const fetchUserStats = useCallback(async () => {
    if (!user?._id) return;
    
    setLoadingStats(true);
    setStatsError(null);
    
    try {
      const token = await getToken();
      
      const [postsRes, followersRes, followingRes] = await Promise.allSettled([
        axios.get(`${API_URL}/posts/user/${user._id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 10000
        }),
        axios.get(`${API_URL}/users/${user._id}/followers`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 10000
        }),
        axios.get(`${API_URL}/users/${user._id}/following`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 10000
        })
      ]);

      if (postsRes.status === 'fulfilled') {
        const postsData = postsRes.value.data?.posts || postsRes.value.data?.data || [];
        setUserPosts(Array.isArray(postsData) ? postsData : []);
      }

      if (followersRes.status === 'fulfilled') {
        const followersData = followersRes.value.data?.followers || followersRes.value.data?.data || [];
        setUserFollowers(Array.isArray(followersData) ? followersData : []);
      }

      if (followingRes.status === 'fulfilled') {
        const followingData = followingRes.value.data?.following || followingRes.value.data?.data || [];
        setUserFollowing(Array.isArray(followingData) ? followingData : []);
      }

    } catch (err) {
      console.error('❌ [ProfileHeader] Erreur chargement stats:', err);
      setStatsError(err.message);
    } finally {
      setLoadingStats(false);
    }
  }, [user?._id, getToken]);

  useEffect(() => {
    if (user?._id && (!posts.length || !followers.length || !following.length)) {
      fetchUserStats();
    } else {
      setUserPosts(posts);
      setUserFollowers(followers);
      setUserFollowing(following);
    }
  }, [user?._id, posts, followers, following, fetchUserStats]);

  const handleFollowToggle = useCallback(async (userId, shouldFollow) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expirée");

      await axios.post(
        `${API_URL}/users/${userId}/follow`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true
        }
      );

      await fetchUserStats();
      
      showToast?.(shouldFollow ? 'Abonné ! 🎉' : 'Désabonné', 'success');
    } catch (err) {
      console.error('Erreur follow toggle:', err);
      showToast?.('Erreur lors de l\'action', 'error');
      throw err;
    }
  }, [getToken, fetchUserStats, showToast]);

  const stats = useMemo(() => {
    const totalLikes = userPosts.reduce((sum, post) => {
      const likesCount = Array.isArray(post.likes) ? post.likes.length : (post.likes || 0);
      return sum + likesCount;
    }, 0);

    return {
      posts: userPosts.length,
      followers: userFollowers.length,
      following: userFollowing.length,
      likes: totalLikes
    };
  }, [userPosts, userFollowers, userFollowing]);

  const graphData = useMemo(() => [
    { name: "Posts", value: stats.posts },
    { name: "Abonnés", value: stats.followers },
    { name: "Abonnements", value: stats.following },
    { name: "Likes", value: stats.likes }
  ], [stats]);

  const handleProfilePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      showToast?.('Fichier non valide. Image requise.', 'error');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      showToast?.('Fichier trop volumineux (5 Mo max)', 'error');
      return;
    }

    setIsUploadingProfile(true);
    
    try {
      const formData = new FormData();
      formData.append('profilePhoto', file);
      
      const token = await getToken();
      if (!token) throw new Error("Session expirée");
      
      const response = await axios.put(
        `${API_URL}/users/${user._id}/images`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 30000
        }
      );
      
      if (response.data?.user) {
        await updateUserProfile(user._id, response.data.user);
      }
      
      showToast?.('✅ Photo de profil mise à jour !', 'success');
    } catch (err) {
      console.error('Erreur upload photo profil:', err);
      const msg = err.response?.data?.message || err.message || 'Erreur lors de l\'upload';
      showToast?.(msg, 'error');
    } finally {
      setIsUploadingProfile(false);
      if (profileInputRef.current) {
        profileInputRef.current.value = null;
      }
    }
  };

  const handleCoverPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      showToast?.('Fichier non valide. Image requise.', 'error');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      showToast?.('Fichier trop volumineux (5 Mo max)', 'error');
      return;
    }

    setIsUploadingCover(true);
    
    try {
      const formData = new FormData();
      formData.append('coverPhoto', file);
      
      const token = await getToken();
      if (!token) throw new Error("Session expirée");
      
      const response = await axios.put(
        `${API_URL}/users/${user._id}/images`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 30000
        }
      );
      
      if (response.data?.user) {
        await updateUserProfile(user._id, response.data.user);
      }
      
      showToast?.('✅ Photo de couverture mise à jour !', 'success');
    } catch (err) {
      console.error('Erreur upload photo couverture:', err);
      const msg = err.response?.data?.message || err.message || 'Erreur lors de l\'upload';
      showToast?.(msg, 'error');
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) {
        coverInputRef.current.value = null;
      }
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expirée");

      const updates = {
        fullName: editData.fullName.trim(),
        username: editData.username.trim(),
        bio: editData.bio.trim(),
        location: editData.location.trim(),
        website: editData.website.trim()
      };

      await updateUserProfile(user._id, updates);
      setIsEditingProfile(false);
      showToast?.('Profil mis à jour !', 'success');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Erreur';
      showToast?.(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const addEmoji = (emoji) => {
    setEditData(prev => ({ ...prev, bio: (prev.bio || "") + " " + emoji }));
  };

  const memberSince = user?.createdAt 
    ? new Date(user.createdAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
    : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative rounded-3xl overflow-hidden shadow-2xl border ${borderColor} ${
          isDarkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-white'
        }`}
      >
        {/* COUVERTURE */}
        <div className="relative h-64 sm:h-80 overflow-hidden group">
          <motion.img
            src={user?.coverPhoto || '/default-cover.jpg'}
            alt="Couverture"
            className="w-full h-full object-cover"
            whileHover={{ scale: 1.05 }}
          />
          <div className={`absolute inset-0 ${
            isDarkMode
              ? 'bg-gradient-to-t from-black/80 via-black/40 to-transparent'
              : 'bg-gradient-to-t from-gray-900/60 via-gray-900/20 to-transparent'
          }`} />

          {/* BOUTONS HEADER */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            
            {/* ✅ BOUTON MESSAGE (profils non-propriétaires) */}
            {!isOwnProfile && (
              <motion.button
                onClick={handleSendMessage}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl backdrop-blur-xl border transition-all ${
                  isDarkMode
                    ? 'bg-blue-600/90 border-blue-500/30 hover:bg-blue-700 text-white'
                    : 'bg-blue-500/90 border-blue-400/30 hover:bg-blue-600 text-white'
                } shadow-lg hover:shadow-xl`}
                title="Envoyer un message"
              >
                <ChatBubbleLeftRightIcon className="w-5 h-5" />
                <span className="font-semibold text-sm hidden sm:inline">Message</span>
              </motion.button>
            )}

            {/* BOUTON OPTIONS (profils non-propriétaires) */}
            {!isOwnProfile && (
              <div className="relative" ref={optionsMenuRef}>
                <motion.button
                  onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-3 rounded-2xl backdrop-blur-xl border transition-all ${
                    isDarkMode
                      ? 'bg-black/50 border-white/20 hover:bg-black/70 text-white'
                      : 'bg-white/50 border-gray-300 hover:bg-white/70 text-gray-800'
                  }`}
                >
                  <EllipsisVerticalIcon className="w-5 h-5" />
                </motion.button>

                {/* MENU DÉROULANT */}
                <AnimatePresence>
                  {showOptionsMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className={`absolute top-full right-0 mt-2 w-56 rounded-2xl shadow-2xl border overflow-hidden z-10 ${
                        isDarkMode
                          ? 'bg-gray-800 border-white/10'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setShowReportModal(true);
                          setShowOptionsMenu(false);
                        }}
                        className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                          isDarkMode
                            ? 'hover:bg-gray-700 text-gray-300'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <FlagIcon className="w-5 h-5 text-red-500" />
                        <span className="font-medium">Signaler cet utilisateur</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* BOUTON UPLOAD COUVERTURE (propriétaires) */}
            {isOwnProfile && (
              <>
                <input 
                  ref={coverInputRef} 
                  type="file" 
                  accept="image/*" 
                  onChange={handleCoverPhotoChange} 
                  className="hidden" 
                />
                <motion.button
                  onClick={() => coverInputRef.current?.click()}
                  disabled={isUploadingCover}
                  className={`p-3 rounded-2xl backdrop-blur-xl border transition-all ${
                    isDarkMode
                      ? 'bg-black/50 border-white/20 hover:bg-black/70 text-white'
                      : 'bg-white/50 border-gray-300 hover:bg-white/70 text-gray-800'
                  } ${isUploadingCover ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {isUploadingCover ? (
                    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CameraIcon className="w-5 h-5" />
                  )}
                </motion.button>
              </>
            )}
          </div>
        </div>

        {/* PHOTO DE PROFIL & INFOS */}
        <div className="relative px-6 sm:px-8 pb-8">
          <div className="relative -mt-20 sm:-mt-24 mb-6">
            <div className="relative inline-block group">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border-4 shadow-2xl ${
                  isDarkMode ? 'border-gray-800' : 'border-white'
                }`}
              >
                <img 
                  src={user?.profilePhoto || '/default-avatar.png'} 
                  alt={user?.fullName} 
                  className="w-full h-full object-cover" 
                />
                {(user?.isPremium || user?.isVerified) && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute bottom-2 right-2 p-1.5 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 shadow-lg"
                  >
                    {user?.isPremium ? (
                      <SparklesIcon className="w-5 h-5 text-white" />
                    ) : (
                      <ShieldCheckIcon className="w-5 h-5 text-white" />
                    )}
                  </motion.div>
                )}
              </motion.div>

              {isOwnProfile && (
                <>
                  <input 
                    ref={profileInputRef} 
                    type="file" 
                    accept="image/*" 
                    onChange={handleProfilePhotoChange} 
                    className="hidden" 
                  />
                  <motion.button
                    onClick={() => profileInputRef.current?.click()}
                    disabled={isUploadingProfile}
                    className={`absolute bottom-2 right-2 p-2.5 rounded-xl backdrop-blur-xl border transition-all ${
                      isDarkMode
                        ? 'bg-black/70 border-white/20 hover:bg-black/90 text-white'
                        : 'bg-white/90 border-gray-300 hover:bg-white text-gray-800'
                    } ${isUploadingProfile ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {isUploadingProfile ? (
                      <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CameraIcon className="w-4 h-4" />
                    )}
                  </motion.button>
                </>
              )}
            </div>
          </div>

          {/* ÉDITION OU AFFICHAGE */}
          <AnimatePresence mode="wait">
            {isEditingProfile ? (
              <motion.div 
                key="edit" 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -20 }} 
                className="space-y-4 mb-6"
              >
                {['fullName', 'username', 'bio', 'location', 'website'].map(field => (
                  field === 'bio' ? (
                    <div key={field}>
                      <textarea
                        value={editData.bio}
                        onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                        maxLength={300}
                        rows={4}
                        placeholder="Bio..."
                        className={`w-full px-4 py-3 rounded-xl border-2 resize-none focus:outline-none focus:ring-2 transition-all ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 text-white focus:border-orange-500'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-orange-500'
                        }`}
                      />
                      <div className="flex justify-between mt-2">
                        <div className="flex gap-2">
                          {EMOJIS.map(e => (
                            <button 
                              key={e} 
                              onClick={() => addEmoji(e)} 
                              className="text-xl hover:scale-110 transition-transform"
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                        <span className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                          {editData.bio.length}/300
                        </span>
                      </div>
                    </div>
                  ) : (
                    <input
                      key={field}
                      value={editData[field]}
                      onChange={(e) => setEditData(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder={field === 'fullName' ? 'Nom complet' : field === 'username' ? '@username' : field}
                      className={`w-full px-4 py-3 rounded-xl border-2 focus:outline-none focus:ring-2 transition-all ${
                        isDarkMode
                          ? 'bg-gray-800 border-gray-700 text-white focus:border-orange-500'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-orange-500'
                      }`}
                    />
                  )
                ))}

                <div className="flex gap-3 justify-end">
                  <motion.button
                    onClick={() => {
                      setIsEditingProfile(false);
                      setEditData({
                        fullName: user?.fullName || '',
                        username: user?.username || '',
                        bio: user?.bio || '',
                        location: user?.location || '',
                        website: user?.website || ''
                      });
                    }}
                    className={`px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 ${
                      isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                    }`}
                  >
                    <XMarkIcon className="w-5 h-5" />
                    Annuler
                  </motion.button>
                  <motion.button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl font-medium bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckIcon className="w-5 h-5" />
                    )}
                    Enregistrer
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className={`text-3xl sm:text-4xl font-bold ${textColor}`}>
                        {user?.fullName || 'Utilisateur'}
                      </h1>
                      {user?.isVerified && <ShieldCheckIcon className="w-7 h-7 text-blue-500" />}
                      {user?.isPremium && <SparklesIcon className="w-7 h-7 text-orange-500" />}
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      @{user?.username || user?.email?.split('@')[0] || 'user'}
                    </p>
                  </div>
                  {isOwnProfile && (
                    <motion.button
                      onClick={() => setIsEditingProfile(true)}
                      className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg hover:shadow-xl transition-all"
                    >
                      <PencilIcon className="w-5 h-5 inline mr-2" />
                      Modifier profil
                    </motion.button>
                  )}
                </div>

                {user?.bio && (
                  <p className={`text-base leading-relaxed mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {user.bio}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {user?.location && (
                    <div className="flex items-center gap-2">
                      <MapPinIcon className={`w-5 h-5 ${isDarkMode ? 'text-orange-500' : 'text-orange-600'}`} />
                      <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {user.location}
                      </span>
                    </div>
                  )}
                  {user?.website && (
                    <div className="flex items-center gap-2">
                      <LinkIcon className={`w-5 h-5 ${isDarkMode ? 'text-orange-500' : 'text-orange-600'}`} />
                      <a 
                        href={user.website.startsWith('http') ? user.website : `https://${user.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`text-sm hover:underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
                      >
                        {user.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {memberSince && (
                    <div className="flex items-center gap-2">
                      <CalendarIcon className={`w-5 h-5 ${isDarkMode ? 'text-orange-500' : 'text-orange-600'}`} />
                      <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Membre depuis {memberSince}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* STATISTIQUES */}
          <div className={`pt-6 border-t ${borderColor}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${textColor}`}>
                Statistiques
                {loadingStats && (
                  <span className="ml-2 inline-block w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                )}
              </h3>
              <motion.button 
                onClick={() => setShowStats(!showStats)} 
                className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <ChartBarIcon className="w-5 h-5" />
              </motion.button>
            </div>

            {statsError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">Erreur de chargement des stats</p>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 mb-4">
              {graphData.map((stat, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.05 }}
                  onClick={() => {
                    if (stat.name === 'Abonnés') {
                      setModalType('followers');
                      setModalOpen(true);
                    } else if (stat.name === 'Abonnements') {
                      setModalType('following');
                      setModalOpen(true);
                    }
                  }}
                  className={`rounded-xl p-3 text-center transition-all ${
                    isDarkMode ? 'bg-gray-800/50 border border-white/5' : 'bg-gray-50'
                  } ${(stat.name === 'Abonnés' || stat.name === 'Abonnements') ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  <p className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                    {stat.value}
                  </p>
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {stat.name}
                  </p>
                </motion.div>
              ))}
            </div>

            <AnimatePresence>
              {showStats && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }}
                  className={`rounded-2xl p-4 ${isDarkMode ? 'bg-gray-800/50 border border-white/5' : 'bg-gray-50'}`}
                >
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={graphData}>
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 11, fill: isDarkMode ? '#9ca3af' : '#4b5563' }} 
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? 'rgba(10,10,10,0.95)' : 'rgba(255,255,255,0.95)', 
                          borderRadius: '12px',
                          border: 'none'
                        }} 
                      />
                      <Bar dataKey="value" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
                      <defs>
                        <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#fb923c" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* MODAL FOLLOWERS/FOLLOWING */}
      <FollowersModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        type={modalType}
        users={modalType === 'followers' ? userFollowers : userFollowing}
        currentUserId={authUser?._id || authUser?.id}
        currentUserFollowing={userFollowing}
        onFollowToggle={handleFollowToggle}
        isDarkMode={isDarkMode}
      />

      {/* MODAL DE SIGNALEMENT */}
      <ReportUserModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        user={user}
        onSubmit={handleReportUser}
        isDarkMode={isDarkMode}
      />
    </>
  );
}