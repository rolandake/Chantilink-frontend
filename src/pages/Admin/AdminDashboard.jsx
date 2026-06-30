// ==========================================
// 📁 AdminDashboard.jsx
// ✅ Profils cliquables → navigation /profile/:id
// ✅ NOUVEAU : badge type de compte (Utilisateur / Pro / Entreprise)
// ✅ NOUVEAU : statut "connecté" réel via /admin/online-users (Socket.IO),
//    remplace user.isOnline qui n'était fiable qu'au login/logout
// ✅ NOUVEAU : filtres par type de compte + filtre "en ligne uniquement"
// ✅ Icônes SVG maison (AdminIcons.jsx) au lieu de lucide-react
// ==========================================
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Crown, CheckCircle, Ban, Search, RotateCw,
  Mail, Trash2, AlertCircle, Shield, Clock, Eye, Activity,
  Flag, TrendingUp, AlertTriangle, Briefcase, Building2,
} from '../../components/icons/AdminIcons';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://chantilink-backend.onrender.com/api' : 'http://localhost:5000/api');

// ✅ Intervalle de rafraîchissement du statut "en ligne" (Socket.IO temps réel)
const ONLINE_POLL_INTERVAL = 15000;

// ==========================================
// 🔧 REQUEST HOOK
// ==========================================
const useSecureRequest = (token) => {
  const request = useCallback(async (endpoint, options = {}) => {
    if (!token) throw new Error('Token manquant - Reconnectez-vous');

    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json', 
        ...options.headers 
      },
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: 'Erreur serveur' }));
      throw new Error(errorData.message || errorData.error || `Erreur ${res.status}`);
    }
    return res.json();
  }, [token]);
  
  return { request };
};

// ==========================================
// 🏷️ BADGE TYPE DE COMPTE
// ✅ NOUVEAU — lit user.accountType ("personal" | "pro" | "business")
// ==========================================
const ACCOUNT_TYPE_CONFIG = {
  personal: { label: 'Utilisateur',    color: 'bg-slate-100 text-slate-700 border-slate-200',     Icon: Users },
  pro:      { label: 'Professionnel',  color: 'bg-indigo-100 text-indigo-700 border-indigo-200',  Icon: Briefcase },
  business: { label: 'Entreprise',     color: 'bg-orange-100 text-orange-700 border-orange-200',  Icon: Building2 },
};

