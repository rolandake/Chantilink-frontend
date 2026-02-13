// ==========================================
// 📁 AdminDashboard.jsx - VERSION AVEC SIGNALEMENTS
// ✅ Ajout d'une section pour voir les utilisateurs signalés
// ==========================================
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { 
  Users, Crown, CheckCircle, Ban, Search, RotateCw, 
  Mail, Trash2, AlertCircle, Shield, Clock, Eye, Activity,
  Flag, TrendingUp, AlertTriangle // ✅ NOUVEAUX ICÔNES
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ==========================================
// 🔧 REQUEST HOOK
// ==========================================
const useSecureRequest = (token) => {
  const request = useCallback(async (endpoint, options = {}) => {
    if (!token) {
      throw new Error('Token manquant - Reconnectez-vous');
    }

    console.log(`📡 [API] ${options.method || 'GET'} ${endpoint}`);
    
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json', 
        ...options.headers 
      },
    });
    
    console.log(`📡 [API Response] Status: ${res.status}`);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: 'Erreur serveur' }));
      console.error('❌ [API Error]:', errorData);
      throw new Error(errorData.message || errorData.error || `Erreur ${res.status}`);
    }
    
    const data = await res.json();
    console.log(`✅ [API] Données reçues:`, data);
    return data;
  }, [token]);
  
  return { request };
};

// ==========================================
// 🚨 REPORTED USER CARD - NOUVEAU
// ==========================================
const ReportedUserCard = memo(({ user, onAction, onViewReports }) => {
  const reportCount = user.moderation?.reportCount || 0;
  const strikes = user.moderation?.strikes || 0;
  const riskLevel = user.moderation?.riskLevel || 'low';
  
  const riskColors = {
    low: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    critical: 'bg-red-100 text-red-700 border-red-200',
    banned: 'bg-gray-800 text-white border-gray-900'
  };

  const riskColor = user.isBanned ? riskColors.banned : riskColors[riskLevel] || riskColors.low;

  return (
    <div className="p-4 border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        {/* USER INFO */}
        <div className="flex items-center gap-3 flex-1">
          <div className="relative">
            <img 
              src={user.profilePhoto || '/default-avatar.png'} 
              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" 
              alt="" 
            />
            {user.isBanned && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                <Ban size={10} className="text-white" />
              </div>
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 truncate text-sm">
                {user.fullName || 'Anonyme'}
              </h3>
              {user.isVerified && <Shield size={12} className="text-blue-500" />}
            </div>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        </div>

        {/* RISK BADGE */}
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${riskColor}`}>
          {user.isBanned ? 'BANNI' : riskLevel.toUpperCase()}
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="bg-red-50 p-2 rounded-lg border border-red-100 text-center">
          <p className="text-xs font-bold text-red-600">{reportCount}</p>
          <p className="text-[9px] text-red-500 uppercase">Signalements</p>
        </div>
        <div className="bg-orange-50 p-2 rounded-lg border border-orange-100 text-center">
          <p className="text-xs font-bold text-orange-600">{strikes}/3</p>
          <p className="text-[9px] text-orange-500 uppercase">Strikes</p>
        </div>
        <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 text-center">
          <p className="text-xs font-bold text-gray-600">
            {user.moderation?.warningCount || 0}
          </p>
          <p className="text-[9px] text-gray-500 uppercase">Avertissements</p>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <button 
          onClick={() => onViewReports(user)}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:scale-95"
        >
          <Eye size={14} />
          Voir signalements
        </button>
        <button 
          onClick={() => onAction('ban', user)}
          className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:scale-95 ${
            user.isBanned 
              ? 'bg-green-600 text-white' 
              : 'bg-red-600 text-white'
          }`}
        >
          <Ban size={14} />
          {user.isBanned ? 'Débannir' : 'Bannir'}
        </button>
        <button 
          onClick={() => onAction('delete', user)}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:scale-95"
        >
          <Trash2 size={14} />
          Supprimer
        </button>
      </div>
    </div>
  );
});

