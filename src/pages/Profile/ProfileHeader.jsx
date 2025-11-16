// src/components/ProfileHeader.jsx - VERSION CORRIGÉE CLOUDINARY
import React, { useState, useRef, useMemo } from 'react';
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
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const EMOJIS = ["😊", "🔥", "💡", "🎉", "🚀", "❤️", "😎", "✨", "🎵"];

export default function ProfileHeader({ 
  user, 
  isOwnProfile = false,
  posts = [],
  followers = [],
  following = [],
  showToast
}) {
  const { isDarkMode, bgColor, textColor, borderColor } = useDarkMode();
  const { updateUserProfile, getToken } = useAuth();
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  const [editData, setEditData] = useState({
    fullName: user?.fullName || '',
    username: user?.username || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || ''
  });
  
  const profileInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const stats = useMemo(() => {
    const totalLikes = posts.reduce((sum, post) => {
      const likesCount = Array.isArray(post.likes) ? post.likes.length : (post.likes || 0);
      return sum + likesCount;
    }, 0);
    
    const totalViews = posts.reduce((sum, post) => {
      const viewsCount = Array.isArray(post.views) 
        ? post.views.length 
        : (typeof post.views === 'number' ? post.views : 0);
      return sum + viewsCount;
    }, 0);

    return {
      posts: posts.length,
      followers: followers.length,
      following: following.length,
      likes: totalLikes,
      views: totalViews
    };
  }, [posts, followers, following]);

  const graphData = [
    { name: "Posts", value: stats.posts },
    { name: "Abonnés", value: stats.followers },
    { name: "Abonnements", value: stats.following },
    { name: "Likes", value: stats.likes },
    { name: "Vues", value: stats.views }
  ];

  // ✅ UPLOAD PHOTO DE PROFIL CORRIGÉ
  const handleProfilePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validations
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
      // ✅ Créer FormData correctement
      const formData = new FormData();
      formData.append('profilePhoto', file);
      
      const token = await getToken();
      if (!token) throw new Error("Session expirée");
      
      // ✅ Envoyer avec axios et FormData
      const response = await axios.put(
        `${API_URL}/api/users/${user._id}/images`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      // Mise à jour du contexte
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

  // ✅ UPLOAD PHOTO DE COUVERTURE CORRIGÉ
  const handleCoverPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validations
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
      // ✅ Créer FormData correctement
      const formData = new FormData();
      formData.append('coverPhoto', file); // ⚠️ Nom différent !
      
      const token = await getToken();
      if (!token) throw new Error("Session expirée");
      
      // ✅ Envoyer avec axios et FormData
      const response = await axios.put(
        `${API_URL}/api/users/${user._id}/images`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      // Mise à jour du contexte
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-3xl overflow-hidden shadow-2xl border ${borderColor} ${
        isDarkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-white'
      }`}
    >
      {/* COUVERTURE + UPLOAD */}
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
              className={`absolute top-4 right-4 p-3 rounded-2xl backdrop-blur-xl border transition-all ${
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

      {/* PROFIL + UPLOAD */}
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
            <h3 className={`text-lg font-semibold ${textColor}`}>Statistiques</h3>
            <motion.button 
              onClick={() => setShowStats(!showStats)} 
              className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              <ChartBarIcon className="w-5 h-5" />
            </motion.button>
          </div>

          <div className="grid grid-cols-5 gap-2 mb-4">
            {graphData.map((stat, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.05 }}
                className={`rounded-xl p-3 text-center ${isDarkMode ? 'bg-gray-800/50 border border-white/5' : 'bg-gray-50'}`}
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
  );
}