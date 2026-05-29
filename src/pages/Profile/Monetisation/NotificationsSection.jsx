// src/pages/Profile/Monetisation/NotificationsSection.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useDarkMode } from '../../../context/DarkModeContext';
import { getAuthToken, monetisationFetch, readMonetisationJson } from './monetisationApi';
import useMonetisationRealtime from './useMonetisationRealtime';

const TYPE_CONFIG = {
  sale:       { icon:'💰', color:'#22c55e', bg:'rgba(34,197,94,0.1)'   },
  withdrawal: { icon:'💵', color:'#3b82f6', bg:'rgba(59,130,246,0.1)'  },
  alert:      { icon:'⚠️', color:'#eab308', bg:'rgba(234,179,8,0.1)'    },
  info:       { icon:'ℹ️', color:'#8b5cf6', bg:'rgba(139,92,246,0.1)'   },
};

export default function NotificationsSection() {
  const { user, getToken } = useAuth();
  const { isDarkMode } = useDarkMode();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const font = "'Sora','DM Sans',sans-serif";
  const bdr  = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const card = isDarkMode ? 'rgba(14,14,14,0.98)' : '#fff';
  const text = isDarkMode ? '#f3f4f6' : '#111827';
  const sub  = isDarkMode ? '#6b7280' : '#9ca3af';

  const fetchNotifications = useCallback(async ({ background = false } = {}) => {
    if (!user) return;
    if (!background) setLoading(true);
    try {
      const token = await getAuthToken(getToken);
      const res  = await monetisationFetch('notifications', { token });
      if (!res.ok) return;
      const data = await readMonetisationJson(res);
      setNotifs(data.notifications || []);
    } catch {}
    finally {
      if (!background) setLoading(false);
    }
  }, [getToken, user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useMonetisationRealtime(fetchNotifications, 'notifications');

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, fontFamily:font }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(99,102,241,0.1))',display:'flex',alignItems:'center',justifyContent:'center',color:'#8b5cf6' }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
          </div>
          <span style={{ fontWeight:700, fontSize:15, color:text }}>Notifications</span>
          {notifs.filter(n=>!n.read).length > 0 && (
            <span style={{ width:20,height:20,borderRadius:'50%',background:'#ef4444',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center' }}>
              {notifs.filter(n=>!n.read).length}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding:'24px 0', textAlign:'center', color:sub, fontSize:13 }}>Chargement...</div>
      ) : notifs.length === 0 ? (
        <div style={{ padding:'36px 24px', textAlign:'center', borderRadius:16, border:`1px dashed ${bdr}` }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔔</div>
          <p style={{ fontSize:14, fontWeight:600, color: isDarkMode?'#d1d5db':'#374151', margin:'0 0 6px' }}>Aucune notification</p>
          <p style={{ fontSize:12, color:sub, margin:0 }}>Vous serez notifié ici de toute nouvelle activité</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {notifs.map(({ _id, type, message, date, read }, i) => {
            const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;
            return (
              <motion.div
                key={_id}
                initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.05 }}
                style={{
                  padding:'13px 16px', borderRadius:12, border:`1px solid ${bdr}`,
                  background: read ? card : (isDarkMode ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.03)'),
                  display:'flex', alignItems:'flex-start', gap:12,
                  borderLeft: read ? `1px solid ${bdr}` : '2px solid #8b5cf6',
                }}
              >
                <div style={{ width:34,height:34,borderRadius:10,background:cfg.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0 }}>
                  {cfg.icon}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ margin:0, fontSize:13, fontWeight: read?400:700, color:text, lineHeight:1.5 }}>{message}</p>
                  <p style={{ margin:'4px 0 0', fontSize:11, color:sub }}>
                    {new Date(date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </p>
                </div>
                {!read && <div style={{ width:8,height:8,borderRadius:'50%',background:'#8b5cf6',flexShrink:0,marginTop:3 }} />}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
