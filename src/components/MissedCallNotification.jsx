// ============================================
// 3. COMPOSANT: MissedCallNotification.jsx
// ============================================
import React from "react";
import { motion } from "framer-motion";
import { PhoneMissed, Phone, Video } from "lucide-react";

const MissedCallNotification = ({ call, onCallback, onDismiss }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className="fixed top-4 right-4 z-[250] max-w-sm"
    >
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-orange-500/30 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          {/* Icône */}
          <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
            <PhoneMissed className="w-6 h-6 text-orange-500" />
          </div>

          {/* Contenu */}
          <div className="flex-1">
            <h4 className="text-white font-semibold mb-1">
              Appel manqué
            </h4>
            <p className="text-sm text-gray-300 mb-3">
              {call.caller.fullName} • Appel {call.type}
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={onCallback}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
              >
                {call.type === "video" ? (
                  <Video className="w-4 h-4" />
                ) : (
                  <Phone className="w-4 h-4" />
                )}
                Rappeler
              </button>
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MissedCallNotification;