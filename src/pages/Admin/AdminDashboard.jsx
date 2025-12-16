import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Crown, CheckCircle, Ban, Search, RotateCw, Mail, Settings, Brain, Trash2, Lock, AlertCircle } from 'lucide-react';

// ✅ CORRECTION : Même logique que AuthContext
const getApiUrl = () => {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (isDev) {
    return import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:5000/api';
  } else {
    return import.meta.env.VITE_API_URL_PROD || 'https://chantilink-backend.onrender.com/api';
  }
};

const API_URL = getApiUrl();

console.log('🔧 [AdminDashboard] API_URL:', API_URL);
console.log('🔧 [AdminDashboard] Hostname:', window.location.hostname);
console.log('🔧 [AdminDashboard] Mode:', import.meta.env.MODE);

// Hook pour récupérer le token depuis AuthContext
const useAuthToken = () => {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getStoredToken = () => {
      try {
        const activeUserId = JSON.parse(localStorage.getItem('chantilink_active_user_v6'));
        if (!activeUserId) return null;

        const users = JSON.parse(localStorage.getItem('chantilink_users_enc_v6'));
        if (!users || !users[activeUserId]) return null;

        const userData = users[activeUserId];
        
        if (userData.expiresAt && userData.expiresAt > Date.now()) {
          console.log('✅ [AdminDashboard] Token trouvé et valide');
          return userData.token;
        }
        
        console.warn('⚠️ [AdminDashboard] Token expiré');
        return null;
      } catch (err) {
        console.error('❌ [AdminDashboard] Erreur lecture token:', err);
        return null;
      }
    };

    const foundToken = getStoredToken();
    setToken(foundToken);
    setLoading(false);
  }, []);

  return { token, loading };
};

// Hook pour les requêtes API sécurisées
const useSecureRequest = (token) => {
  const request = useCallback(async (endpoint, options = {}) => {
    if (!token) {
      throw new Error('Token manquant - Veuillez vous reconnecter');
    }

    try {
      console.log(`🌐 [AdminDashboard] Requête: ${API_URL}${endpoint}`);
      const res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Erreur réseau' }));
        console.error('❌ [AdminDashboard] Erreur API:', error);
        throw new Error(error.message || error.error || 'Erreur réseau');
      }

      const data = await res.json();
      console.log(`✅ [AdminDashboard] Réponse:`, data);
      return data;
    } catch (err) {
      console.error('❌ [AdminDashboard] Erreur complète:', err);
      throw err;
    }
  }, [token]);

  return { request };
};

