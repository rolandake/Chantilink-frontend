// src/pages/Profile/Monetisation/StatsSection.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useDarkMode } from '../../../context/DarkModeContext';
import { getAuthToken, monetisationFetch, readMonetisationJson } from './monetisationApi';
import useMonetisationRealtime from './useMonetisationRealtime';

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
  const { user, getToken } = useAuth();
  const { isDarkMode } = useDarkMode();

  const [stats, setStats]     = useState({ totalRevenue:0, monthlyRevenue:0, salesCount:0, activeSubscribers:0, availableBalance:0, revenueBreakdown:{} });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchStats = useCallback(async ({ background = false } = {}) => {
    if (!user) return;
    if (!background) {
      setLoading(true);
      setError('');
    }
    try {
      const token = await getAuthToken(getToken);
      const res  = await monetisationFetch('stats', { token });
      if (!res.ok) throw new Error('Erreur chargement statistiques');
      setStats(await readMonetisationJson(res));
    } catch (e) {
      if (!background) setError(e.message);
    }
    finally {
      if (!background) setLoading(false);
    }
  }, [getToken, user]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useMonetisationRealtime(fetchStats, 'stats');

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
      label: 'Solde disponible',
      value: `${Number(stats.availableBalance || 0).toLocaleString()} FCFA`,
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 3v4M8 3v4M7 14h.01M11 14h.01"/></svg>,
      color: '#14b8a6',
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
    {
      label: 'Fonds créateur',
      value: `${Number(stats.revenueBreakdown?.creatorFund || 0).toLocaleString()} FCFA`,
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 4-8 4-8-4 8-4z"/><path d="M4 11l8 4 8-4"/><path d="M4 15l8 4 8-4"/></svg>,
      color: '#8b5cf6',
    },
    {
      label: 'Partage publicitaire',
      value: `${Number(stats.revenueBreakdown?.adShare || 0).toLocaleString()} FCFA`,
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg>,
      color: '#0ea5e9',
    },
    {
      label: 'Pourboires',
      value: `${Number(stats.revenueBreakdown?.tips || 0).toLocaleString()} FCFA`,
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-4.35-9.2-8.31C.73 8.96 2.88 5 7 5c2.09 0 3.3 1.02 5 3 1.7-1.98 2.91-3 5-3 4.12 0 6.27 3.96 4.2 7.69C19 16.65 12 21 12 21z"/></svg>,
      color: '#ef4444',
    },
  ];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
      {CARDS.map((c, i) => <StatCard key={i} {...c} delay={i*0.07} isDarkMode={isDarkMode} />)}
    </div>
  );
}
