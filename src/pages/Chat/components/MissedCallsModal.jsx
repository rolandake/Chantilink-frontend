// ============================================
// 📁 src/components/MissedCallsModal.jsx
// ─ Liste des appels manqués (entrants + sortants sans réponse)
// ─ Bouton Rappeler sur chaque entrée
// ─ Effacer individuellement ou tout effacer
// ============================================
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Video, PhoneMissed, PhoneOutgoing, RotateCcw, Trash2 } from "lucide-react";

const fmt = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs  = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMs / 3600000);
  const diffD   = Math.floor(diffMs / 86400000);
  if (diffMin < 1)  return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH   < 24) return `Il y a ${diffH} h`;
  if (diffD   < 7)  return `Il y a ${diffD} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

export default function MissedCallsModal({
  isOpen,
  missedCalls = [],
  onClose,
  onCallback,       // (friend, callType) => void
  onDismiss,        // (id) => void
  onClearAll,
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{   opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{   y: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full sm:max-w-md bg-[#0f1218] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
              <PhoneMissed size={18} className="text-red-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-black text-white">Appels manqués</h2>
              <p className="text-[11px] text-gray-500">
                {missedCalls.length} appel{missedCalls.length > 1 ? "s" : ""}
              </p>
            </div>
            {missedCalls.length > 0 && (
              <button
                onClick={onClearAll}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] text-gray-400 font-bold transition-all"
              >
                <Trash2 size={11} /> Tout effacer
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-xl ml-1">
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {missedCalls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 opacity-40">
                <PhoneMissed size={36} className="text-gray-600" />
                <p className="text-sm text-gray-500 font-bold">Aucun appel manqué</p>
              </div>
            ) : (
              missedCalls.map((mc) => (
                <motion.div
                  key={mc.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{   opacity: 0, x: -12 }}
                  className="flex items-center gap-3 p-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-2xl border border-white/5 transition-all group"
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-600/40 to-rose-700/40 border border-red-500/20 flex items-center justify-center font-black text-white text-base overflow-hidden">
                      {mc.friend?.profilePhoto
                        ? <img src={mc.friend.profilePhoto} alt="" className="w-full h-full object-cover" />
                        : (mc.friend?.fullName?.[0] || "?").toUpperCase()
                      }
                    </div>
                    {/* Badge direction */}
                    <div className={`absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center ${mc.direction === "incoming" ? "bg-red-500" : "bg-orange-500"}`}>
                      {mc.direction === "incoming"
                        ? <PhoneMissed   size={9} className="text-white" />
                        : <PhoneOutgoing size={9} className="text-white" />
                      }
                    </div>
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{mc.friend?.fullName || "Inconnu"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {mc.callType === "video"
                        ? <Video size={11} className="text-gray-500 flex-shrink-0" />
                        : <Phone size={11} className="text-gray-500 flex-shrink-0" />
                      }
                      <span className="text-[11px] text-red-400 font-semibold">
                        {mc.direction === "incoming" ? "Manqué" : "Sans réponse"}
                      </span>
                      <span className="text-[10px] text-gray-600">·</span>
                      <span className="text-[11px] text-gray-500">{fmt(mc.timestamp)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onCallback?.(mc.friend, mc.callType)}
                      className="w-9 h-9 rounded-xl bg-green-500/15 hover:bg-green-500/30 flex items-center justify-center transition-all"
                      aria-label={`Rappeler ${mc.friend?.fullName}`}
                    >
                      {mc.callType === "video"
                        ? <Video  size={15} className="text-green-400" />
                        : <Phone  size={15} className="text-green-400" />
                      }
                    </motion.button>
                    <button
                      onClick={() => onDismiss?.(mc.id)}
                      className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                      aria-label="Effacer"
                    >
                      <X size={13} className="text-gray-500" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}