// Composant Toast
const Toast = ({ message, type = 'info', onClose }) => {
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
  };

  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 ${colors[type]} text-white px-6 py-4 rounded-lg shadow-2xl z-50 animate-slideIn flex items-center gap-3`}>
      <AlertCircle className="w-5 h-5" />
      <span className="font-semibold">{message}</span>
      <button onClick={onClose} className="ml-4 hover:opacity-70">✕</button>
    </div>
  );
};

// Modal de confirmation
const ConfirmModal = ({ title, message, onConfirm, onCancel, isDanger = false }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scaleIn">
      <h3 className="text-2xl font-bold mb-3">{title}</h3>
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          className={`flex-1 py-3 rounded-xl font-bold text-white ${isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} transition-colors`}
        >
          Confirmer
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl font-bold bg-gray-200 hover:bg-gray-300 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  </div>
);

// Modal de notification
const NotificationModal = ({ targetUser, onSend, onCancel }) => {
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scaleIn">
        <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Mail className="text-blue-500" /> Envoyer une notification
        </h3>

        {targetUser && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="font-semibold">À : {targetUser.fullName || targetUser.email}</p>
          </div>
        )}

        {!targetUser && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
            <p className="text-yellow-800 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Sera envoyée à TOUS les utilisateurs
            </p>
          </div>
        )}

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de la notification..."
          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 outline-none mb-3 font-semibold"
        />

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message..."
          rows={4}
          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 outline-none mb-4 resize-none"
        />

        <div className="flex gap-3">
          <button
            onClick={handleSend}
            disabled={!title.trim() || !message.trim() || sending}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl font-bold transition-colors"
          >
            {sending ? 'Envoi...' : 'ENVOYER'}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 rounded-xl font-bold transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

// Carte de statistique
const StatCard = ({ icon: Icon, label, value, color, bgColor }) => (
  <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
    <div className="flex items-center gap-3 mb-2">
      <div className={`p-3 rounded-lg ${bgColor}`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
    </div>
    <div className="text-4xl font-bold text-gray-900">{value}</div>
  </div>
);

// Ligne utilisateur
const UserRow = ({ user, onAction }) => {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusBadge = () => {
    if (user.isBanned) return <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-500 text-white">BANNI</span>;
    if (user.isPremium) return <span className="px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 text-white">ÉLITE</span>;
    if (user.isVerified) return <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-500 text-white">VÉRIFIÉ</span>;
    return <span className="px-3 py-1 text-xs font-bold rounded-full bg-gray-400 text-white">STANDARD</span>;
  };

  const getRoleBadge = () => {
    const colors = {
      superadmin: 'bg-purple-600',
      admin: 'bg-red-600',
      moderator: 'bg-orange-600',
      user: 'bg-gray-600',
    };
    return <span className={`px-3 py-1 text-xs font-bold rounded-full text-white ${colors[user.role] || 'bg-gray-600'}`}>{(user.role || 'user').toUpperCase()}</span>;
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        <img
          src={user.profilePhoto || '/default-avatar.png'}
          alt={user.fullName}
          className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-200"
        />
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-bold text-lg">{user.fullName || user.username || 'Anonyme'}</h3>
            {getStatusBadge()}
            {getRoleBadge()}
          </div>
          <p className="text-sm text-gray-600 font-medium">{user.email}</p>
          <div className="flex gap-4 text-xs text-gray-500 mt-1">
            <span>Inscrit: {new Date(user.createdAt).toLocaleDateString('fr-FR')}</span>
            <span>{user.posts?.length || 0} posts</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onAction('notify', user)}
          className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          title="Envoyer notification"
        >
          <Mail className="w-5 h-5" />
        </button>

        <button
          onClick={() => onAction('ban', user)}
          className={`p-3 ${user.isBanned ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg transition-colors`}
          title={user.isBanned ? 'Débannir' : 'Bannir'}
        >
          <Ban className="w-5 h-5" />
        </button>

        <button
          onClick={() => onAction('premium', user)}
          className={`p-3 ${user.isPremium ? 'bg-gray-500' : 'bg-gradient-to-r from-yellow-400 to-orange-400'} text-white rounded-lg transition-colors`}
          title={user.isPremium ? 'Retirer Premium' : 'Activer Premium'}
        >
          <Crown className="w-5 h-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-14 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 p-2 z-20">
                <button
                  onClick={() => { onAction('verify', user); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 flex items-center gap-3 font-semibold transition-colors"
                >
                  <CheckCircle className="w-4 h-4" /> {user.isVerified ? 'Retirer badge' : 'Certifier'}
                </button>
                <button
                  onClick={() => { onAction('delete', user); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-red-50 text-red-600 flex items-center gap-3 font-semibold transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Composant principal
export default function AdminDashboard() {
  const { token, loading: tokenLoading } = useAuthToken();
  const { request } = useSecureRequest(token);
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ show: false });
  const [notificationModal, setNotificationModal] = useState({ show: false, targetUser: null });

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const loadUsers = useCallback(async () => {
    if (!token) {
      console.warn('⚠️ [AdminDashboard] Pas de token disponible');
      return;
    }
    
    setLoading(true);
    try {
      const data = await request('/admin/users');
      setUsers(data.users || []);
      addToast(`${data.users?.length || 0} utilisateurs chargés`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [request, addToast, token]);

  const handleUserAction = useCallback(async (action, user) => {
    const actions = {
      ban: {
        title: user.isBanned ? 'Débannir utilisateur' : 'Bannir utilisateur',
        message: `${user.isBanned ? 'Débannir' : 'Bannir'} ${user.fullName || user.email} ?`,
        endpoint: `/admin/users/${user._id}/ban`,
        method: 'PATCH',
        isDanger: !user.isBanned,
      },
      premium: {
        title: user.isPremium ? 'Retirer Premium' : 'Activer Premium',
        message: `${user.isPremium ? 'Retirer' : 'Donner'} le statut Premium à ${user.fullName || user.email} ?`,
        endpoint: `/admin/users/${user._id}/premium`,
        method: 'PATCH',
      },
      verify: {
        title: user.isVerified ? 'Retirer certification' : 'Certifier utilisateur',
        message: `${user.isVerified ? 'Retirer' : 'Donner'} le badge vérifié à ${user.fullName || user.email} ?`,
        endpoint: `/admin/users/${user._id}`,
        method: 'PATCH',
        body: { isVerified: !user.isVerified },
      },
      delete: {
        title: 'SUPPRESSION DÉFINITIVE',
        message: `Supprimer ${user.fullName || user.email} ? Cette action est IRRÉVERSIBLE !`,
        endpoint: `/admin/users/${user._id}`,
        method: 'DELETE',
        isDanger: true,
      },
    };

    if (action === 'notify') {
      setNotificationModal({ show: true, targetUser: user });
      return;
    }

    const config = actions[action];
    setConfirmModal({
      show: true,
      ...config,
      onConfirm: async () => {
        try {
          await request(config.endpoint, {
            method: config.method,
            body: config.body ? JSON.stringify(config.body) : undefined,
          });
          addToast('Action effectuée avec succès', 'success');
          loadUsers();
        } catch (err) {
          addToast(err.message, 'error');
        }
        setConfirmModal({ show: false });
      },
    });
  }, [request, addToast, loadUsers]);

  const handleSendNotification = useCallback(async (title, message, userId) => {
    try {
      await request('/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({ title, message, userId }),
      });
      addToast('Notification envoyée !', 'success');
      setNotificationModal({ show: false, targetUser: null });
    } catch (err) {
      addToast(err.message, 'error');
    }
  }, [request, addToast]);

  useEffect(() => {
    if (token && !tokenLoading) loadUsers();
  }, [token, tokenLoading, loadUsers]);

  const stats = useMemo(() => ({
    total: users.length,
    premium: users.filter(u => u.isPremium).length,
    verified: users.filter(u => u.isVerified).length,
    banned: users.filter(u => u.isBanned).length,
  }), [users]);

  const filteredUsers = useMemo(() =>
    users.filter(u =>
      (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    ), [users, searchQuery]);

  if (tokenLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">Vérification de votre session...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-md">
          <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Accès Refusé</h2>
          <p className="text-gray-600 mb-6">
            Vous devez être connecté en tant qu'administrateur pour accéder à cette page.
          </p>
          
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 text-left">
            <p className="text-sm text-blue-800 mb-2">
              <strong>🔍 Diagnostic :</strong>
            </p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Token introuvable dans localStorage</li>
              <li>• Vérifiez que vous êtes connecté</li>
              <li>• Le token peut avoir expiré</li>
            </ul>
          </div>
          
          <button
            onClick={() => window.location.href = '/login'}
            className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors"
          >
            Retour à la connexion
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full mt-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-xl font-bold transition-colors"
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Toasts */}
        {toasts.map(t => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
          />
        ))}

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-5xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                Chantilink Admin
              </h1>
              <p className="text-xl text-gray-600">Panneau de contrôle administrateur</p>
            </div>
            <button
              onClick={() => setNotificationModal({ show: true, targetUser: null })}
              className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              <Mail className="w-5 h-5" /> NOTIFIER TOUS
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard icon={Users} label="Total" value={stats.total} color="text-blue-600" bgColor="bg-blue-100" />
          <StatCard icon={Crown} label="Premium" value={stats.premium} color="text-yellow-600" bgColor="bg-yellow-100" />
          <StatCard icon={CheckCircle} label="Vérifiés" value={stats.verified} color="text-green-600" bgColor="bg-green-100" />
          <StatCard icon={Ban} label="Bannis" value={stats.banned} color="text-red-600" bgColor="bg-red-100" />
        </div>

        {/* Search & Refresh */}
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un utilisateur..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none font-medium"
              />
            </div>
            <button
              onClick={loadUsers}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
            >
              <RotateCw className="w-5 h-5" /> Actualiser
            </button>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4">
            <h2 className="text-2xl font-bold text-white">
              Utilisateurs ({filteredUsers.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-20 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-20 text-center text-gray-500 text-xl">
              Aucun utilisateur trouvé
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {filteredUsers.map(user => (
                <UserRow key={user._id} user={user} onAction={handleUserAction} />
              ))}
            </div>
          )}
        </div>

        {/* Modals */}
        {confirmModal.show && (
          <ConfirmModal
            {...confirmModal}
            onCancel={() => setConfirmModal({ show: false })}
          />
        )}

        {notificationModal.show && (
          <NotificationModal
            {...notificationModal}
            onSend={handleSendNotification}
            onCancel={() => setNotificationModal({ show: false, targetUser: null })}
          />
        )}
      </div>
    </div>
  );
}