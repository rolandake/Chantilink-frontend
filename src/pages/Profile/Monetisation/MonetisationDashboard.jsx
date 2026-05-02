// src/pages/Profile/Monetisation/MonetisationDashboard.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import StatsSection from "./StatsSection";
import OffersSection from "./OffersSection";
import TransactionsSection from "./TransactionsSection";
import WithdrawalsSection from "./WithdrawalsSection";
import NotificationsSection from "./NotificationsSection";
import RevenueStats from "./RevenueStats";
import MyClients from "./MyClients";
import { useDarkMode } from '../../../context/DarkModeContext';

export default function MonetisationDashboard() {
  const { isDarkMode } = useDarkMode();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true); setError(null);
      try {
        const res  = await fetch("/api/monetisation/dashboard");
        if (!res.ok) throw new Error("Erreur API " + res.status);
        setData(await res.json());
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    }
    fetchDashboardData();
  }, []);

  const bdr  = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const font = "'Sora','DM Sans',sans-serif";

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300, fontFamily:font }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:44,height:44,border:'4px solid rgba(249,115,22,0.2)',borderTopColor:'#f97316',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto' }} />
        <p style={{ marginTop:14, color: isDarkMode?'#6b7280':'#9ca3af', fontSize:14 }}>Chargement du tableau de bord...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ textAlign:'center', padding:'48px 24px', fontFamily:font }}>
      <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
      <p style={{ fontSize:15, fontWeight:600, color:'#ef4444', marginBottom:8 }}>Erreur de chargement</p>
      <p style={{ fontSize:13, color: isDarkMode?'#6b7280':'#9ca3af' }}>{error}</p>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, fontFamily:font }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, paddingBottom:4 }}>
        <div style={{
          width:42, height:42, borderRadius:12,
          background:'linear-gradient(135deg,#f97316,#ec4899)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 6px 20px rgba(249,115,22,0.35)',
        }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l2.09 6.26L20 9.27l-5 4.87 1.18 6.88L12 17.77l-4.18 3.25L9 14.14 4 9.27l5.91-1.01L12 2z"/>
          </svg>
        </div>
        <div>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800, color: isDarkMode?'#f3f4f6':'#111827' }}>
            Tableau de bord
          </h2>
          <p style={{ margin:0, fontSize:12, color: isDarkMode?'#6b7280':'#9ca3af' }}>
            Vue d'ensemble de votre activité
          </p>
        </div>
      </div>

      {/* Sections */}
      {[
        <StatsSection key="stats" />,
        <OffersSection key="offers" />,
        <TransactionsSection key="tx" />,
        <WithdrawalsSection key="wd" />,
        <NotificationsSection key="notif" />,
      ].map((section, i) => (
        <motion.div
          key={i}
          initial={{ opacity:0, y:12 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay: i * 0.06, duration:0.3 }}
        >
          {section}
        </motion.div>
      ))}
    </div>
  );
}