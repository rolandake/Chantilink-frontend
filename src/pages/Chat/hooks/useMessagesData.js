// ============================================ //
// 📁 src/pages/Chat/hooks/useMessagesData.js
// ============================================
import { useState, useEffect, useCallback, useRef } from "react";
import { API } from "../../../services/apiService";

export function useMessagesData(token, showToast) {
  const [ui, setUi] = useState({
    phone: false,
    load: false,
    search: "",
    showPending: false,
    showEmoji: false,
    showAddContact: false,
    contactFilter: 'all',
    up: false
  });

  const [data, setData] = useState({
    conn: [],
    msg: [],
    unread: {},
    stats: { total: 0, onChantilink: 0, other: 0 },
    pendingRequests: []
  });

  const [sel, setSel] = useState({ friend: null, msg: null });
  const [input, setInput] = useState("");
  const [err, setErr] = useState({ load: null, send: null });
  const [recon, setRecon] = useState(false);
  const reconRef = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(p => ({ ...p, load: null }));
    try {
      const [convRes, statsRes, pendingRes] = await Promise.all([
        API.loadConversations(token).catch(() => ({ connections: [] })),
        API.loadStats(token).catch(() => ({ total: 0, onChantilink: 0, other: 0 })),
        API.getPendingMessageRequests(token).catch(() => ({ requests: [] }))
      ]);

      setData(p => ({
        ...p,
        conn: convRes.connections || [],
        stats: statsRes || { total: 0, onChantilink: 0, other: 0 },
        pendingRequests: pendingRes.requests || []
      }));
    } catch (e) {
      setErr(p => ({ ...p, load: e.message }));
      showToast("Erreur de chargement des données", "error");
    }
  }, [token, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    ui, setUi,
    data, setData,
    sel, setSel,
    input, setInput,
    err, setErr,
    recon, setRecon,
    reconRef,
    load
  };
}