// ==========================================
// 🚨 REPORTS MODAL - NOUVEAU
// ==========================================
const ReportsModal = memo(({ user, onClose, request }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReports = async () => {
      try {
        const data = await request(`/reports?reportedUser=${user._id}`);
        setReports(data.reports || []);
      } catch (err) {
        console.error('Erreur chargement signalements:', err);
      } finally {
        setLoading(false);
      }
    };
    loadReports();
  }, [user._id, request]);

  const categoryLabels = {
    spam: '🚫 Spam',
    harassment: '😡 Harcèlement',
    hate_speech: '⚠️ Discours haineux',
    fake_account: '🎭 Faux compte',
    inappropriate_content: '🔞 Contenu inapproprié',
    scam: '💰 Arnaque',
    violence: '🔪 Violence',
    other: '📝 Autre'
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[500] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="p-6 bg-gradient-to-r from-red-600 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black uppercase">Signalements</h2>
              <p className="text-sm opacity-90 mt-1">{user.fullName}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
            >
              <AlertCircle size={24} />
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 border-b">
          <div className="text-center">
            <p className="text-2xl font-black text-red-600">
              {user.moderation?.reportCount || 0}
            </p>
            <p className="text-xs text-gray-600 uppercase font-bold">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-orange-600">
              {user.moderation?.strikes || 0}/3
            </p>
            <p className="text-xs text-gray-600 uppercase font-bold">Strikes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-gray-600">
              {reports.filter(r => r.status === 'pending').length}
            </p>
            <p className="text-xs text-gray-600 uppercase font-bold">En attente</p>
          </div>
        </div>

        {/* LISTE DES SIGNALEMENTS */}
        <div className="overflow-y-auto max-h-96 p-4">
          {loading ? (
            <div className="text-center py-12">
              <RotateCw className="animate-spin mx-auto text-blue-500" size={32} />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Flag size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-bold">Aucun signalement trouvé</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div 
                  key={report._id} 
                  className="p-4 bg-white border rounded-2xl hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {categoryLabels[report.category]?.split(' ')[0] || '📝'}
                      </span>
                      <div>
                        <p className="font-bold text-sm text-gray-900">
                          {categoryLabels[report.category]?.split(' ').slice(1).join(' ') || report.category}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(report.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      report.status === 'pending' 
                        ? 'bg-yellow-100 text-yellow-700'
                        : report.status === 'resolved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  
                  {report.description && (
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                      {report.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
});

// ==========================================
// 👤 USER CARD (INCHANGÉ)
// ==========================================
const UserCard = memo(({ user, onAction }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isOnline = user.isOnline || false;
  const dateInscription = new Date(user.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  return (
    <div className={`transition-all border-b border-gray-100 ${isExpanded ? 'bg-blue-50/40' : 'bg-white'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img 
                src={user.profilePhoto || '/default-avatar.png'} 
                className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" 
                alt="" 
              />
              <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-gray-900 truncate text-sm flex items-center gap-1">
                {user.fullName || 'Anonyme'}
                {user.role === 'admin' && <Shield size={12} className="text-red-500" />}
              </h3>
              <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock size={10} className={isOnline ? 'text-green-600' : 'text-gray-400'} />
                <span className={`text-[9px] font-black uppercase ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                  {isOnline ? 'En ligne' : `Vu: ${new Date(user.lastSeen || user.updatedAt).toLocaleDateString()}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {user.isBanned && <span className="px-2 py-0.5 text-[8px] font-black rounded bg-red-600 text-white uppercase">Banni</span>}
            {user.isPremium && <span className="px-2 py-0.5 text-[8px] font-black rounded bg-orange-500 text-white uppercase">Élite</span>}
            {user.isVerified && <span className="px-2 py-0.5 text-[8px] font-black rounded bg-blue-600 text-white uppercase">Certifié</span>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
            <p className="text-[8px] font-bold text-gray-400 uppercase">Amis</p>
            <p className="text-xs font-black text-gray-700">{user.friends?.length || 0}</p>
          </div>
          <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
            <p className="text-[8px] font-bold text-gray-400 uppercase">Téléphone</p>
            <p className="text-xs font-black text-gray-700">{user.phone ? '✅' : '—'}</p>
          </div>
          <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
            <p className="text-[8px] font-bold text-gray-400 uppercase">Vérifié</p>
            <p className="text-xs font-black text-gray-700">{user.phoneVerified ? '✅' : '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4">
          <button onClick={() => onAction('notify', user)} className="flex flex-col items-center p-2 bg-blue-50 text-blue-600 rounded-xl active:scale-95">
            <Mail size={18}/><span className="text-[8px] font-bold mt-1">Message</span>
          </button>
          <button onClick={() => onAction('ban', user)} className={`flex flex-col items-center p-2 rounded-xl active:scale-95 ${user.isBanned ? 'bg-green-600 text-white' : 'bg-red-50 text-red-600'}`}>
            <Ban size={18}/><span className="text-[8px] font-bold mt-1">{user.isBanned ? 'Libérer' : 'Bannir'}</span>
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className={`flex flex-col items-center p-2 rounded-xl active:scale-95 ${isExpanded ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600'}`}>
            <Eye size={18}/><span className="text-[8px] font-black mt-1 uppercase">Détails</span>
          </button>
          <button onClick={() => onAction('premium', user)} className="flex flex-col items-center p-2 bg-gray-100 text-gray-600 rounded-xl active:scale-95">
            <Crown size={18}/><span className="text-[8px] font-bold mt-1">Élite</span>
          </button>
        </div>

        {isExpanded && (
          <div className="mt-4 p-4 bg-white rounded-2xl border-2 border-orange-200">
            <h4 className="text-[10px] font-black text-orange-600 uppercase mb-3 flex items-center gap-2">
              <Activity size={12}/> Informations
            </h4>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span className="text-gray-400">Inscrit</span>
                <span className="font-bold text-gray-700">{dateInscription}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span className="text-gray-400">Email</span>
                <span className="font-bold text-gray-700">{user.email}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span className="text-gray-400">Téléphone</span>
                <span className="font-bold text-gray-700">{user.phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rôle</span>
                <span className="font-bold text-gray-700">{user.role}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={() => onAction('verify', user)} className="py-2 bg-blue-600 text-white text-[9px] font-black rounded-lg uppercase">
                {user.isVerified ? 'Retirer' : 'Certifier'}
              </button>
              <button onClick={() => onAction('delete', user)} className="py-2 bg-red-100 text-red-600 text-[9px] font-black rounded-lg uppercase">
                Supprimer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ==========================================
// 🚀 DASHBOARD PRINCIPAL
// ==========================================
export default function AdminDashboard() {
  const { user, token } = useAuth();
  const { request } = useSecureRequest(token);
  
  const [users, setUsers] = useState([]);
  const [reportedUsers, setReportedUsers] = useState([]); // ✅ NOUVEAU
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ show: false });
  const [notificationModal, setNotificationModal] = useState({ show: false, targetUser: null });
  const [reportsModal, setReportsModal] = useState({ show: false, user: null }); // ✅ NOUVEAU
  const [activeTab, setActiveTab] = useState('all'); // ✅ NOUVEAU: 'all' ou 'reported'

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const loadUsers = useCallback(async () => {
    if (!token) {
      console.warn("⚠️ [loadUsers] Pas de token");
      addToast("Non connecté - Reconnectez-vous", "error");
      return;
    }
    
    setLoading(true);
    try {
      console.log("📡 [loadUsers] Chargement utilisateurs...");
      const data = await request('/admin/users');
      
      console.log("✅ [loadUsers] Réponse API:", data);
      
      if (data.success && Array.isArray(data.users)) {
        console.log(`✅ [loadUsers] ${data.users.length} utilisateurs`);
        setUsers(data.users);
        
        // ✅ NOUVEAU : Filtrer les utilisateurs signalés
        const reported = data.users.filter(u => 
          u.moderation?.reportCount > 0 || u.moderation?.strikes > 0
        ).sort((a, b) => 
          (b.moderation?.reportCount || 0) - (a.moderation?.reportCount || 0)
        );
        setReportedUsers(reported);
        console.log(`🚨 ${reported.length} utilisateurs signalés`);
      } else {
        throw new Error("Format invalide");
      }
      
    } catch (err) { 
      console.error("❌ [loadUsers] Erreur:", err);
      addToast(err.message || 'Erreur serveur', 'error'); 
    } finally { 
      setLoading(false); 
    }
  }, [request, token]);

  useEffect(() => {
    if (!user) {
      console.warn("⚠️ Utilisateur non chargé");
      return;
    }
    
    if (!['admin', 'superadmin', 'moderator'].includes(user.role)) {
      console.error("❌ Accès refusé - Rôle:", user.role);
      addToast("Accès refusé - Admin requis", "error");
      return;
    }
    
    console.log("✅ Utilisateur admin vérifié:", user.role);
  }, [user]);

  useEffect(() => { 
    if (token && user?.role === 'admin') {
      console.log("🔑 [useEffect] Token présent, chargement...");
      loadUsers(); 
    }
  }, [token, user, loadUsers]);

  const stats = useMemo(() => ({
    total: users.length,
    premium: users.filter(u => u.isPremium).length,
    verified: users.filter(u => u.isVerified).length,
    banned: users.filter(u => u.isBanned).length,
    reported: reportedUsers.length, // ✅ NOUVEAU
  }), [users, reportedUsers]);

  const handleUserAction = useCallback(async (action, targetUser) => {
    if (action === 'notify') { 
      setNotificationModal({ show: true, targetUser }); 
      return; 
    }
    
    const configs = {
      ban: { 
        title: targetUser.isBanned ? 'Gracier' : 'Bannir', 
        endpoint: `/admin/users/${targetUser._id}/ban`, 
        method: 'PATCH', 
        isDanger: !targetUser.isBanned 
      },
      premium: { 
        title: 'Statut Élite', 
        endpoint: `/admin/users/${targetUser._id}/premium`, 
        method: 'PATCH' 
      },
      verify: { 
        title: 'Certification', 
        endpoint: `/admin/users/${targetUser._id}`, 
        method: 'PATCH', 
        body: { isVerified: !targetUser.isVerified } 
      },
      delete: { 
        title: 'SUPPRESSION', 
        endpoint: `/admin/users/${targetUser._id}`, 
        method: 'DELETE', 
        isDanger: true 
      }
    };

    const config = configs[action];
    
    setConfirmModal({
      show: true,
      ...config,
      onConfirm: async () => {
        try {
          await request(config.endpoint, { 
            method: config.method, 
            body: config.body ? JSON.stringify(config.body) : undefined 
          });
          addToast('Action effectuée', 'success');
          loadUsers();
        } catch (err) { 
          addToast(err.message || 'Erreur', 'error'); 
        }
        setConfirmModal({ show: false });
      }
    });
  }, [request, loadUsers]);

  const filteredUsers = useMemo(() => 
    users.filter(u => 
      (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  , [users, searchQuery]);

  const filteredReportedUsers = useMemo(() => 
    reportedUsers.filter(u => 
      (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  , [reportedUsers, searchQuery]);

  if (!user) {
    return (
      <div className="p-20 text-center">
        <p className="text-gray-600">⏳ Chargement...</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="p-20 text-center">
        <p className="text-red-600 font-bold">❌ Non connecté</p>
      </div>
    );
  }

  if (!['admin', 'superadmin', 'moderator'].includes(user.role)) {
    return (
      <div className="p-20 text-center">
        <p className="text-red-600 font-bold text-xl mb-2">⛔ Accès refusé</p>
        <p className="text-gray-600">Vous devez être administrateur</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* TOASTS */}
      <div className="fixed top-4 left-4 right-4 z-[300] space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`p-4 rounded-2xl text-white font-black text-center shadow-2xl ${
              t.type === 'error' ? 'bg-red-600' : 'bg-green-600'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* HEADER */}
      <div className="bg-white p-4 sticky top-0 z-40 border-b shadow-sm">
        <div className="flex justify-between items-center mb-4 max-w-4xl mx-auto">
          <h1 className="text-xl font-black text-blue-600">ADMIN DASHBOARD</h1>
          <button 
            onClick={loadUsers} 
            className="p-2 bg-gray-100 rounded-full active:rotate-180 transition-all"
          >
            <RotateCw size={18}/>
          </button>
        </div>
        
        <div className="flex gap-2 max-w-4xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..." 
              className="w-full pl-9 pr-4 py-3 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 ring-blue-500"
            />
          </div>
          <button 
            onClick={() => setNotificationModal({ show: true, targetUser: null })} 
            className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90"
          >
            <Mail size={22}/>
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 p-4 max-w-4xl mx-auto">
        <div className="bg-blue-600 p-4 rounded-[28px] text-white shadow-lg">
          <p className="text-[10px] font-black opacity-70 uppercase">Membres</p>
          <p className="text-3xl font-black">{stats.total}</p>
        </div>
        <div className="bg-orange-500 p-4 rounded-[28px] text-white shadow-lg">
          <p className="text-[10px] font-black opacity-70 uppercase">Élite</p>
          <p className="text-3xl font-black">{stats.premium}</p>
        </div>
        <div className="bg-green-600 p-4 rounded-[28px] text-white shadow-lg">
          <p className="text-[10px] font-black opacity-70 uppercase">Vérifiés</p>
          <p className="text-3xl font-black">{stats.verified}</p>
        </div>
        {/* ✅ NOUVEAU : Stat signalements */}
        <div className="bg-red-600 p-4 rounded-[28px] text-white shadow-lg">
          <p className="text-[10px] font-black opacity-70 uppercase">Signalés</p>
          <p className="text-3xl font-black">{stats.reported}</p>
        </div>
      </div>

      {/* ✅ NOUVEAU : TABS */}
      <div className="max-w-4xl mx-auto px-4 mb-4">
        <div className="bg-white rounded-2xl p-2 flex gap-2 shadow-sm border">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users size={16} className="inline mr-2" />
            Tous ({filteredUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('reported')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'reported'
                ? 'bg-red-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Flag size={16} className="inline mr-2" />
            Signalés ({filteredReportedUsers.length})
          </button>
        </div>
      </div>

      {/* LISTE */}
      <div className="max-w-4xl mx-auto px-4 mt-2">
        <div className="bg-white rounded-[32px] shadow-sm border overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-500 uppercase">
              {activeTab === 'all' 
                ? `Registre (${filteredUsers.length})` 
                : `Signalements (${filteredReportedUsers.length})`
              }
            </span>
            <Activity size={14} className="text-gray-400" />
          </div>
          
          {loading ? (
            <div className="p-20 text-center">
              <RotateCw className="animate-spin mx-auto text-blue-500" />
            </div>
          ) : activeTab === 'all' ? (
            filteredUsers.length === 0 ? (
              <div className="p-20 text-center text-gray-400 font-bold">
                Aucun résultat
              </div>
            ) : (
              filteredUsers.map(u => (
                <UserCard key={u._id} user={u} onAction={handleUserAction} />
              ))
            )
          ) : (
            filteredReportedUsers.length === 0 ? (
              <div className="p-20 text-center text-gray-400 font-bold">
                <Flag size={48} className="mx-auto mb-4 opacity-50" />
                Aucun utilisateur signalé
              </div>
            ) : (
              filteredReportedUsers.map(u => (
                <ReportedUserCard 
                  key={u._id} 
                  user={u} 
                  onAction={handleUserAction}
                  onViewReports={(user) => setReportsModal({ show: true, user })}
                />
              ))
            )
          )}
        </div>
      </div>

      {/* MODAL CONFIRMATION */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[400] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className={confirmModal.isDanger ? 'text-red-600' : 'text-blue-600'} />
            </div>
            <h2 className={`text-xl font-black text-center mb-2 ${confirmModal.isDanger ? 'text-red-600' : 'text-gray-900'}`}>
              {confirmModal.title}
            </h2>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={confirmModal.onConfirm} 
                className={`flex-1 py-4 rounded-2xl font-black text-white ${
                  confirmModal.isDanger ? 'bg-red-600' : 'bg-blue-600'
                } uppercase text-xs`}
              >
                Confirmer
              </button>
              <button 
                onClick={() => setConfirmModal({ show: false })} 
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase text-xs"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOTIFICATION */}
      {notificationModal.show && (
        <div className="fixed inset-0 bg-black/70 z-[400] flex items-end">
          <div className="bg-white w-full max-w-md rounded-t-[50px] p-8 pb-12 shadow-2xl mx-auto">
            <div className="w-12 h-1.5 bg-gray-200 mx-auto mb-8 rounded-full" />
            <h2 className="text-2xl font-black mb-6 uppercase">Notification</h2>
            <p className="text-gray-400 text-[10px] font-bold uppercase mb-4">
              {notificationModal.targetUser ? `À: ${notificationModal.targetUser.fullName}` : 'Destinataire: Tous'}
            </p>
            <input 
              id="n-title" 
              type="text" 
              placeholder="Titre" 
              className="w-full p-4 bg-gray-100 rounded-2xl mb-3 outline-none focus:ring-2 ring-blue-500" 
            />
            <textarea 
              id="n-msg" 
              placeholder="Message..." 
              rows={5} 
              className="w-full p-4 bg-gray-100 rounded-2xl mb-8 outline-none resize-none focus:ring-2 ring-blue-500" 
            />
            <div className="flex gap-3">
              <button 
                onClick={async () => {
                  const t = document.getElementById('n-title').value;
                  const m = document.getElementById('n-msg').value;
                  if (!t || !m) { 
                    addToast('Champs vides', 'error'); 
                    return; 
                  }
                  try {
                    await request('/admin/notifications', { 
                      method: 'POST', 
                      body: JSON.stringify({ 
                        title: t, 
                        message: m, 
                        userId: notificationModal.targetUser?._id 
                      }) 
                    });
                    addToast('Envoyé', 'success');
                    setNotificationModal({ show: false });
                  } catch (e) { 
                    addToast('Erreur', 'error'); 
                  }
                }} 
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs"
              >
                Envoyer
              </button>
              <button 
                onClick={() => setNotificationModal({ show: false })} 
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NOUVEAU : MODAL REPORTS */}
      {reportsModal.show && (
        <ReportsModal
          user={reportsModal.user}
          onClose={() => setReportsModal({ show: false, user: null })}
          request={request}
        />
      )}
    </div>
  );
}