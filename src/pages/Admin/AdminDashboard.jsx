import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { 
  Users, Crown, CheckCircle, Ban, Search, RotateCw, 
  Mail, Settings, Trash2, Lock, AlertCircle, Shield,
  Clock, Eye, FileText, Smartphone, MapPin, Activity
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ==========================================
// 🔧 LOGIQUE DE SÉCURITÉ & RÉSEAU
// ==========================================

const useAuthToken = () => {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const getStoredToken = () => {
      try {
        const activeUserId = JSON.parse(localStorage.getItem('chantilink_active_user_v6'));
        const users = JSON.parse(localStorage.getItem('chantilink_users_enc_v6'));
        return users[activeUserId]?.token || null;
      } catch (err) { return null; }
    };
    setToken(getStoredToken());
    setLoading(false);
  }, []);
  return { token, loading };
};

const useSecureRequest = (token) => {
  const request = useCallback(async (endpoint, options = {}) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json', 
        ...options.headers 
      },
    });
    if (!res.ok) throw new Error('Erreur serveur');
    return await res.json();
  }, [token]);
  return { request };
};

// ==========================================
// 👤 COMPOSANT : CARTE UTILISATEUR "AUDIT"
// ==========================================

const UserCard = memo(({ user, onAction }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isOnline = user.isOnline; // Géré par ton backend/socket
  const dateInscription = new Date(user.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  return (
    <div className={`transition-all border-b border-gray-100 ${isExpanded ? 'bg-blue-50/40' : 'bg-white'}`}>
      <div className="p-4">
        {/* LIGNE 1 : INFOS DE BASE */}
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
                  {isOnline ? 'En ligne' : `Dernière vue: ${new Date(user.lastSeen || user.updatedAt).toLocaleDateString()}`}
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

        {/* LIGNE 2 : STATS D'ACTIVITÉ */}
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
            <p className="text-[8px] font-bold text-gray-400 uppercase">Posts</p>
            <p className="text-xs font-black text-gray-700">{user.postsCount || 0}</p>
          </div>
          <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
            <p className="text-[8px] font-bold text-gray-400 uppercase">Amis</p>
            <p className="text-xs font-black text-gray-700">{user.friends?.length || 0}</p>
          </div>
          <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
            <p className="text-[8px] font-bold text-gray-400 uppercase">Signalé</p>
            <p className="text-xs font-black text-red-500">{user.reportsCount || 0}</p>
          </div>
        </div>

        {/* LIGNE 3 : BOUTONS D'ACTION */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <button onClick={() => onAction('notify', user)} className="flex flex-col items-center p-2 bg-blue-50 text-blue-600 rounded-xl active:scale-95"><Mail size={18}/><span className="text-[8px] font-bold mt-1">Message</span></button>
          <button onClick={() => onAction('ban', user)} className={`flex flex-col items-center p-2 rounded-xl active:scale-95 ${user.isBanned ? 'bg-green-600 text-white' : 'bg-red-50 text-red-600'}`}><Ban size={18}/><span className="text-[8px] font-bold mt-1">{user.isBanned ? 'Libérer' : 'Bannir'}</span></button>
          <button onClick={() => setIsExpanded(!isExpanded)} className={`flex flex-col items-center p-2 rounded-xl active:scale-95 ${isExpanded ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600'}`}><Eye size={18}/><span className="text-[8px] font-black mt-1 uppercase">Audit</span></button>
          <button onClick={() => onAction('premium', user)} className="flex flex-col items-center p-2 bg-gray-100 text-gray-600 rounded-xl active:scale-95"><Crown size={18}/><span className="text-[8px] font-bold mt-1">Élite</span></button>
        </div>

        {/* SECTION AUDIT DÉTAILLÉE */}
        {isExpanded && (
          <div className="mt-4 p-4 bg-white rounded-2xl border-2 border-orange-200 animate-in slide-in-from-top-4">
            <h4 className="text-[10px] font-black text-orange-600 uppercase mb-3 flex items-center gap-2"><Activity size={12}/> Dossier Utilisateur</h4>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span className="text-gray-400">Inscrit le</span>
                <span className="font-bold text-gray-700">{dateInscription}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span className="text-gray-400">Localisation</span>
                <span className="font-bold text-gray-700">{user.location || 'Non renseignée'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span className="text-gray-400">Téléphone</span>
                <span className="font-bold text-gray-700">{user.phone || 'Non lié'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Dernier Post</span>
                <span className="font-bold text-gray-700">{user.lastPostDate ? new Date(user.lastPostDate).toLocaleDateString() : 'Aucun'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={() => onAction('verify', user)} className="py-2 bg-blue-600 text-white text-[9px] font-black rounded-lg uppercase tracking-tighter shadow-md">{user.isVerified ? 'Enlever Badge' : 'Certifier'}</button>
              <button onClick={() => onAction('delete', user)} className="py-2 bg-red-100 text-red-600 text-[9px] font-black rounded-lg uppercase tracking-tighter">Supprimer Compte</button>
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
  const { token, loading: tokenLoading } = useAuthToken();
  const { request } = useSecureRequest(token);
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ show: false });
  const [notificationModal, setNotificationModal] = useState({ show: false, targetUser: null });

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await request('/admin/users');
      setUsers(data.users || []);
    } catch (err) { addToast('Erreur serveur', 'error'); }
    finally { setLoading(false); }
  }, [request, token]);

  useEffect(() => { if (token) loadUsers(); }, [token, loadUsers]);

  const stats = useMemo(() => ({
    total: users.length,
    premium: users.filter(u => u.isPremium).length,
    verified: users.filter(u => u.isVerified).length,
    banned: users.filter(u => u.isBanned).length,
  }), [users]);

  const handleUserAction = useCallback(async (action, user) => {
    if (action === 'notify') { setNotificationModal({ show: true, targetUser: user }); return; }
    
    const configs = {
      ban: { title: user.isBanned ? 'Gracier' : 'Bannir', endpoint: `/admin/users/${user._id}/ban`, method: 'PATCH', isDanger: !user.isBanned },
      premium: { title: 'Statut Élite', endpoint: `/admin/users/${user._id}/premium`, method: 'PATCH' },
      verify: { title: 'Certification', endpoint: `/admin/users/${user._id}`, method: 'PATCH', body: { isVerified: !user.isVerified } },
      delete: { title: 'SUPPRESSION DÉFINITIVE', endpoint: `/admin/users/${user._id}`, method: 'DELETE', isDanger: true }
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
        } catch (err) { addToast('Erreur', 'error'); }
        setConfirmModal({ show: false });
      }
    });
  }, [request, loadUsers]);

  const filteredUsers = useMemo(() => 
    users.filter(u => (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  , [users, searchQuery]);

  if (tokenLoading) return <div className="p-20 text-center"><RotateCw className="animate-spin mx-auto text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* TOASTS */}
      <div className="fixed top-4 left-4 right-4 z-[300] space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`p-4 rounded-2xl text-white font-black text-center shadow-2xl animate-in slide-in-from-top-10 ${t.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* HEADER FIXE */}
      <div className="bg-white p-4 sticky top-0 z-40 border-b shadow-sm">
        <div className="flex justify-between items-center mb-4 max-w-4xl mx-auto">
          <h1 className="text-xl font-black text-blue-600 tracking-tighter">ADMIN CORE</h1>
          <button onClick={loadUsers} className="p-2 bg-gray-100 rounded-full active:rotate-180 transition-all"><RotateCw size={18}/></button>
        </div>
        <div className="flex gap-2 max-w-4xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Chercher par nom ou email..." className="w-full pl-9 pr-4 py-3 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 ring-blue-500"
            />
          </div>
          <button onClick={() => setNotificationModal({ show: true, targetUser: null })} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90"><Mail size={22}/></button>
        </div>
      </div>

      {/* GRILLE DE STATS */}
      <div className="grid grid-cols-2 gap-3 p-4 max-w-4xl mx-auto">
        <div className="bg-blue-600 p-4 rounded-[28px] text-white shadow-lg shadow-blue-100">
          <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">Membres</p>
          <p className="text-3xl font-black">{stats.total}</p>
        </div>
        <div className="bg-orange-500 p-4 rounded-[28px] text-white shadow-lg shadow-orange-100">
          <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">Élite</p>
          <p className="text-3xl font-black">{stats.premium}</p>
        </div>
        <div className="bg-green-600 p-4 rounded-[28px] text-white shadow-lg shadow-green-100">
          <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">Vérifiés</p>
          <p className="text-3xl font-black">{stats.verified}</p>
        </div>
        <div className="bg-red-600 p-4 rounded-[28px] text-white shadow-lg shadow-red-100">
          <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">Bannis</p>
          <p className="text-3xl font-black">{stats.banned}</p>
        </div>
      </div>

      {/* LISTE UTILISATEURS */}
      <div className="max-w-4xl mx-auto px-4 mt-2">
        <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Registre ({filteredUsers.length})</span>
              <Activity size={14} className="text-gray-400" />
          </div>
          {loading ? (
            <div className="p-20 text-center"><RotateCw className="animate-spin mx-auto text-blue-500" /></div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-20 text-center text-gray-400 font-bold">Aucun résultat</div>
          ) : (
            filteredUsers.map(user => <UserCard key={user._id} user={user} onAction={handleUserAction} />)
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMATION */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[400] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className={confirmModal.isDanger ? 'text-red-600' : 'text-blue-600'} />
            </div>
            <h2 className={`text-xl font-black text-center mb-2 ${confirmModal.isDanger ? 'text-red-600' : 'text-gray-900'}`}>{confirmModal.title}</h2>
            <p className="text-gray-500 text-sm text-center mb-8">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={confirmModal.onConfirm} className={`flex-1 py-4 rounded-2xl font-black text-white ${confirmModal.isDanger ? 'bg-red-600 shadow-red-200' : 'bg-blue-600 shadow-blue-200'} shadow-lg active:scale-95 transition-all uppercase text-xs`}>Confirmer</button>
              <button onClick={() => setConfirmModal({ show: false })} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black active:scale-95 transition-all uppercase text-xs">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOTIFICATION */}
      {notificationModal.show && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[400] flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[50px] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-gray-200 mx-auto mb-8 rounded-full" />
            <h2 className="text-2xl font-black mb-6 uppercase tracking-tighter">Diffusion Annonce</h2>
            <p className="text-gray-400 text-[10px] font-bold uppercase mb-4 tracking-widest">
              {notificationModal.targetUser ? `À: ${notificationModal.targetUser.fullName}` : 'Destinataire: Tous les membres'}
            </p>
            <input id="n-title" type="text" placeholder="Titre de la notification" className="w-full p-4 bg-gray-100 rounded-2xl mb-3 outline-none focus:ring-2 ring-blue-500 font-bold" />
            <textarea id="n-msg" placeholder="Votre message détaillé..." rows={5} className="w-full p-4 bg-gray-100 rounded-2xl mb-8 outline-none resize-none focus:ring-2 ring-blue-500" />
            <div className="flex gap-3">
              <button onClick={() => {
                const t = document.getElementById('n-title').value;
                const m = document.getElementById('n-msg').value;
                if(t && m) {
                  const send = async () => {
                    try {
                      await request('/admin/notifications', { method: 'POST', body: JSON.stringify({ title: t, message: m, userId: notificationModal.targetUser?._id }) });
                      addToast('Diffusé avec succès !', 'success');
                      setNotificationModal({ show: false });
                    } catch (e) { addToast('Échec de l\'envoi', 'error'); }
                  };
                  send();
                } else { addToast('Champs vides !', 'error'); }
              }} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-200 uppercase text-xs tracking-widest">Envoyer</button>
              <button onClick={() => setNotificationModal({ show: false })} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase text-xs tracking-widest">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}