const AccountTypeBadge = memo(({ accountType, compact = false }) => {
  const cfg = ACCOUNT_TYPE_CONFIG[accountType] || ACCOUNT_TYPE_CONFIG.personal;
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black rounded border uppercase ${cfg.color}`}>
      <Icon size={9} />
      {!compact && cfg.label}
    </span>
  );
});
AccountTypeBadge.displayName = 'AccountTypeBadge';

// ==========================================
// 🖼️ AVATAR CLIQUABLE — composant partagé
// ✅ isOnline reçu en prop (calculé depuis le tracker temps réel, pas user.isOnline)
// ==========================================
const ClickableAvatar = memo(({ user, size = 48, navigate, isOnline }) => {
  const handleClick = (e) => {
    e.stopPropagation();
    if (!user?._id || ['unknown', 'null', 'undefined'].includes(String(user._id))) return;
    navigate(`/profile/${user._id}`);
  };

  return (
    <button
      onClick={handleClick}
      className="relative flex-shrink-0 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400"
      style={{ width: size, height: size }}
      title={`Voir le profil de ${user?.fullName || 'cet utilisateur'}`}
    >
      <img 
        src={user?.profilePhoto || '/default-avatar.png'} 
        className="w-full h-full object-cover"
        alt={user?.fullName || ''}
      />
      {user?.isBanned && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
          <Ban size={10} className="text-white" />
        </div>
      )}
      {!user?.isBanned && isOnline && (
        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white animate-pulse" />
      )}
    </button>
  );
});
ClickableAvatar.displayName = 'ClickableAvatar';

const getFollowersCount = (user) => {
  const raw = user?.followersCount ?? user?.followers?.length ?? 0;
  return Number.isFinite(Number(raw)) ? Number(raw) : 0;
};

// ==========================================
// 🚨 REPORTED USER CARD
// ==========================================
const ReportedUserCard = memo(({ user, onAction, onViewReports, navigate, onlineUserIds }) => {
  const reportCount = user.moderation?.reportCount || 0;
  const strikes     = user.moderation?.strikes || 0;
  const riskLevel   = user.moderation?.riskLevel || 'low';
  const followersCount = getFollowersCount(user);
  const isOnline = onlineUserIds?.has(String(user._id)) || false;
  
  const riskColors = {
    low:      'bg-green-100 text-green-700 border-green-200',
    medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
    high:     'bg-orange-100 text-orange-700 border-orange-200',
    critical: 'bg-red-100 text-red-700 border-red-200',
    banned:   'bg-gray-800 text-white border-gray-900',
  };
  const riskColor = user.isBanned ? riskColors.banned : (riskColors[riskLevel] || riskColors.low);

  const goToProfile = (e) => {
    e.stopPropagation();
    if (user._id) navigate(`/profile/${user._id}`);
  };

  return (
    <div className="p-4 border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1">
          <ClickableAvatar user={user} size={48} navigate={navigate} isOnline={isOnline} />
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {/* ✅ Nom cliquable → profil */}
              <button
                onClick={goToProfile}
                className="font-bold text-gray-900 truncate text-sm hover:text-blue-600 hover:underline transition-colors text-left"
              >
                {user.fullName || 'Anonyme'}
              </button>
              {user.isVerified && <Shield size={12} className="text-blue-500 flex-shrink-0" />}
            </div>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <AccountTypeBadge accountType={user.accountType} />
              {isOnline && (
                <span className="text-[8px] font-black text-green-600 uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> En ligne
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full text-xs font-bold border flex-shrink-0 ${riskColor}`}>
          {user.isBanned ? 'BANNI' : riskLevel.toUpperCase()}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3">
        <div className="bg-blue-50 p-2 rounded-lg border border-blue-100 text-center">
          <p className="text-xs font-bold text-blue-600">{followersCount.toLocaleString('fr-FR')}</p>
          <p className="text-[9px] text-blue-500 uppercase">Abonnés</p>
        </div>
        <div className="bg-red-50 p-2 rounded-lg border border-red-100 text-center">
          <p className="text-xs font-bold text-red-600">{reportCount}</p>
          <p className="text-[9px] text-red-500 uppercase">Signalements</p>
        </div>
        <div className="bg-orange-50 p-2 rounded-lg border border-orange-100 text-center">
          <p className="text-xs font-bold text-orange-600">{strikes}/3</p>
          <p className="text-[9px] text-orange-500 uppercase">Strikes</p>
        </div>
        <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 text-center">
          <p className="text-xs font-bold text-gray-600">{user.moderation?.warningCount || 0}</p>
          <p className="text-[9px] text-gray-500 uppercase">Avertissements</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <button 
          onClick={() => onViewReports(user)}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:scale-95"
        >
          <Eye size={14} /> Signalements
        </button>
        <button 
          onClick={() => onAction('ban', user)}
          className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:scale-95 ${
            user.isBanned ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          <Ban size={14} /> {user.isBanned ? 'Débannir' : 'Bannir'}
        </button>
        <button 
          onClick={() => onAction('delete', user)}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:scale-95"
        >
          <Trash2 size={14} /> Supprimer
        </button>
      </div>
    </div>
  );
});
ReportedUserCard.displayName = 'ReportedUserCard';

