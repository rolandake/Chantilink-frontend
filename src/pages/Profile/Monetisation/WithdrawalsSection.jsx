// src/pages/Profile/Monetisation/WithdrawalsSection.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useDarkMode } from '../../../context/DarkModeContext';
import { getAuthToken, monetisationFetch } from './monetisationApi';

export default function WithdrawalsSection() {
  const { user, getToken } = useAuth();
  const { isDarkMode } = useDarkMode();

  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [amount, setAmount]           = useState('');
  const [method, setMethod]           = useState('orange_money');
  const [submitting, setSubmitting]   = useState(false);
  const [success, setSuccess]         = useState('');

  const font = "'Sora','DM Sans',sans-serif";
  const bdr  = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const card = isDarkMode ? 'rgba(14,14,14,0.98)' : '#fff';
  const text = isDarkMode ? '#f3f4f6' : '#111827';
  const sub  = isDarkMode ? '#6b7280' : '#9ca3af';

  const fetchWithdrawals = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getAuthToken(getToken);
      const res  = await monetisationFetch('withdrawals', { token });
      if (!res.ok) throw new Error('Erreur chargement retraits');
      const data = await res.json();
      setWithdrawals(data.withdrawals || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchWithdrawals(); }, [user, getToken]);

  const handleWithdraw = async () => {
    setError(''); setSuccess('');
    const num = Number(amount);
    if (!num || num <= 0) { setError('Montant invalide'); return; }
    setSubmitting(true);
    try {
      const token = await getAuthToken(getToken);
      const res  = await monetisationFetch('withdrawals', {
        method:'POST',
        token,
        body: JSON.stringify({ amount:num, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur lors du retrait');
      setAmount('');
      setSuccess('Demande de retrait envoyée avec succès !');
      fetchWithdrawals();
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const METHODS = [
    { value:'orange_money', label:'Orange Money' },
    { value:'mtn_momo',     label:'MTN MoMo'     },
    { value:'wave',         label:'Wave'          },
    { value:'bank',         label:'Virement bancaire' },
  ];

  const inputStyle = {
    width:'100%', padding:'12px 14px', borderRadius:12,
    border:`1px solid ${bdr}`,
    background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    color:text, fontFamily:font, fontSize:14, outline:'none', boxSizing:'border-box',
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, fontFamily:font }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,rgba(34,197,94,0.15),rgba(16,185,129,0.1))',display:'flex',alignItems:'center',justifyContent:'center',color:'#22c55e' }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
        </div>
        <span style={{ fontWeight:700, fontSize:15, color:text }}>Retraits de fonds</span>
      </div>

      {/* Formulaire retrait */}
      <div style={{ padding:18, borderRadius:16, border:`1px solid ${bdr}`, background:card, display:'flex', flexDirection:'column', gap:12 }}>
        <p style={{ margin:0, fontSize:13, fontWeight:600, color:sub }}>Nouvelle demande de retrait</p>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <input
            style={{ ...inputStyle, flex:'1 1 140px' }}
            type="number" placeholder="Montant (FCFA)" value={amount} onChange={e=>setAmount(e.target.value)} min="1"
          />
          <select
            style={{ ...inputStyle, flex:'1 1 160px' }}
            value={method} onChange={e=>setMethod(e.target.value)}
          >
            {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <AnimatePresence>
          {error && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ padding:'9px 12px',borderRadius:10,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#ef4444',fontSize:12 }}>{error}</motion.div>}
          {success && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ padding:'9px 12px',borderRadius:10,background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.2)',color:'#22c55e',fontSize:12 }}>{success}</motion.div>}
        </AnimatePresence>

        <motion.button
          onClick={handleWithdraw} disabled={submitting}
          whileHover={{ scale:submitting?1:1.02 }} whileTap={{ scale:0.98 }}
          style={{
            padding:'11px 0', borderRadius:12, border:'none', cursor:submitting?'not-allowed':'pointer',
            background:'linear-gradient(135deg,#22c55e,#16a34a)',
            color:'#fff', fontFamily:font, fontWeight:700, fontSize:14,
            opacity:submitting?0.7:1, boxShadow:'0 4px 14px rgba(34,197,94,0.35)',
          }}
        >
          {submitting ? 'Envoi...' : 'Demander un retrait'}
        </motion.button>
      </div>

      {/* Historique */}
      {loading ? (
        <div style={{ padding:'20px 0', textAlign:'center', color:sub, fontSize:13 }}>Chargement...</div>
      ) : withdrawals.length === 0 ? (
        <div style={{ padding:'28px 24px', textAlign:'center', borderRadius:16, border:`1px dashed ${bdr}` }}>
          <p style={{ fontSize:13, color:sub, margin:0 }}>Aucun retrait effectué pour l'instant</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {withdrawals.map(({ _id, amount, method, date, status }, i) => {
            const s = status === 'completed'
              ? { label:'Approuvé', color:'#22c55e', bg:'rgba(34,197,94,0.1)' }
              : status === 'pending'
              ? { label:'En attente', color:'#eab308', bg:'rgba(234,179,8,0.1)' }
              : { label:'Rejeté', color:'#ef4444', bg:'rgba(239,68,68,0.1)' };
            return (
              <motion.div key={_id} initial={{ opacity:0,x:-10 }} animate={{ opacity:1,x:0 }} transition={{ delay:i*0.05 }}
                style={{ padding:'13px 16px',borderRadius:12,border:`1px solid ${bdr}`,background:card,display:'flex',alignItems:'center',gap:12 }}>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0,fontSize:13,fontWeight:700,color:text }}>{amount.toLocaleString()} FCFA</p>
                  <p style={{ margin:'2px 0 0',fontSize:11,color:sub }}>{method} · {new Date(date).toLocaleDateString('fr-FR', { day:'2-digit',month:'short',year:'numeric' })}</p>
                </div>
                <span style={{ padding:'3px 10px',borderRadius:999,fontSize:11,fontWeight:700,background:s.bg,color:s.color }}>{s.label}</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
