// src/pages/Admin/AdminDashboard.jsx - VERSION COMPLÈTE FONCTIONNELLE
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaUsers, FaCrown, FaBan, FaCheckCircle, FaLock, FaBell, 
  FaExclamationTriangle, FaBrain, FaVolumeUp, FaUserShield,
  FaUnlock, FaStar, FaTrash, FaEdit, FaEnvelope
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';
import axios from 'axios';

// ===== HOOKS =====
const useHaptic = () => {
  const trigger = useCallback((style = 'light') => {
    if ('vibrate' in navigator) {
      const duration = style === 'heavy' ? 30 : style === 'medium' ? 20 : 10;
      navigator.vibrate(duration);
    }
  }, []);
  return { trigger };
};

// ===== COMPOSANTS =====
const Toast = React.memo(({ message, type = 'info', onClose }) => {
  const { trigger } = useHaptic();
  const { isDarkMode } = useDarkMode();
  
  const icons = { 
    info: <FaBell />, 
    success: <FaCheckCircle />, 
    error: <FaExclamationTriangle />, 
    ai: <FaBrain /> 
  };
  
  const colors = isDarkMode
    ? { 
        info: 'bg-blue-900/90 border-blue-600', 
        success: 'bg-green-900/90 border-green-600', 
        error: 'bg-red-900/90 border-red-600', 
        ai: 'bg-purple-900/90 border-purple-600' 
      }
    : { 
        info: 'bg-blue-50 border-blue-400', 
        success: 'bg-green-50 border-green-400', 
        error: 'bg-red-50 border-red-400', 
        ai: 'bg-purple-50 border-purple-400' 
      };

  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 px-4 py-3 rounded-xl shadow-2xl ${colors[type]} border-l-4 flex items-center gap-3 text-sm z-[9999] backdrop-blur-xl`}>
      <div className="text-lg">{icons[type]}</div>
      <p className="font-bold flex-1">{message}</p>
      <button 
        onClick={() => { 
          trigger('light'); 
          onClose(); 
        }} 
        className="text-gray-400 hover:text-gray-200"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
});

const TactileButton = React.memo(({ children, onClick, haptic = 'medium', className = '', disabled = false, ...props }) => {
  const { trigger } = useHaptic();
  
  return (
    <button 
      className={`active:scale-95 transition-all ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} 
      onClick={(e) => { 
        if (!disabled) {
          trigger(haptic); 
          onClick?.(e); 
        }
      }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
});

