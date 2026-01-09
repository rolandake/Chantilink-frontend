// src/pages/Profile/StorageManager.jsx - GESTION DU STOCKAGE LOCAL
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrashIcon, 
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  CircleStackIcon // ✅ CORRECTION: DatabaseIcon n'existe pas, on utilise CircleStackIcon
} from '@heroicons/react/24/outline';
import { useDarkMode } from '../../context/DarkModeContext';
import { checkStorageQuota, cleanupIndexedDB, resetIndexedDB } from '../../utils/idbCleanup';

export default function StorageManager({ user, showToast }) {
  const { isDarkMode } = useDarkMode();
  const [storageInfo, setStorageInfo] = useState(null);
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [resettingStorage, setResettingStorage] = useState(false);
  const [loading, setLoading] = useState(true);

  // ✅ Charger les infos de storage au montage
  useEffect(() => {
    loadStorageInfo();
  }, []);

  const loadStorageInfo = async () => {
    setLoading(true);
    try {
      const info = await checkStorageQuota();
      setStorageInfo(info);
    } catch (err) {
      console.error('Erreur chargement storage info:', err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Nettoyage simple (recommandé)
  const handleCleanup = async () => {
    if (cleaningStorage) return;
    
    setCleaningStorage(true);
    try {
      const success = await cleanupIndexedDB();
      if (success) {
        showToast?.('✅ Cache nettoyé avec succès', 'success');
        await loadStorageInfo();
      } else {
        showToast?.('❌ Erreur lors du nettoyage', 'error');
      }
    } catch (err) {
      console.error('Erreur cleanup:', err);
      showToast?.('❌ Erreur lors du nettoyage', 'error');
    } finally {
      setCleaningStorage(false);
    }
  };

  // ✅ Réinitialisation complète (dangereux)
  const handleReset = async () => {
    if (resettingStorage) return;
    
    const confirmed = window.confirm(
      '⚠️ ATTENTION: Cette action va supprimer TOUT le cache local.\n\n' +
      'Cela inclut:\n' +
      '• Tous les posts en cache\n' +
      '• Les profils sauvegardés\n' +
      '• Les stories\n' +
      '• Toutes les données hors ligne\n\n' +
      'Vous devrez recharger toutes les données depuis le serveur.\n\n' +
      'Cette action est IRRÉVERSIBLE.\n\n' +
      'Êtes-vous absolument sûr(e) de vouloir continuer ?'
    );
    
    if (!confirmed) return;
    
    setResettingStorage(true);
    try {
      const success = await resetIndexedDB();
      if (success) {
        showToast?.('✅ Cache réinitialisé. Rechargement dans 2 secondes...', 'success');
        // Recharger la page après 2 secondes
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        showToast?.('❌ Erreur lors de la réinitialisation', 'error');
      }
    } catch (err) {
      console.error('Erreur reset:', err);
      showToast?.('❌ Erreur lors de la réinitialisation', 'error');
    } finally {
      setResettingStorage(false);
    }
  };

  const getStorageColor = (percent) => {
    if (percent >= 90) return 'text-red-500';
    if (percent >= 70) return 'text-orange-500';
    return 'text-green-500';
  };

  const getProgressBarColor = (percent) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-orange-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className={`inline-block w-12 h-12 border-4 rounded-full animate-spin ${
            isDarkMode ? 'border-orange-400 border-t-transparent' : 'border-orange-500 border-t-transparent'
          }`}></div>
          <p className={`mt-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Analyse du stockage...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* TITRE */}
      <div className="flex items-center gap-3 mb-6">
        <CircleStackIcon className={`w-8 h-8 ${isDarkMode ? 'text-orange-500' : 'text-orange-600'}`} />
        <div>
          <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Gestion du Stockage
          </h2>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Gérez l'espace de cache local de l'application
          </p>
        </div>
      </div>

      {/* INFORMATIONS STOCKAGE */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 shadow-xl border ${
          isDarkMode 
            ? 'bg-gray-800/50 border-white/5' 
            : 'bg-white border-gray-200'
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <ChartBarIcon className={`w-6 h-6 ${isDarkMode ? 'text-orange-500' : 'text-orange-600'}`} />
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Utilisation du Stockage Local
          </h3>
        </div>

        {storageInfo ? (
          <div className="space-y-4">
            {/* Barre de progression */}
            <div>
              <div className="flex justify-between mb-2">
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Espace utilisé
                </span>
                <span className={`text-sm font-bold ${getStorageColor(storageInfo.percentUsed)}`}>
                  {storageInfo.percentUsed.toFixed(1)}%
                </span>
              </div>
              <div className={`w-full h-4 rounded-full overflow-hidden ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${storageInfo.percentUsed}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${getProgressBarColor(storageInfo.percentUsed)}`}
                />
              </div>
            </div>

            {/* Détails */}
            <div className={`grid grid-cols-2 gap-4 p-4 rounded-xl ${
              isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'
            }`}>
              <div>
                <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                  Utilisé
                </p>
                <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {(storageInfo.usage / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div>
                <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                  Total disponible
                </p>
                <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {(storageInfo.quota / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            {/* Alerte si quota élevé */}
            {storageInfo.percentUsed >= 80 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex items-start gap-3 p-4 rounded-xl border ${
                  storageInfo.percentUsed >= 90
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-orange-500/10 border-orange-500/30'
                }`}
              >
                <ExclamationTriangleIcon className={`w-5 h-5 flex-shrink-0 ${
                  storageInfo.percentUsed >= 90 ? 'text-red-500' : 'text-orange-500'
                }`} />
                <div>
                  <p className={`text-sm font-semibold ${
                    storageInfo.percentUsed >= 90 ? 'text-red-400' : 'text-orange-400'
                  }`}>
                    {storageInfo.percentUsed >= 90 
                      ? '⚠️ Espace de stockage critique' 
                      : '⚠️ Espace de stockage limité'}
                  </p>
                  <p className={`text-xs mt-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {storageInfo.percentUsed >= 90 
                      ? 'Nettoyez ou réinitialisez le cache immédiatement pour éviter les problèmes.'
                      : 'Pensez à nettoyer le cache bientôt pour libérer de l\'espace.'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Info sur le contenu du cache */}
            <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
              <p className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                💡 Que contient le cache local ?
              </p>
              <ul className={`text-xs space-y-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <li>• Posts et images pour consultation hors ligne</li>
                <li>• Profils utilisateurs récemment visités</li>
                <li>• Stories et contenu vidéo temporaire</li>
                <li>• Données de conversations (messages)</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <p>Impossible de récupérer les informations de stockage.</p>
            <button 
              onClick={loadStorageInfo}
              className={`mt-4 px-4 py-2 rounded-lg ${
                isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Réessayer
            </button>
          </div>
        )}
      </motion.div>

      {/* ACTIONS DE MAINTENANCE */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`rounded-3xl p-6 shadow-xl border ${
          isDarkMode 
            ? 'bg-gray-800/50 border-white/5' 
            : 'bg-white border-gray-200'
        }`}
      >
        <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Actions de Maintenance
        </h3>

        <div className="space-y-3">
          {/* Nettoyage simple (RECOMMANDÉ) */}
          <motion.button
            onClick={handleCleanup}
            disabled={cleaningStorage}
            whileHover={{ scale: cleaningStorage ? 1 : 1.02 }}
            whileTap={{ scale: cleaningStorage ? 1 : 0.98 }}
            className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
              isDarkMode
                ? 'bg-gray-900/50 border-gray-700 hover:border-orange-500 hover:bg-gray-900'
                : 'bg-gray-50 border-gray-200 hover:border-orange-500 hover:bg-white'
            } disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${
                isDarkMode ? 'bg-orange-500/20' : 'bg-orange-100'
              }`}>
                <ArrowPathIcon className={`w-6 h-6 ${
                  cleaningStorage ? 'animate-spin' : ''
                } text-orange-500`} />
              </div>
              <div className="text-left">
                <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Nettoyer le cache
                </p>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  ✅ Supprime les données anciennes (+ de 7 jours) - Recommandé
                </p>
              </div>
            </div>
            {!cleaningStorage && (
              <CheckCircleIcon className="w-6 h-6 text-green-500" />
            )}
          </motion.button>

          {/* Réinitialisation complète (DANGEREUX) */}
          <motion.button
            onClick={handleReset}
            disabled={resettingStorage}
            whileHover={{ scale: resettingStorage ? 1 : 1.02 }}
            whileTap={{ scale: resettingStorage ? 1 : 0.98 }}
            className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
              isDarkMode
                ? 'bg-gray-900/50 border-gray-700 hover:border-red-500 hover:bg-gray-900'
                : 'bg-gray-50 border-gray-200 hover:border-red-500 hover:bg-white'
            } disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${
                isDarkMode ? 'bg-red-500/20' : 'bg-red-100'
              }`}>
                <TrashIcon className={`w-6 h-6 ${
                  resettingStorage ? 'animate-pulse' : ''
                } text-red-500`} />
              </div>
              <div className="text-left">
                <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Réinitialiser tout le cache
                </p>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  ⚠️ Supprime TOUT - À utiliser en dernier recours
                </p>
              </div>
            </div>
            {!resettingStorage && (
              <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
            )}
          </motion.button>
        </div>

        {/* Note importante */}
        <div className={`mt-6 p-4 rounded-xl ${
          isDarkMode ? 'bg-gray-900/50' : 'bg-gray-100'
        }`}>
          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <strong>Note :</strong> Le nettoyage du cache ne supprime pas vos posts, messages ou données du serveur. 
            Il supprime uniquement les copies locales pour économiser de l'espace. 
            Les données seront rechargées automatiquement lorsque nécessaire.
          </p>
        </div>
      </motion.div>
    </div>
  );
}