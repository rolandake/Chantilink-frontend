// src/pages/Profile/Monetisation/StatsSection.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useDarkMode } from '../../../context/DarkModeContext';

const StatCard = ({ label, value, icon, color, delay, isDarkMode }) => {
  const bdr = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  return (
    <motion.div
      initial={{ opacity:0, y:16 }}
      animate={{ opacity:1, y:0 }}
      transition={{ delay, duration:0.35 }}
      style={{
        padding:'20px 18px',
        borderRadius:16,
        border:`1px solid ${bdr}`,
        background: isDarkMode ? 'rgba(14,14,14,0.98)' : '#fff',
        boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.06)',
        display:'flex', flexDirection:'column', gap:12,
        fontFamily:"'Sora','DM Sans',sans-serif",
      }}
    >
      <div style={{
        width:40, height:40, borderRadius:11,
        background:`linear-gradient(135deg,${color}22,${color}11)`,
        border:`1px solid ${color}33`,
        display:'flex', alignItems:'center', justifyContent:'center',
        color,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize:22, fontWeight:800, color: isDarkMode?'#f3f4f6':'#111827', letterSpacing:'-0.5px' }}>
          {value}
        </div>
        <div style={{ fontSize:12, color: isDarkMode?'#6b7280':'#9ca3af', marginTop:2 }}>
          {label}
        </div>
      </div>
    </motion.div>
  );
};

export default function StatsSection() {
  const { user }      = useAuth();
  const { isDarkMode } = useDarkMode();

  const [stats, setStats]     = useState({ totalRevenue:0, monthlyRevenue:0, salesCount:0, activeSubscribers:0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true); setError('');
      try {
        const res  = await fetch('/api/monetisation/stats', { headers:{ Authorization:`Bearer ${user.token}` } });
        if (!res.ok) throw new Error('Erreur chargement statistiques');
        setStats(await res.json());
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [user]);

  const font = "'Sora','DM Sans',sans-serif";

  if (loading) return (
    <div style={{ padding:'32px 0', textAlign:'center', fontFamily:font, color: isDarkMode?'#6b7280':'#9ca3af', fontSize:13 }}>
      Chargement des statistiques...
    </div>
  );
  if (error) return (
    <div style={{ padding:'20px', borderRadius:12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444', fontSize:13, fontFamily:font }}>
      {error}
    </div>
  );

  const CARDS = [
    {
      label: 'Revenus totaux',
      value: `${stats.totalRevenue.toLocaleString()} FCFA`,
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
      color: '#f97316',
    },
    {
      label: 'Revenus ce mois',
      value: `${stats.monthlyRevenue.toLocaleString()} FCFA`,
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
      color: '#ec4899',
    },
    {
      label: 'Ventes réalisées',
      value: stats.salesCount.toLocaleString(),
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 01-8 0"/></svg>,
      color: '#22c55e',
    },
    {
      label: 'Abonnés premium',
      value: stats.activeSubscribers.toLocaleString(),
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
      color: '#3b82f6',
    },
  ];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
      {CARDS.map((c, i) => <StatCard key={i} {...c} delay={i*0.07} isDarkMode={isDarkMode} />)}
    </div>
  );
}