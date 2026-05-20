// src/components/PhoneModal.jsx - VERSION AVEC DEBUG COMPLET
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ||
  (import.meta.env.PROD ? "https://chantilink-backend.onrender.com" : "http://localhost:5000");

export default function PhoneModal({ onSuccess, onClose }) {
  const { token, user, getToken } = useAuth(); // Récupérer depuis le contexte
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [canSkip, setCanSkip] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  // Debug au chargement du composant
  useEffect(() => {
    const debugData = {
      timestamp: new Date().toISOString(),
      hasToken: !!token,
      tokenLength: token?.length || 0,
      tokenPreview: token ? `${token.substring(0, 20)}...` : 'NULL',
      hasUser: !!user,
      userId: user?._id || user?.id || 'NULL',
      userEmail: user?.email || 'NULL',
      contextType: typeof token,
      localStorageToken: localStorage.getItem('token') ? 'EXISTS' : 'NULL',
      cookies: document.cookie || 'EMPTY',
    };
    
    setDebugInfo(debugData);
    console.log('🔍 [PhoneModal] DEBUG INFO AU CHARGEMENT:', debugData);
  }, [token, user]);

  // Permettre de passer après 5 secondes
  useEffect(() => {
    const timer = setTimeout(() => setCanSkip(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const formatPhoneDisplay = (value) => {
    let cleaned = value.replace(/[^\d+]/g, '');
    
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned.replace(/^\+/, '');
    }
    
    if (cleaned.length > 16) {
      cleaned = cleaned.slice(0, 16);
    }
    
    if (cleaned.length > 3) {
      const plus = '+';
      const rest = cleaned.slice(1);
      let formatted = '';
      const firstGroup = rest.slice(0, Math.min(3, rest.length));
      formatted += firstGroup;
      
      const remaining = rest.slice(firstGroup.length);
      const groups = remaining.match(/.{1,2}/g);
      if (groups) {
        formatted += ' ' + groups.join(' ');
      }
      
      return plus + formatted;
    }
    
    return cleaned;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneDisplay(e.target.value);
    setPhone(formatted);
    setError('');
  };

  const validatePhone = (phoneValue) => {
    const cleaned = phoneValue.replace(/[\s\-\(\)\.]/g, '');
    const regex = /^\+[1-9][0-9]{6,14}$/;
    return regex.test(cleaned);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanedPhone = phone.replace(/[\s\-\(\)\.]/g, '');

    // Validation du format
    if (!validatePhone(cleanedPhone)) {
      setError('Format invalide. Utilisez le format international (ex: +33612345678, +225XXXXXXXXXX)');
      return;
    }

    console.log('📞 [PhoneModal] Début de la soumission');
    console.log('📞 [PhoneModal] Numéro nettoyé:', cleanedPhone);

    // Récupérer le token frais depuis le contexte
    let currentToken = token;
    
    try {
      // Essayer de récupérer un token frais si getToken est disponible
      if (getToken) {
        console.log('🔄 [PhoneModal] Récupération token frais via getToken()...');
        currentToken = await getToken();
        console.log('✅ [PhoneModal] Token frais récupéré:', currentToken ? `${currentToken.substring(0, 20)}...` : 'NULL');
      }
    } catch (err) {
      console.error('❌ [PhoneModal] Erreur getToken:', err);
    }

    // Debug complet avant l'envoi
    const requestDebug = {
      timestamp: new Date().toISOString(),
      phone: cleanedPhone,
      hasToken: !!currentToken,
      tokenLength: currentToken?.length || 0,
      tokenPreview: currentToken ? `${currentToken.substring(0, 20)}...` : 'NULL',
      tokenSource: getToken ? 'getToken()' : 'props',
      userId: user?._id || user?.id,
      userEmail: user?.email,
      apiUrl: API_URL,
      endpoint: '/api/users/update-phone',
    };

    console.log('🚀 [PhoneModal] DEBUG REQUEST:', requestDebug);

    if (!currentToken) {
      const errorMsg = '⚠️ Token manquant. Veuillez vous reconnecter.';
      console.error('❌ [PhoneModal]', errorMsg);
      setError(errorMsg);
      return;
    }

    setIsLoading(true);

    try {
      const url = `${API_URL}/api/users/update-phone`;
      const headers = {
        'Authorization': `Bearer ${currentToken}`,
        'Content-Type': 'application/json',
      };

      console.log('📤 [PhoneModal] URL:', url);
      console.log('📤 [PhoneModal] Headers:', {
        ...headers,
        Authorization: `Bearer ${currentToken.substring(0, 20)}...`,
      });
      console.log('📤 [PhoneModal] Body:', { phone: cleanedPhone });

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ phone: cleanedPhone }),
      });

      console.log('📥 [PhoneModal] Response Status:', response.status);
      console.log('📥 [PhoneModal] Response OK:', response.ok);
      console.log('📥 [PhoneModal] Response Headers:', {
        contentType: response.headers.get('content-type'),
        authorization: response.headers.get('authorization'),
      });

      // Lire la réponse
      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
        console.log('📥 [PhoneModal] Response Data:', data);
      } else {
        const text = await response.text();
        console.log('📥 [PhoneModal] Response Text:', text);
        data = { message: text };
      }

      // Traitement de la réponse
      if (response.ok && data.success) {
        console.log('✅ [PhoneModal] Succès!');
        console.log('✅ [PhoneModal] User retourné:', data.user);
        onSuccess(data.user);
      } else if (response.status === 401) {
        const errorMsg = '⚠️ Token invalide ou expiré. Veuillez vous reconnecter.';
        console.error('❌ [PhoneModal] 401:', errorMsg);
        console.error('❌ [PhoneModal] Data:', data);
        setError(errorMsg);
      } else if (response.status === 400) {
        console.error('❌ [PhoneModal] 400:', data.message);
        setError(data.message || 'Erreur de validation');
      } else {
        const errorMsg = data.message || `Erreur ${response.status}`;
        console.error('❌ [PhoneModal] Erreur:', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      console.error('❌ [PhoneModal] Exception:', err);
      console.error('❌ [PhoneModal] Stack:', err.stack);
      setError('Erreur de connexion. Réessayez plus tard.');
    } finally {
      setIsLoading(false);
      console.log('🏁 [PhoneModal] Fin de la requête');
    }
  };

  const handleSkip = async () => {
    if (!canSkip) return;

    console.log('⏭️ [PhoneModal] Skip demandé');

    if (user) {
      localStorage.setItem(`seenPhoneModal_${user._id || user.id}`, "true");
      console.log('💾 [PhoneModal] LocalStorage marqué');

      // Appeler la route pour marquer côté serveur
      try {
        const currentToken = await getToken?.() || token;
        
        if (currentToken) {
          console.log('📤 [PhoneModal] Appel seen-phone-modal...');
          
          const response = await fetch(
            `${API_URL}/api/users/seen-phone-modal`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          const data = await response.json();
          console.log('📥 [PhoneModal] seen-phone-modal response:', data);

          if (data.success && data.user) {
            // Mettre à jour l'utilisateur dans le contexte
            if (onSuccess) {
              onSuccess(data.user);
            }
          }
        }
      } catch (err) {
        console.error("⚠️ [PhoneModal] Erreur seen-phone-modal:", err);
      }
    }

    if (onClose) {
      onClose();
    }
  };

  // Bloquer le scroll du body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
        onClick={canSkip ? handleSkip : undefined}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-gray-700 relative overflow-hidden"
        >
          {/* Effet de fond animé */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-pink-500/10 animate-pulse" />

          {/* DEBUG INFO - Visible en dev */}
          {import.meta.env.MODE === 'development' && debugInfo && (
            <details className="relative z-10 mb-4 text-xs bg-gray-800/50 rounded-lg p-2 border border-gray-700">
              <summary className="cursor-pointer text-yellow-400 font-mono">
                🔍 Debug Info (cliquez)
              </summary>
              <pre className="mt-2 text-gray-300 overflow-auto max-h-40">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}

          {/* Contenu */}
          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center text-4xl shadow-lg"
              >
                📱
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Ajoute ton numéro
              </h2>
              <p className="text-gray-400 text-sm">
                Active la messagerie Chantilink en ajoutant ton numéro de téléphone international
              </p>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Numéro de téléphone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="+33612345678 ou +225XXXXXXXXXX"
                  className={`w-full px-4 py-3 bg-gray-800/50 text-white placeholder-gray-500 rounded-xl border-2 ${
                    error
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-700 focus:border-orange-500'
                  } focus:outline-none transition text-lg tracking-wide`}
                  autoFocus
                  disabled={isLoading}
                />
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-red-400 text-sm mt-2 flex items-center gap-1"
                    >
                      <span>⚠️</span>
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Infos */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                <p className="text-blue-300 text-xs flex items-start gap-2">
                  <span className="text-base">ℹ️</span>
                  <span>
                    Ton numéro sera utilisé pour synchroniser tes contacts et faciliter
                    les conversations sur Chantilink
                  </span>
                </p>
              </div>

              {/* Boutons */}
              <div className="flex gap-3 pt-2">
                {canSkip && (
                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    type="button"
                    onClick={handleSkip}
                    className="flex-1 px-4 py-3 bg-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-700 transition font-medium"
                  >
                    Plus tard
                  </motion.button>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !phone}
                  className={`${
                    canSkip ? 'flex-1' : 'w-full'
                  } px-4 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl hover:from-orange-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold shadow-lg hover:shadow-orange-500/50 flex items-center justify-center gap-2`}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                      <span>Vérification...</span>
                    </>
                  ) : (
                    <>
                      <span>Enregistrer</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>

              {!canSkip && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  Vous pourrez passer dans quelques secondes...
                </p>
              )}
            </form>

            {/* Avantages */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-xs text-gray-400 mb-3 font-medium">
                Pourquoi ajouter mon numéro ?
              </p>
              <div className="space-y-2">
                {[
                  { icon: '🔍', text: 'Trouve tes contacts déjà sur Chantilink' },
                  { icon: '💬', text: 'Discute facilement avec tes proches' },
                  { icon: '🔒', text: 'Ton numéro reste privé et sécurisé' },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="flex items-center gap-2 text-xs text-gray-400"
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