const StatCard = React.memo(({ icon: Icon, label, value, color }) => {
  const { isDarkMode } = useDarkMode();
  
  return (
    <div className={`rounded-xl shadow-lg p-4 border-l-4 ${color} hover:shadow-xl transition-shadow ${isDarkMode ? 'bg-gray-800/80' : 'bg-white'}`}>
      <div className="flex justify-between">
        <div>
          <p className={`text-xs uppercase font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{label}</p>
          <p className="text-3xl font-black mt-1">{value || 0}</p>
        </div>
        <div className="text-4xl opacity-20">{Icon}</div>
      </div>
    </div>
  );
});

const ConfirmModal = React.memo(({ title, message, onConfirm, onCancel, confirmText = "Confirmer", cancelText = "Annuler", isDanger = false }) => {
  const { isDarkMode } = useDarkMode();
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className={`rounded-3xl shadow-2xl max-w-md w-full p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{message}</p>
        <div className="flex gap-3">
          <TactileButton 
            onClick={onConfirm} 
            className={`flex-1 px-4 py-3 ${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-xl font-bold`}
          >
            {confirmText}
          </TactileButton>
          <TactileButton 
            onClick={onCancel} 
            className={`flex-1 px-4 py-3 rounded-xl font-bold ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            {cancelText}
          </TactileButton>
        </div>
      </div>
    </div>
  );
});

const NotificationModal = React.memo(({ onSend, onCancel, targetUser = null }) => {
  const { isDarkMode } = useDarkMode();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    await onSend(title, message, targetUser?._id);
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className={`rounded-3xl shadow-2xl max-w-lg w-full p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <FaBell className="text-blue-500" />
          Envoyer une notification
        </h3>
        
        {targetUser && (
          <div className={`mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <p className="text-sm">Destinataire: <span className="font-bold">{targetUser.fullName || targetUser.email}</span></p>
          </div>
        )}

        {!targetUser && (
          <div className={`mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-yellow-900/30 border border-yellow-500/50' : 'bg-yellow-50 border border-yellow-200'}`}>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
              <FaExclamationTriangle />
              Cette notification sera envoyée à TOUS les utilisateurs
            </p>
          </div>
        )}

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de la notification"
          className={`w-full px-4 py-3 rounded-xl border mb-3 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-blue-500 outline-none`}
        />

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message..."
          rows={4}
          className={`w-full px-4 py-3 rounded-xl border mb-4 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-blue-500 outline-none resize-none`}
        />

        <div className="flex gap-3">
          <TactileButton 
            onClick={handleSend}
            disabled={!title.trim() || !message.trim() || sending}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50"
          >
            {sending ? 'Envoi...' : 'Envoyer'}
          </TactileButton>
          <TactileButton 
            onClick={onCancel} 
            className={`flex-1 px-4 py-3 rounded-xl font-bold ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
          >
            Annuler
          </TactileButton>
        </div>
      </div>
    </div>
  );
});

const UserRow = React.memo(({ user, onBan, onPremium, onVerify, onNotify, onDelete, isDarkMode }) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div 
      className={`px-6 py-4 flex items-center justify-between border-b ${isDarkMode ? 'border-gray-700 hover:bg-gray-800/50' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
    >
      <div className="flex items-center gap-4 flex-1">
        <img 
          src={user.profilePhoto || '/default-avatar.png'} 
          alt={user.fullName}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div>
          <p className="font-bold flex items-center gap-2">
            {user.fullName || user.email.split('@')[0]}
            {user.isPremium && <FaCrown className="text-yellow-500" title="Premium" />}
            {user.isVerified && <FaCheckCircle className="text-blue-500" title="Vérifié" />}
            {user.isBanned && <FaBan className="text-red-500" title="Banni" />}
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{user.email}</p>
          <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Rôle: {user.role || 'user'}
          </p>
        </div>
      </div>

      <div className="flex gap-2 relative">
        <TactileButton
          onClick={() => setShowActions(!showActions)}
          className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </TactileButton>

        {showActions && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowActions(false)}
            />
            <div className={`absolute right-0 top-12 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} p-2 z-20 min-w-[200px]`}>
              <TactileButton
                onClick={() => { onBan(user); setShowActions(false); }}
                className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 ${user.isBanned ? 'text-green-500 hover:bg-green-500/10' : 'text-red-500 hover:bg-red-500/10'}`}
              >
                {user.isBanned ? <FaUnlock /> : <FaBan />}
                {user.isBanned ? 'Débannir' : 'Bannir'}
              </TactileButton>

              <TactileButton
                onClick={() => { onPremium(user); setShowActions(false); }}
                className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 ${user.isPremium ? 'text-gray-500 hover:bg-gray-500/10' : 'text-yellow-500 hover:bg-yellow-500/10'}`}
              >
                <FaCrown />
                {user.isPremium ? 'Retirer Premium' : 'Activer Premium'}
              </TactileButton>

              <TactileButton
                onClick={() => { onVerify(user); setShowActions(false); }}
                className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 ${user.isVerified ? 'text-gray-500 hover:bg-gray-500/10' : 'text-blue-500 hover:bg-blue-500/10'}`}
              >
                <FaCheckCircle />
                {user.isVerified ? 'Retirer Badge' : 'Certifier'}
              </TactileButton>

              <TactileButton
                onClick={() => { onNotify(user); setShowActions(false); }}
                className="w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 text-purple-500 hover:bg-purple-500/10"
              >
                <FaEnvelope />
                Notifier
              </TactileButton>

              <div className={`my-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`} />

              <TactileButton
                onClick={() => { onDelete(user); setShowActions(false); }}
                className="w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 text-red-600 hover:bg-red-500/10"
              >
                <FaTrash />
                Supprimer
              </TactileButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

// ===== HELPER =====
const isAdminRole = (role) => {
  return role === 'admin' || role === 'superadmin' || role === 'moderator';
};

// ===== COMPOSANT PRINCIPAL =====
export default function AdminDashboard() {
  const { isDarkMode } = useDarkMode();
  const navigate = useNavigate();
  const { user, verifyAdminToken, refreshTokenForUser } = useAuth();
  const { trigger } = useHaptic();
  
  // États
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModal, setConfirmModal] = useState({ show: false });
  const [notificationModal, setNotificationModal] = useState({ show: false, targetUser: null });
  const [aiPrediction, setAiPrediction] = useState({ 
    advice: "Clique pour demander à Grok-3", 
    revenue: 0, 
    growth: 0 
  });
  const [aiLog, setAiLog] = useState(["Grok-3 en attente..."]);
  const [voiceUrl, setVoiceUrl] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  
  const currentRole = user?.role || 'user';

  // ===== CALLBACKS =====
  const addToast = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-4), { id, msg, type }]);
  }, []);

  const secureAction = useCallback(async (endpoint, method = 'GET', data = {}) => {
    let token = await verifyAdminToken();

    if (!token) {
      const success = await refreshTokenForUser();
      if (!success) {
        addToast('Session expirée', 'error');
        navigate('/login');
        return null;
      }
      token = await verifyAdminToken();
    }

    if (!token) {
      addToast('Authentification échouée', 'error');
      return null;
    }

    try {
      const res = await axios({
        method,
        url: `${import.meta.env.VITE_API_URL}${endpoint}`,
        headers: { Authorization: `Bearer ${token}` },
        data,
        withCredentials: true
      });
      return res.data;
    } catch (err) {
      console.error('Action échouée:', err.response?.data || err.message);
      if (err.response?.status === 401 || err.response?.status === 403) {
        addToast('Session expirée', 'error');
        navigate('/login');
      } else {
        addToast(err.response?.data?.message || err.response?.data?.error || 'Erreur réseau', 'error');
      }
      throw err;
    }
  }, [verifyAdminToken, refreshTokenForUser, addToast, navigate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const usersRes = await secureAction('/api/admin/users');
      if (!usersRes) return;
      setAllUsers(usersRes.users || []);
      addToast('Données chargées', 'success');
    } catch (err) {
      setError(err.message || 'Erreur inconnue');
      addToast('Échec du chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [secureAction, addToast]);

  const handleBanUser = useCallback((targetUser) => {
    setConfirmModal({
      show: true,
      title: targetUser.isBanned ? 'Débannir utilisateur' : 'Bannir utilisateur',
      message: `${targetUser.isBanned ? 'Débannir' : 'Bannir'} ${targetUser.fullName || targetUser.email} ?`,
      onConfirm: async () => {
        try {
          const result = await secureAction(`/api/admin/users/${targetUser._id}/ban`, 'PATCH');
          if (result) {
            addToast(result.message || 'Action effectuée', 'success');
            await loadData();
          }
        } catch (err) {
          console.error('Erreur ban:', err);
        }
        setConfirmModal({ show: false });
      },
      isDanger: !targetUser.isBanned
    });
  }, [secureAction, addToast, loadData]);

  const handlePremiumToggle = useCallback((targetUser) => {
    setConfirmModal({
      show: true,
      title: targetUser.isPremium ? 'Retirer Premium' : 'Activer Premium',
      message: `${targetUser.isPremium ? 'Retirer' : 'Activer'} le statut Premium pour ${targetUser.fullName || targetUser.email} ?`,
      onConfirm: async () => {
        try {
          const result = await secureAction(`/api/admin/users/${targetUser._id}/premium`, 'PATCH');
          if (result) {
            addToast(result.message || 'Statut Premium modifié', 'success');
            await loadData();
          }
        } catch (err) {
          console.error('Erreur premium:', err);
        }
        setConfirmModal({ show: false });
      }
    });
  }, [secureAction, addToast, loadData]);

  const handleVerifyToggle = useCallback((targetUser) => {
    setConfirmModal({
      show: true,
      title: targetUser.isVerified ? 'Retirer certification' : 'Certifier utilisateur',
      message: `${targetUser.isVerified ? 'Retirer le badge vérifié de' : 'Certifier'} ${targetUser.fullName || targetUser.email} ?`,
      onConfirm: async () => {
        try {
          const result = await secureAction(`/api/admin/users/${targetUser._id}`, 'PATCH', {
            isVerified: !targetUser.isVerified
          });
          if (result) {
            addToast('Certification modifiée', 'success');
            await loadData();
          }
        } catch (err) {
          console.error('Erreur verify:', err);
        }
        setConfirmModal({ show: false });
      }
    });
  }, [secureAction, addToast, loadData]);

  const handleNotifyUser = useCallback((targetUser = null) => {
    setNotificationModal({ show: true, targetUser });
  }, []);

  const handleSendNotification = useCallback(async (title, message, userId = null) => {
    try {
      const result = await secureAction('/api/admin/notifications', 'POST', {
        title,
        message,
        userId
      });
      if (result) {
        addToast(result.message || 'Notification envoyée', 'success');
        setNotificationModal({ show: false, targetUser: null });
      }
    } catch (err) {
      console.error('Erreur notification:', err);
    }
  }, [secureAction, addToast]);

  const handleDeleteUser = useCallback((targetUser) => {
    setConfirmModal({
      show: true,
      title: 'Supprimer utilisateur',
      message: `⚠️ ATTENTION: Supprimer définitivement ${targetUser.fullName || targetUser.email} ? Cette action est IRRÉVERSIBLE !`,
      onConfirm: async () => {
        try {
          await secureAction(`/api/admin/users/${targetUser._id}`, 'DELETE');
          addToast('Utilisateur supprimé', 'success');
          await loadData();
        } catch (err) {
          console.error('Erreur suppression:', err);
        }
        setConfirmModal({ show: false });
      },
      isDanger: true,
      confirmText: 'SUPPRIMER'
    });
  }, [secureAction, addToast, loadData]);

  const askGrok = useCallback(async () => {
    setAiLog(prev => [...prev, "Connexion à Grok-3..."]);
    try {
      const res = await secureAction('/api/admin/ai/predict', 'POST');
      if (!res) return;
      setAiPrediction({ 
        advice: res.advice, 
        revenue: res.revenue, 
        growth: res.growth 
      });
      setAiLog(prev => [...prev, "Grok-3 a répondu !"]);
      addToast('Conseil Grok-3 reçu', 'ai');
    } catch (error) {
      setAiLog(prev => [...prev, "Grok-3 indisponible"]);
    }
  }, [secureAction, addToast]);

  const speakGrok = useCallback(async () => {
    if (!aiPrediction.advice) return;
    try {
      const res = await secureAction('/api/admin/ai/voice', 'POST', { 
        text: aiPrediction.advice 
      });
      if (!res) return;
      setVoiceUrl(res.url);
      addToast('Grok-3 parle !', 'ai');
    } catch (error) {
      addToast('Voix KO', 'error');
    }
  }, [secureAction, addToast, aiPrediction.advice]);

  // === EFFETS ===
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user) {
        setAuthChecked(true);
        setHasAccess(false);
        return;
      }

      if (!isAdminRole(user.role)) {
        setAuthChecked(true);
        setHasAccess(false);
        return;
      }

      const token = await verifyAdminToken();
      
      if (!token) {
        const refreshed = await refreshTokenForUser();
        if (refreshed) {
          const newToken = await verifyAdminToken();
          setAuthChecked(true);
          setHasAccess(!!newToken);
        } else {
          setAuthChecked(true);
          setHasAccess(false);
          navigate('/login');
        }
      } else {
        setAuthChecked(true);
        setHasAccess(true);
      }
    };

    checkAdminAccess();
  }, [user, verifyAdminToken, refreshTokenForUser, navigate]);

  useEffect(() => {
    if (authChecked && hasAccess && isAdminRole(currentRole)) {
      loadData();
    }
  }, [authChecked, hasAccess, currentRole, loadData]);

  // ===== CALCULS =====
  const stats = useMemo(() => ({
    total: allUsers.length,
    premium: allUsers.filter(u => u.isPremium).length,
    banned: allUsers.filter(u => u.isBanned).length,
    verified: allUsers.filter(u => u.isVerified).length
  }), [allUsers]);

  const filteredUsers = useMemo(() => 
    allUsers.filter(u =>
      u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [allUsers, searchQuery]
  );

  // ===== RENDERS CONDITIONNELS =====
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-black">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mb-6 mx-auto" />
          <p className="text-2xl font-black">VÉRIFICATION ACCÈS...</p>
        </div>
      </div>
    );
  }

  if (!user || !hasAccess || !isAdminRole(currentRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900 to-black">
        <div className="text-center text-white">
          <FaLock className="text-6xl mb-6 mx-auto animate-pulse" />
          <p className="text-2xl font-black">ACCÈS RÉSERVÉ</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  // ===== RENDER PRINCIPAL =====
  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-black' : 'bg-gradient-to-br from-gray-50 to-gray-100'} p-4`}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* TOASTS */}
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <Toast 
                message={t.msg} 
                type={t.type} 
                onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} 
              />
            </div>
          ))}
        </div>

        {/* HEADER */}
        <div className={`rounded-2xl shadow-xl p-6 ${isDarkMode ? 'bg-gray-800/90' : 'bg-white/95'} backdrop-blur-xl`}>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-orange-400">
                PANNEAU ADMINISTRATEUR
              </h1>
              <p className="text-sm mt-1">
                <span className="font-bold">{user?.fullName || user?.email}</span>
                <span className="ml-2 px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-400">
                  {currentRole}
                </span>
              </p>
            </div>
            <TactileButton
              onClick={() => handleNotifyUser(null)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold flex items-center gap-2"
            >
              <FaBell />
              Notifier tous
            </TactileButton>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={<FaUsers />} label="Total" value={stats.total} color="border-blue-600" />
          <StatCard icon={<FaCrown />} label="Premium" value={stats.premium} color="border-yellow-600" />
          <StatCard icon={<FaCheckCircle />} label="Certifiés" value={stats.verified} color="border-green-600" />
          <StatCard icon={<FaBan />} label="Bannis" value={stats.banned} color="border-red-600" />
        </div>

        {/* AI REVENUE GOD */}
        <div className={`rounded-2xl shadow-2xl p-6 ${isDarkMode ? 'bg-gradient-to-br from-purple-900/50 to-cyan-900/50' : 'bg-gradient-to-br from-purple-50 to-cyan-50'} border-2 ${isDarkMode ? 'border-purple-500' : 'border-purple-400'} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 blur-3xl" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <FaBrain className="text-4xl text-purple-400 animate-pulse" />
              <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                GROK-3 REVENUE GOD
              </h2>
            </div>

            <div className="p-4 bg-black/30 rounded-xl mb-4">
              <p className="text-5xl font-black text-cyan-400">
                {aiPrediction.revenue.toLocaleString()} €
              </p>
              <p className="text-green-400">+{aiPrediction.growth}% en 30 jours</p>
            </div>

            <div className="p-4 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-xl mb-4">
              <p className="text-white font-bold text-lg">{aiPrediction.advice}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TactileButton 
                onClick={askGrok} 
                className="p-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white font-bold shadow-2xl hover:shadow-purple-500/50"
              >
                DEMANDER À GROK-3
              </TactileButton>
              <TactileButton 
                onClick={speakGrok} 
                disabled={!aiPrediction.advice || aiPrediction.advice === "Clique pour demander à Grok-3"}
                className="p-4 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white font-bold shadow-2xl hover:shadow-cyan-500/50"
              >
                <FaVolumeUp className="inline mr-2" /> ÉCOUTER
              </TactileButton>
            </div>

            {voiceUrl && (
              <audio controls autoPlay className="w-full mt-4 rounded-xl">
                <source src={voiceUrl} type="audio/mpeg" />
                Votre navigateur ne supporte pas l'audio.
              </audio>
            )}

            <div className="mt-4 p-3 bg-black/40 rounded-lg text-xs font-mono text-cyan-300 h-20 overflow-y-auto">
              {aiLog.map((log, i) => (
                <div key={i}>→ {log}</div>
              ))}
            </div>
          </div>
        </div>

        {/* FILTRE & ACTIONS */}
        <div className={`rounded-2xl shadow-xl p-4 ${isDarkMode ? 'bg-gray-800/90' : 'bg-white/95'}`}>
          <div className="flex gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un utilisateur..."
              className={`flex-1 px-4 py-2 rounded-xl border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-purple-500 outline-none`}
            />
            <TactileButton
              onClick={loadData}
              className={`px-4 py-2 rounded-xl font-bold ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              🔄 Actualiser
            </TactileButton>
          </div>
        </div>

        {/* LISTE USERS */}
        <div className={`rounded-2xl shadow-xl overflow-hidden ${isDarkMode ? 'bg-gray-800/90' : 'bg-white/95'}`}>
          <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
            <h3 className="text-xl font-bold">Utilisateurs ({filteredUsers.length})</h3>
          </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="text-center p-8">
              <p className="text-red-500 mb-4">{error}</p>
              <TactileButton onClick={loadData} className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold">
                Réessayer
              </TactileButton>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur'}
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              {filteredUsers.map((targetUser) => (
                <UserRow
                  key={targetUser._id}
                  user={targetUser}
                  onBan={handleBanUser}
                  onPremium={handlePremiumToggle}
                  onVerify={handleVerifyToggle}
                  onNotify={handleNotifyUser}
                  onDelete={handleDeleteUser}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          )}
        </div>

        {/* MODALS */}
        {confirmModal.show && (
          <ConfirmModal
            title={confirmModal.title}
            message={confirmModal.message}
            onConfirm={confirmModal.onConfirm}
            onCancel={() => setConfirmModal({ show: false })}
            confirmText={confirmModal.confirmText}
            isDanger={confirmModal.isDanger}
          />
        )}

        {notificationModal.show && (
          <NotificationModal
            targetUser={notificationModal.targetUser}
            onSend={handleSendNotification}
            onCancel={() => setNotificationModal({ show: false, targetUser: null })}
          />
        )}
      </div>
    </div>
  );
}