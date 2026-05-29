// src/pages/Profile/Monetisation/TransactionsSection.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useDarkMode } from '../../../context/DarkModeContext';
import { getAuthToken, monetisationFetch, readMonetisationJson } from './monetisationApi';
import useMonetisationRealtime from './useMonetisationRealtime';

const STATUS_CONFIG = {
  completed: { label:'Complété',  color:'#22c55e', bg:'rgba(34,197,94,0.1)'  },
  pending:   { label:'En attente',color:'#eab308', bg:'rgba(234,179,8,0.1)'   },
  failed:    { label:'Échoué',    color:'#ef4444', bg:'rgba(239,68,68,0.1)'   },
};

export default function TransactionsSection() {
  const { user, getToken } = useAuth();
  const { isDarkMode } = useDarkMode();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  const font = "'Sora','DM Sans',sans-serif";
  const bdr  = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const card = isDarkMode ? 'rgba(14,14,14,0.98)' : '#fff';
  const text = isDarkMode ? '#f3f4f6' : '#111827';
  const sub  = isDarkMode ? '#6b7280' : '#9ca3af';

  const fetchTransactions = useCallback(async ({ background = false } = {}) => {
    if (!user) return;
    if (!background) {
      setLoading(true);
      setError('');
    }
    try {
      const token = await getAuthToken(getToken);
      const res  = await monetisationFetch('transactions', { token });
      if (!res.ok) throw new Error('Erreur chargement transactions');
      const data = await readMonetisationJson(res);
      setTransactions(data.transactions || []);
    } catch (e) {
      if (!background) setError(e.message);
    }
    finally {
      if (!background) setLoading(false);
    }
  }, [getToken, user]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
  useMonetisationRealtime(fetchTransactions, 'transactions');

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, fontFamily:font }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,rgba(59,130,246,0.15),rgba(99,102,241,0.1))',display:'flex',alignItems:'center',justifyContent:'center',color:'#3b82f6' }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M6 15h4"/>
          </svg>
        </div>
        <span style={{ fontWeight:700, fontSize:15, color:text }}>Historique des ventes</span>
        {!loading && transactions.length > 0 && (
          <span style={{ padding:'2px 9px',borderRadius:999,fontSize:11,fontWeight:700,background:'rgba(59,130,246,0.15)',color:'#3b82f6' }}>
            {transactions.length}
          </span>
        )}
      </div>

      {error && (
        <div style={{ padding:'10px 14px',borderRadius:10,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#ef4444',fontSize:13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding:'28px 0', textAlign:'center', color:sub, fontSize:13 }}>Chargement...</div>
      ) : transactions.length === 0 ? (
        <div style={{ padding:'36px 24px', textAlign:'center', borderRadius:16, border:`1px dashed ${bdr}` }}>
          <div style={{ fontSize:40, marginBottom:12 }}>💳</div>
          <p style={{ fontSize:14, fontWeight:600, color: isDarkMode?'#d1d5db':'#374151', margin:'0 0 6px' }}>Aucune transaction récente</p>
          <p style={{ fontSize:12, color:sub, margin:0 }}>Vos ventes apparaîtront ici</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {transactions.map(({ _id, offerTitle, amount, date, status }, i) => {
            const s = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
            return (
              <motion.div
                key={_id}
                initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.05 }}
                style={{
                  padding:'14px 18px', borderRadius:14, border:`1px solid ${bdr}`,
                  background:card, display:'flex', alignItems:'center', gap:14,
                  boxShadow: isDarkMode?'0 2px 12px rgba(0,0,0,0.25)':'0 1px 6px rgba(0,0,0,0.04)',
                }}
              >
                {/* Dot */}
                <div style={{ width:8, height:8, borderRadius:'50%', background:s.color, flexShrink:0 }} />

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ margin:0, fontWeight:700, fontSize:13, color:text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{offerTitle}</p>
                  <p style={{ margin:'3px 0 0', fontSize:11, color:sub }}>
                    {new Date(date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}
                  </p>
                </div>

                {/* Status badge */}
                <span style={{ padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700, background:s.bg, color:s.color, whiteSpace:'nowrap', flexShrink:0 }}>
                  {s.label}
                </span>

                {/* Amount */}
                <span style={{ fontSize:14, fontWeight:800, color:'#f97316', whiteSpace:'nowrap', flexShrink:0 }}>
                  {amount.toLocaleString()} FCFA
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