// ==========================================
// 🚨 REPORTS MODAL
// ==========================================
const ReportsModal = memo(({ user, onClose, request }) => {
  const [reports, setReports]   = useState([]);
  const [loading, setLoading]   = useState(true);

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
    spam:                   '🚫 Spam',
    harassment:             '😡 Harcèlement',
    hate_speech:            '⚠️ Discours haineux',
    fake_account:           '🎭 Faux compte',
    inappropriate_content:  '🔞 Contenu inapproprié',
    scam:                   '💰 Arnaque',
    violence:               '🔪 Violence',
    other:                  '📝 Autre',
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[500] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-red-600 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black uppercase">Signalements</h2>
              <p className="text-sm opacity-90 mt-1">{user.fullName}</p>
            </div>
            <button onClick={onClose} className="p-2 bg-white/20 rounded-full hover:bg-white/30">
              <AlertCircle size={24} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 border-b">
          <div className="text-center">
            <p className="text-2xl font-black text-red-600">{user.moderation?.reportCount || 0}</p>
            <p className="text-xs text-gray-600 uppercase font-bold">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-orange-600">{user.moderation?.strikes || 0}/3</p>
            <p className="text-xs text-gray-600 uppercase font-bold">Strikes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-gray-600">
              {reports.filter(r => r.status === 'pending').length}
            </p>
            <p className="text-xs text-gray-600 uppercase font-bold">En attente</p>
          </div>
        </div>

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
                <div key={report._id} className="p-4 bg-white border rounded-2xl hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{categoryLabels[report.category]?.split(' ')[0] || '📝'}</span>
                      <div>
                        <p className="font-bold text-sm text-gray-900">
                          {categoryLabels[report.category]?.split(' ').slice(1).join(' ') || report.category}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(report.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      report.status === 'pending'  ? 'bg-yellow-100 text-yellow-700' :
                      report.status === 'resolved' ? 'bg-green-100 text-green-700'  : 'bg-gray-100 text-gray-700'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  {report.description && (
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{report.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end">
          <button onClick={onClose} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
});
ReportsModal.displayName = 'ReportsModal';

const actionLabels = {
  post_create: 'Création',
  post_update: 'Modification',
  post_delete: 'Suppression',
  view: 'Vue',
  like: 'Like',
  unlike: 'Unlike',
  comment: 'Commentaire',
  reply: 'Réponse',
  comment_like: 'Like commentaire',
  comment_unlike: 'Unlike commentaire',
  share: 'Partage',
  feedback: 'Feedback',
};

const ContentActionsPanel = memo(({ actions = [], summary = {} }) => {
  const visibleActions = actions.filter((item) => item.action !== 'feedback');
  return (
  <div className="w-full">
    <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase font-black text-gray-500">Traçabilité contenu</p>
          <p className="text-xs text-gray-400">Vues, likes, commentaires, partages et modifications enregistrés côté serveur.</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-black text-gray-500">Actions</p>
          <p className="text-lg font-black text-gray-900">{summary.total || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 p-4 bg-gray-50 border-b">
        {['view', 'like', 'comment', 'share', 'post_create', 'post_update'].map((key) => (
          <div key={key} className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className="text-sm font-black text-gray-900">{summary[key] || 0}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase truncate">{actionLabels[key]}</p>
          </div>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {visibleActions.length === 0 ? (
          <div className="text-sm text-gray-500 py-6 text-center">Aucune action de contenu enregistrée.</div>
        ) : (
          visibleActions.slice(0, 15).map((item) => {
            const actorName = item.actor?.fullName || item.actor?.username || item.actorSnapshot?.fullName || 'Utilisateur';
            const ownerName = item.targetUser?.fullName || item.targetUser?.username || 'Créateur';
            const postText = item.post?.content || item.metadata?.contentPreview || 'Publication';
            return (
              <div key={item._id} className="rounded-3xl bg-gray-50 p-4 border border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase font-black text-blue-600">{actionLabels[item.action] || item.action}</p>
                    <p className="text-sm font-bold text-gray-900 truncate mt-1">{actorName} → {ownerName}</p>
                    <p className="text-xs text-gray-500 truncate mt-1">{postText}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] font-bold text-gray-400">
                      {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">{item.request?.region || 'GLOBAL'}</p>
                  </div>
                </div>
                {item.action === 'view' && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="bg-white rounded-xl p-2 border text-center">
                      <p className="text-xs font-black text-gray-700">{item.metadata?.counted ? 'Oui' : 'Non'}</p>
                      <p className="text-[9px] text-gray-400 uppercase">Comptée</p>
                    </div>
                    <div className="bg-white rounded-xl p-2 border text-center">
                      <p className="text-xs font-black text-gray-700">{Math.round(item.metadata?.watchPct || 0)}%</p>
                      <p className="text-[9px] text-gray-400 uppercase">Visionné</p>
                    </div>
                    <div className="bg-white rounded-xl p-2 border text-center">
                      <p className="text-xs font-black text-gray-700">{Math.round(item.metadata?.watchTime || 0)}s</p>
                      <p className="text-[9px] text-gray-400 uppercase">Temps</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  </div>
  );
});
ContentActionsPanel.displayName = 'ContentActionsPanel';

// ==========================================
// 👤 USER CARD
// ✅ isOnline calculé depuis onlineUserIds (tracker Socket.IO temps réel)
// ✅ Badge type de compte affiché
// ==========================================
const UserCard = memo(({ user, onAction, navigate, onlineUserIds }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isOnline = onlineUserIds?.has(String(user._id)) || false;
  const followersCount = getFollowersCount(user);
  const dateInscription = new Date(user.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  const goToProfile = (e) => {
    e.stopPropagation();
    if (user._id) navigate(`/profile/${user._id}`);
  };

  return (
    <div className={`transition-all border-b border-gray-100 ${isExpanded ? 'bg-blue-50/40' : 'bg-white hover:bg-slate-50'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* ✅ Avatar cliquable avec pastille en ligne réelle */}
            <ClickableAvatar user={user} size={56} navigate={navigate} isOnline={isOnline} />

            <div className="min-w-0">
              {/* ✅ Nom cliquable */}
              <button
                onClick={goToProfile}
                className="font-black text-gray-900 truncate text-sm flex items-center gap-1 hover:text-blue-600 hover:underline transition-colors text-left"
              >
                {user.fullName || 'Anonyme'}
                {user.role === 'admin' && <Shield size={12} className="text-red-500 flex-shrink-0" />}
              </button>
              <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <AccountTypeBadge accountType={user.accountType} />
                <button
                  onClick={goToProfile}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-600 hover:bg-blue-100"
                >
                  Voir le profil
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock size={10} className={isOnline ? 'text-green-600' : 'text-gray-400'} />
                <span className={`text-[9px] font-black uppercase ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                  {isOnline ? 'En ligne maintenant' : `Vu: ${new Date(user.lastSeen || user.updatedAt).toLocaleDateString()}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {user.isBanned   && <span className="px-2 py-0.5 text-[8px] font-black rounded bg-red-600 text-white uppercase">Banni</span>}
            {user.isPremium  && <span className="px-2 py-0.5 text-[8px] font-black rounded bg-orange-500 text-white uppercase">Élite</span>}
            {user.isVerified && <span className="px-2 py-0.5 text-[8px] font-black rounded bg-blue-600 text-white uppercase">Certifié</span>}
            <span className="px-2 py-0.5 text-[8px] font-black rounded bg-slate-100 text-slate-700 uppercase">
              {followersCount.toLocaleString('fr-FR')} abonnés
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4 text-center">
          <div className="bg-blue-50 p-2 rounded-xl border border-blue-100">
            <p className="text-[8px] font-bold text-blue-500 uppercase">Abonnés</p>
            <p className="text-xs font-black text-blue-700">{followersCount.toLocaleString('fr-FR')}</p>
          </div>
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
                <span className="text-gray-400">Type de compte</span>
                <span className="font-bold text-gray-700">{ACCOUNT_TYPE_CONFIG[user.accountType || 'personal']?.label}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span className="text-gray-400">Statut connexion</span>
                <span className={`font-bold ${isOnline ? 'text-green-600' : 'text-gray-700'}`}>
                  {isOnline ? 'En ligne maintenant' : 'Hors ligne'}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span className="text-gray-400">Inscrit</span>
                <span className="font-bold text-gray-700">{dateInscription}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span className="text-gray-400">Abonnés</span>
                <span className="font-bold text-gray-700">{followersCount.toLocaleString('fr-FR')}</span>
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
                {user.isVerified ? 'Retirer cert.' : 'Certifier'}
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
UserCard.displayName = 'UserCard';

// ==========================================
// 🚀 DASHBOARD PRINCIPAL — VERSION PAGINÉE
// ✅ FIX : pagination côté serveur pour supporter des milliers d'utilisateurs
// ✅ FIX : stats via /admin/stats (aggregations MongoDB, pas de chargement complet)
// ✅ FIX : recherche côté serveur avec debounce
// ✅ NOUVEAU : statut connecté réel via /admin/online-users, polling 15s
// ✅ NOUVEAU : filtres type de compte (perso/pro/entreprise) + en ligne uniquement
// ==========================================
export default function AdminDashboard() {
  const { user, token } = useAuth();
  const navigate         = useNavigate();
  const { request }      = useSecureRequest(token);
  
  const [users,           setUsers]           = useState([]);
  const [reportedUsers,   setReportedUsers]   = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [toasts,          setToasts]          = useState([]);
  const [confirmModal,    setConfirmModal]    = useState({ show: false });
  const [notificationModal, setNotificationModal] = useState({ show: false, targetUser: null });
  const [reportsModal,    setReportsModal]    = useState({ show: false, user: null });
  const [activeTab,       setActiveTab]       = useState('all');

  // ✅ NOUVEAU — filtres locaux (s'appliquent sur la page chargée)
  const [typeFilter,      setTypeFilter]      = useState('all'); // all | personal | pro | business
  const [onlineOnly,      setOnlineOnly]      = useState(false);

  // ✅ NOUVEAU — utilisateurs réellement connectés (Set d'IDs, source: Socket.IO)
  const [onlineUserIds,   setOnlineUserIds]   = useState(new Set());

  // ✅ Pagination côté serveur
  const [currentPage,     setCurrentPage]     = useState(1);
  const [totalPages,      setTotalPages]      = useState(1);
  const [totalUsers,      setTotalUsers]      = useState(0);
  const [serverStats,     setServerStats]     = useState({ total: 0, premium: 0, verified: 0, banned: 0, reported: 0, followers: 0 });
  const PAGE_SIZE = 50;
  const searchTimeoutRef = React.useRef(null);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // ✅ Stats depuis le serveur (aggregations MongoDB, pas de calcul côté client)
  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const data = await request('/admin/stats');
      if (data.success && data.stats) setServerStats(data.stats);
    } catch (err) {
      console.warn('Stats admin indisponibles:', err.message);
    }
  }, [request, token]);

  // ✅ NOUVEAU — utilisateurs réellement connectés (tracker Socket.IO côté serveur)
  const loadOnlineUsers = useCallback(async () => {
    if (!token) return;
    try {
      const data = await request('/admin/online-users');
      if (data.success && Array.isArray(data.onlineUserIds)) {
        setOnlineUserIds(new Set(data.onlineUserIds.map(String)));
      }
    } catch (err) {
      // Endpoint pas encore branché côté serveur — on garde l'ancien état, pas bloquant
      console.warn('Statut en ligne indisponible:', err.message);
    }
  }, [request, token]);

  // ✅ Utilisateurs paginés depuis le serveur
  const loadUsers = useCallback(async (page = 1, search = '') => {
    if (!token) { addToast("Non connecté - Reconnectez-vous", "error"); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      const data = await request(`/admin/users?${params}`);
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        setTotalPages(data.totalPages || 1);
        setTotalUsers(data.total || 0);
        setCurrentPage(data.page || 1);
        // Reported users: on garde uniquement ceux de la page courante (filtrage rapide)
        const reported = data.users
          .filter(u => u.moderation?.reportCount > 0 || u.moderation?.strikes > 0)
          .sort((a, b) => (b.moderation?.reportCount || 0) - (a.moderation?.reportCount || 0));
        setReportedUsers(reported);
      } else throw new Error("Format invalide");
    } catch (err) { 
      addToast(err.message || 'Erreur serveur', 'error'); 
    } finally { 
      setLoading(false); 
    }
  }, [request, token]);

  useEffect(() => {
    if (token && ['admin', 'superadmin', 'moderator'].includes(user?.role)) {
      loadUsers(1, '');
      loadStats();
      loadOnlineUsers();
    }
  }, [token, user, loadUsers, loadStats, loadOnlineUsers]);

  // ✅ NOUVEAU — polling du statut en ligne toutes les 15s
  useEffect(() => {
    if (!(token && ['admin', 'superadmin', 'moderator'].includes(user?.role))) return;
    const interval = setInterval(loadOnlineUsers, ONLINE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [token, user, loadOnlineUsers]);

  const stats = useMemo(() => ({
    total:    serverStats.total,
    premium:  serverStats.premium,
    verified: serverStats.verified,
    banned:   serverStats.banned,
    reported: serverStats.reported,
    followers: serverStats.followers,
  }), [serverStats]);

  // ✅ NOUVEAU — utilisateurs affichés après filtres type/en-ligne (sur la page chargée)
  const displayedUsers = useMemo(() => {
    let list = users;
    if (typeFilter !== 'all') {
      list = list.filter(u => (u.accountType || 'personal') === typeFilter);
    }
    if (onlineOnly) {
      list = list.filter(u => onlineUserIds.has(String(u._id)));
    }
    return list;
  }, [users, typeFilter, onlineOnly, onlineUserIds]);

  const handleUserAction = useCallback(async (action, targetUser) => {
    if (action === 'notify') { setNotificationModal({ show: true, targetUser }); return; }
    
    const configs = {
      ban:     { title: targetUser.isBanned ? 'Gracier' : 'Bannir',  endpoint: `/admin/users/${targetUser._id}/ban`,     method: 'PATCH', isDanger: !targetUser.isBanned },
      premium: { title: 'Statut Élite',                               endpoint: `/admin/users/${targetUser._id}/premium`, method: 'PATCH' },
      verify:  { title: 'Certification',                              endpoint: `/admin/users/${targetUser._id}`,         method: 'PATCH', body: { isVerified: !targetUser.isVerified } },
      delete:  { title: 'SUPPRESSION',                                endpoint: `/admin/users/${targetUser._id}`,         method: 'DELETE', isDanger: true },
    };

    const config = configs[action];
    setConfirmModal({
      show: true, ...config,
      onConfirm: async () => {
        try {
          await request(config.endpoint, { method: config.method, body: config.body ? JSON.stringify(config.body) : undefined });
          addToast('Action effectuée', 'success');
          loadUsers(currentPage, searchQuery);
          loadStats();
        } catch (err) { addToast(err.message || 'Erreur', 'error'); }
        setConfirmModal({ show: false });
      }
    });
  }, [request, loadUsers, loadStats, currentPage, searchQuery]);

  // ✅ Recherche côté serveur avec debounce 300ms
  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setSearchQuery(val);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
      loadUsers(1, val);
    }, 300);
  }, [loadUsers]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    loadUsers(newPage, searchQuery);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [totalPages, loadUsers, searchQuery]);

  if (!user || !token) {
    return <div className="p-20 text-center"><p className="text-gray-600">⏳ Chargement...</p></div>;
  }
  if (!['admin', 'superadmin', 'moderator'].includes(user.role)) {
    return <div className="p-20 text-center"><p className="text-red-600 font-bold text-xl">⛔ Accès refusé</p></div>;
  }

  const TYPE_FILTER_OPTIONS = [
    { key: 'all',      label: 'Tous types' },
    { key: 'personal', label: 'Utilisateurs' },
    { key: 'pro',      label: 'Professionnels' },
    { key: 'business', label: 'Entreprises' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* TOASTS */}
      <div className="fixed top-4 left-4 right-4 z-[300] space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`p-4 rounded-2xl text-white font-black text-center shadow-2xl ${t.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* HEADER */}
      <div className="bg-white/95 backdrop-blur-xl p-4 sticky top-0 z-40 border-b shadow-sm">
        <div className="flex justify-between items-center mb-4 max-w-[1600px] mx-auto">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-blue-600">ADMIN DASHBOARD</h1>
            <p className="text-xs text-gray-400 font-semibold">Utilisateurs, contenu, signalements et traçabilité en temps réel</p>
          </div>
          <button onClick={() => { loadUsers(currentPage, searchQuery); loadStats(); loadOnlineUsers(); }} className="p-2 bg-gray-100 rounded-full active:rotate-180 transition-all">
            <RotateCw size={18}/>
          </button>
        </div>
        <div className="flex gap-2 max-w-[1600px] mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" value={searchQuery} 
              onChange={handleSearchChange}
              placeholder="Rechercher..." 
              className="w-full pl-9 pr-4 py-3 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 ring-blue-500"
            />
          </div>
          <button onClick={() => setNotificationModal({ show: true, targetUser: null })} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90">
            <Mail size={22}/>
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 p-4 max-w-[1600px] mx-auto">
        <div className="bg-blue-600   p-4 rounded-[28px] text-white shadow-lg"><p className="text-[10px] font-black opacity-70 uppercase">Membres</p><p className="text-3xl font-black">{stats.total}</p></div>
        <div className="bg-emerald-600 p-4 rounded-[28px] text-white shadow-lg">
          <p className="text-[10px] font-black opacity-70 uppercase flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Connectés
          </p>
          <p className="text-3xl font-black">{onlineUserIds.size}</p>
        </div>
        <div className="bg-indigo-600 p-4 rounded-[28px] text-white shadow-lg"><p className="text-[10px] font-black opacity-70 uppercase">Abonnés</p><p className="text-3xl font-black">{stats.followers.toLocaleString('fr-FR')}</p></div>
        <div className="bg-orange-500 p-4 rounded-[28px] text-white shadow-lg"><p className="text-[10px] font-black opacity-70 uppercase">Élite</p><p className="text-3xl font-black">{stats.premium}</p></div>
        <div className="bg-green-600  p-4 rounded-[28px] text-white shadow-lg"><p className="text-[10px] font-black opacity-70 uppercase">Vérifiés</p><p className="text-3xl font-black">{stats.verified}</p></div>
        <div className="bg-red-600    p-4 rounded-[28px] text-white shadow-lg"><p className="text-[10px] font-black opacity-70 uppercase">Signalés</p><p className="text-3xl font-black">{stats.reported}</p></div>
      </div>

      {/* TABS */}
      <div className="max-w-[1600px] mx-auto px-4 mb-4">
        <div className="bg-white rounded-2xl p-2 flex gap-2 shadow-sm border">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Users size={16} className="inline mr-2" /> Tous ({totalUsers})
          </button>
          <button
            onClick={() => setActiveTab('reported')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'reported' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Flag size={16} className="inline mr-2" /> Signalés ({reportedUsers.length})
          </button>
        </div>

        {/* ✅ NOUVEAU — filtres type de compte + en ligne uniquement (onglet "Tous") */}
        {activeTab === 'all' && (
          <div className="flex flex-wrap gap-2 mt-3">
            {TYPE_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setTypeFilter(opt.key)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                  typeFilter === opt.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => setOnlineOnly(v => !v)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors flex items-center gap-1.5 ${
                onlineOnly
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${onlineOnly ? 'bg-white' : 'bg-emerald-500'} ${onlineOnly ? 'animate-pulse' : ''}`} />
              En ligne uniquement
            </button>
          </div>
        )}
      </div>

      {/* LISTE */}
      <div className="max-w-[1600px] mx-auto px-4 mt-2">
        <div className="bg-white rounded-[32px] shadow-sm border overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-500 uppercase">
              {activeTab === 'all'
                ? `Registre (${displayedUsers.length}/${totalUsers}${typeFilter !== 'all' || onlineOnly ? ' — filtré sur cette page' : ''})`
                : `Signalements (${reportedUsers.length})`}
            </span>
            <Activity size={14} className="text-gray-400" />
          </div>
          
          {loading ? (
            <div className="p-20 text-center"><RotateCw className="animate-spin mx-auto text-blue-500" /></div>
          ) : activeTab === 'all' ? (
            displayedUsers.length === 0
              ? <div className="p-20 text-center text-gray-400 font-bold">Aucun résultat</div>
              : (
                <>
                  <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
                    {displayedUsers.map(u => (
                      <UserCard key={u._id} user={u} onAction={handleUserAction} navigate={navigate} onlineUserIds={onlineUserIds} />
                    ))}
                  </div>
                  {/* PAGINATION */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 p-6 border-t border-gray-100">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                      >
                        ← Précédent
                      </button>
                      <span className="text-sm font-bold text-gray-500 px-3">
                        Page {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                      >
                        Suivant →
                      </button>
                    </div>
                  )}
                </>
              )
          ) : (
            reportedUsers.length === 0
              ? <div className="p-20 text-center text-gray-400 font-bold"><Flag size={48} className="mx-auto mb-4 opacity-50" />Aucun utilisateur signalé</div>
              : (
                <div className="grid grid-cols-1 xl:grid-cols-2">
                  {reportedUsers.map(u => (
                    <ReportedUserCard 
                      key={u._id} user={u} 
                      onAction={handleUserAction}
                      onViewReports={(user) => setReportsModal({ show: true, user })}
                      navigate={navigate}
                      onlineUserIds={onlineUserIds}
                    />
                  ))}
                </div>
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
              <button onClick={confirmModal.onConfirm} className={`flex-1 py-4 rounded-2xl font-black text-white ${confirmModal.isDanger ? 'bg-red-600' : 'bg-blue-600'} uppercase text-xs`}>
                Confirmer
              </button>
              <button onClick={() => setConfirmModal({ show: false })} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase text-xs">
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
            <input id="n-title" type="text" placeholder="Titre" className="w-full p-4 bg-gray-100 rounded-2xl mb-3 outline-none focus:ring-2 ring-blue-500" />
            <textarea id="n-msg" placeholder="Message..." rows={5} className="w-full p-4 bg-gray-100 rounded-2xl mb-8 outline-none resize-none focus:ring-2 ring-blue-500" />
            <div className="flex gap-3">
              <button onClick={async () => {
                const t = document.getElementById('n-title').value;
                const m = document.getElementById('n-msg').value;
                if (!t || !m) { addToast('Champs vides', 'error'); return; }
                try {
                  await request('/admin/notifications', { method: 'POST', body: JSON.stringify({ title: t, message: m, userId: notificationModal.targetUser?._id }) });
                  addToast('Envoyé', 'success');
                  setNotificationModal({ show: false });
                } catch { addToast('Erreur', 'error'); }
              }} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs">
                Envoyer
              </button>
              <button onClick={() => setNotificationModal({ show: false })} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase text-xs">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REPORTS */}
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