// src/pages/Profile/Monetisation/OffersSection.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useDarkMode } from '../../../context/DarkModeContext';

const TrashIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);
const PlusIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

export default function OffersSection() {
  const { user }       = useAuth();
  const { isDarkMode } = useDarkMode();

  const [offers, setOffers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm]     = useState(false);

  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice]           = useState('');

  const font = "'Sora','DM Sans',sans-serif";
  const bdr  = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const card = isDarkMode ? 'rgba(14,14,14,0.98)' : '#fff';
  const sub  = isDarkMode ? '#6b7280' : '#9ca3af';
  const text = isDarkMode ? '#f3f4f6' : '#111827';

  const fetchOffers = async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/monetisation/offers', { headers:{ Authorization:`Bearer ${user.token}` } });
      if (!res.ok) throw new Error('Erreur récupération offres');
      const data = await res.json();
      setOffers(data.offers);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user) fetchOffers(); }, [user]);

  const handleCreate = async () => {
    setError('');
    if (!title || !price) { setError('Titre et prix sont obligatoires'); return; }
    const priceNumber = Number(price);
    if (isNaN(priceNumber) || priceNumber <= 0) { setError('Prix invalide'); return; }
    setSubmitting(true);
    try {
      const res  = await fetch('/api/monetisation/offers', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${user.token}` },
        body: JSON.stringify({ title, description, price:priceNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur création offre');
      setTitle(''); setDescription(''); setPrice(''); setShowForm(false);
      fetchOffers();
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette offre ?')) return;
    try {
      const res  = await fetch(`/api/monetisation/offers/${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${user.token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur suppression');
      fetchOffers();
    } catch (e) { setError(e.message); }
  };

  const inputStyle = {
    width:'100%', padding:'12px 14px', borderRadius:12,
    border:`1px solid ${bdr}`,
    background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    color:text, fontFamily:font, fontSize:14, outline:'none',
    transition:'border-color 0.2s',
    boxSizing:'border-box',
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, fontFamily:font }}>

      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,rgba(249,115,22,0.15),rgba(236,72,153,0.1))',display:'flex',alignItems:'center',justifyContent:'center',color:'#f97316' }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 01-8 0"/>
            </svg>
          </div>
          <span style={{ fontWeight:700, fontSize:15, color:text }}>Vos offres actives</span>
          {!loading && (
            <span style={{ padding:'2px 9px',borderRadius:999,fontSize:11,fontWeight:700,background:'linear-gradient(135deg,#f97316,#ec4899)',color:'#fff' }}>
              {offers.length}
            </span>
          )}
        </div>
        <motion.button
          onClick={() => setShowForm(s => !s)}
          whileHover={{ scale:1.03, y:-1 }} whileTap={{ scale:0.97 }}
          style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'9px 18px', borderRadius:999, border:'none', cursor:'pointer',
            background: showForm
              ? (isDarkMode?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)')
              : 'linear-gradient(135deg,#f97316,#ec4899)',
            color: showForm ? sub : '#fff',
            fontFamily:font, fontWeight:700, fontSize:13,
            boxShadow: showForm ? 'none' : '0 4px 16px rgba(249,115,22,0.35)',
          }}
        >
          <PlusIcon />
          {showForm ? 'Annuler' : 'Nouvelle offre'}
        </motion.button>
      </div>

      {/* Erreur */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{ padding:'10px 14px',borderRadius:10,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#ef4444',fontSize:13 }}>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formulaire */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
            style={{ overflow:'hidden' }}
          >
            <div style={{ padding:20, borderRadius:16, border:`1px solid ${bdr}`, background:card, display:'flex', flexDirection:'column', gap:12 }}>
              <p style={{ margin:0, fontSize:13, fontWeight:700, color:text }}>Créer une nouvelle offre</p>
              <input style={inputStyle} placeholder="Titre de l'offre *" value={title} onChange={e=>setTitle(e.target.value)} />
              <textarea style={{ ...inputStyle, minHeight:80, resize:'vertical' }} placeholder="Description (optionnel)" value={description} onChange={e=>setDescription(e.target.value)} />
              <input style={inputStyle} type="number" placeholder="Prix en FCFA *" value={price} onChange={e=>setPrice(e.target.value)} min="1" />
              <motion.button
                onClick={handleCreate}
                disabled={submitting}
                whileHover={{ scale: submitting?1:1.02 }} whileTap={{ scale:0.98 }}
                style={{
                  padding:'11px 0', borderRadius:12, border:'none', cursor: submitting?'not-allowed':'pointer',
                  background:'linear-gradient(135deg,#f97316,#ec4899)',
                  color:'#fff', fontFamily:font, fontWeight:700, fontSize:14,
                  opacity: submitting?0.7:1,
                  boxShadow:'0 4px 16px rgba(249,115,22,0.35)',
                }}
              >
                {submitting ? 'Création...' : 'Créer l\'offre'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liste */}
      {loading ? (
        <div style={{ padding:'28px 0', textAlign:'center', color:sub, fontSize:13 }}>Chargement des offres...</div>
      ) : offers.length === 0 ? (
        <div style={{ padding:'36px 24px', textAlign:'center', borderRadius:16, border:`1px dashed ${bdr}` }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
          <p style={{ fontSize:14, fontWeight:600, color: isDarkMode?'#d1d5db':'#374151', margin:'0 0 6px' }}>Aucune offre active</p>
          <p style={{ fontSize:12, color:sub, margin:0 }}>Créez votre première offre pour commencer à monétiser</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {offers.map((offer, i) => (
            <motion.div
              key={offer._id}
              initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.06 }}
              style={{
                padding:'16px 18px', borderRadius:14, border:`1px solid ${bdr}`,
                background:card, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
                boxShadow: isDarkMode?'0 2px 12px rgba(0,0,0,0.3)':'0 1px 8px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:14, color:text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{offer.title}</p>
                {offer.description && <p style={{ margin:'4px 0 0', fontSize:12, color:sub, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{offer.description}</p>}
                <p style={{ margin:'6px 0 0', fontSize:13, fontWeight:800, background:'linear-gradient(135deg,#f97316,#ec4899)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                  {offer.price.toLocaleString()} FCFA
                </p>
              </div>
              <motion.button
                onClick={() => handleDelete(offer._id)}
                whileHover={{ scale:1.08 }} whileTap={{ scale:0.92 }}
                style={{
                  width:34, height:34, borderRadius:10, border:'none', cursor:'pointer',
                  background:'rgba(239,68,68,0.1)', color:'#ef4444',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0,
                }}
                title="Supprimer"
              >
                <TrashIcon />
              </motion.button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}