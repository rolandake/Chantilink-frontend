// src/pages/Profile/Monetisation/MyClients.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useDarkMode } from '../../../context/DarkModeContext';

export default function MyClients() {
  const { user }       = useAuth();
  const { isDarkMode } = useDarkMode();
  const [clients, setClients]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  const font = "'Sora','DM Sans',sans-serif";
  const bdr  = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const card = isDarkMode ? 'rgba(14,14,14,0.98)' : '#fff';
  const text = isDarkMode ? '#f3f4f6' : '#111827';
  const sub  = isDarkMode ? '#6b7280' : '#9ca3af';

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const res  = await fetch('/api/monetisation/clients', { headers:{ Authorization:`Bearer ${user.token}` } });
        if (!res.ok) return;
        const data = await res.json();
        setClients(data.clients || []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [user]);

  // Données de démonstration si vide
  const DEMO = [
    { _id:'1', username:'kouassi_dev',   fullName:'Kouassi Emmanuel',  avatar:null, totalSpent:45000, purchasesCount:3, lastPurchase: new Date(Date.now()-86400000).toISOString() },
    { _id:'2', username:'amara_design',  fullName:'Amara Diallo',      avatar:null, totalSpent:30000, purchasesCount:2, lastPurchase: new Date(Date.now()-172800000).toISOString() },
    { _id:'3', username:'fatou_creative',fullName:'Fatou Coulibaly',   avatar:null, totalSpent:15000, purchasesCount:1, lastPurchase: new Date(Date.now()-604800000).toISOString() },
  ];
  const items = clients.length > 0 ? clients : (loading ? [] : DEMO);
  const filtered = items.filter(c =>
    c.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    c.username?.toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name='') => name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const COLORS = ['#f97316','#ec4899','#3b82f6','#22c55e','#8b5cf6','#eab308'];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, fontFamily:font }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,rgba(236,72,153,0.15),rgba(249,115,22,0.1))',display:'flex',alignItems:'center',justifyContent:'center',color:'#ec4899' }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="3.5"/><path d="M2 21c0-4 3.1-7 7-7"/><circle cx="17" cy="9" r="2.5"/><path d="M14 21c0-3 1.8-5 4.5-5s4.5 2 4.5 5"/>
            </svg>
          </div>
          <span style={{ fontWeight:700, fontSize:15, color:text }}>Mes clients</span>
          {!loading && (
            <span style={{ padding:'2px 9px',borderRadius:999,fontSize:11,fontWeight:700,background:'rgba(236,72,153,0.15)',color:'#ec4899' }}>
              {filtered.length}
            </span>
          )}
        </div>

        {/* Recherche */}
        <div style={{ position:'relative', flex:'0 1 220px' }}>
          <svg style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none' }} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            style={{
              width:'100%', padding:'9px 12px 9px 30px', borderRadius:12,
              border:`1px solid ${bdr}`,
              background: isDarkMode?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)',
              color:text, fontFamily:font, fontSize:13, outline:'none', boxSizing:'border-box',
            }}
            placeholder="Rechercher un client..."
            value={search} onChange={e=>setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding:'28px 0', textAlign:'center', color:sub, fontSize:13 }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:'36px 24px', textAlign:'center', borderRadius:16, border:`1px dashed ${bdr}` }}>
          <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
          <p style={{ fontSize:14, fontWeight:600, color: isDarkMode?'#d1d5db':'#374151', margin:'0 0 6px' }}>
            {search ? 'Aucun résultat' : 'Aucun client encore'}
          </p>
          <p style={{ fontSize:12, color:sub, margin:0 }}>Les utilisateurs ayant acheté vos services apparaîtront ici</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(({ _id, username, fullName, avatar, totalSpent, purchasesCount, lastPurchase }, i) => {
            const color = COLORS[i % COLORS.length];
            return (
              <motion.div
                key={_id}
                initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.06 }}
                style={{
                  padding:'14px 16px', borderRadius:14, border:`1px solid ${bdr}`,
                  background:card, display:'flex', alignItems:'center', gap:14,
                  boxShadow: isDarkMode?'0 2px 12px rgba(0,0,0,0.25)':'0 1px 6px rgba(0,0,0,0.04)',
                }}
              >
                {/* Avatar */}
                {avatar ? (
                  <img src={avatar} alt={fullName} style={{ width:40,height:40,borderRadius:'50%',objectFit:'cover',flexShrink:0 }} />
                ) : (
                  <div style={{ width:40,height:40,borderRadius:'50%',background:`linear-gradient(135deg,${color}33,${color}22)`,border:`1px solid ${color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14,color,flexShrink:0 }}>
                    {getInitials(fullName)}
                  </div>
                )}

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ margin:0,fontWeight:700,fontSize:13,color:text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{fullName}</p>
                  <p style={{ margin:'2px 0 0',fontSize:11,color:sub }}>@{username}</p>
                </div>

                {/* Stats */}
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <p style={{ margin:0,fontSize:13,fontWeight:800,color:'#f97316' }}>{(totalSpent||0).toLocaleString()} FCFA</p>
                  <p style={{ margin:'2px 0 0',fontSize:11,color:sub }}>{purchasesCount||0} achat{(purchasesCount||0)>1?'s':''}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}