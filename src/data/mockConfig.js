// ============================================
// 📁 src/config/mockConfig.js
// Configuration centralisée pour le système de posts fictifs
// ============================================

/**
 * 🎯 CONFIGURATION PRINCIPALE
 * Modifie ces valeurs pour personnaliser le comportement
 */
export const MOCK_CONFIG = {
  // ============================================
  // ACTIVATION/DÉSACTIVATION
  // ============================================
  enabled: true, // Active/désactive tout le système de posts fictifs
  
  // ============================================
  // CHARGEMENT DES POSTS
  // ============================================
  initialCount: 10, // 🔥 RÉDUIT de 20 à 10 pour LCP rapide
  loadMoreCount: 10, // Nombre de posts à charger lors du scroll
  
  // ============================================
  // GÉNÉRATION LAZY (NOUVELLE SECTION)
  // ============================================
  lazyGeneration: {
    enabled: true, // Active la génération différée
    delayMs: 10000, // Attendre 10s après le chargement initial
    generateOnIdle: true, // Générer seulement quand le navigateur est idle
    maxIdleTimeout: 5000, // Timeout max pour requestIdleCallback
  },
  
  // ============================================
  // MÉLANGE AVEC VRAIS POSTS
  // ============================================
  mixWithRealPosts: true, // Mélanger posts fictifs + vrais posts
  realPostsRatio: 2, // Ratio : X vrais posts → 1 post fictif
  autoDisableThreshold: 10, // Désactiver posts fictifs quand X vrais posts
  
  // ============================================
  // INTERFACE UTILISATEUR
  // ============================================
  showDemoIndicator: true, // Afficher le badge "Mode démo"
  showMockPostBadge: false, // Afficher badge sur chaque post fictif
  allowMockPostInteractions: false, // Autoriser likes/comments sur posts fictifs
  showGenerationProgress: true, // 🆕 Afficher la progression de génération
  
  // ============================================
  // GÉNÉRATION DES DONNÉES
  // ============================================
  totalUsers: 500, // 🔥 RÉDUIT de 5000 à 500 pour génération rapide
  totalPosts: 1000, // 🔥 RÉDUIT de 10000 à 1000 pour génération rapide
  verifiedUsersPercent: 5, // Pourcentage d'utilisateurs vérifiés (%)
  
  // ============================================
  // LIKES ET COMMENTAIRES
  // ============================================
  likes: {
    min: 0,
    max: 5000,
  },
  comments: {
    min: 0,
    max: 500,
    maxDisplayed: 15, // Nombre max de commentaires affichés par post
  },
  shares: {
    min: 0,
    max: 100,
  },
  
  // ============================================
  // IMAGES
  // ============================================
  images: {
    quality: 60, // 🔥 RÉDUIT de 80 à 60 pour chargement rapide
    mainWidth: 1080, // Largeur image principale
    thumbnailWidth: 400, // Largeur miniature
    postWithImagesPercent: 60, // % de posts avec images
    multiImagePercent: 30, // % de posts avec plusieurs images
    maxImagesPerPost: 4,
  },
  
  // ============================================
  // DATES
  // ============================================
  dates: {
    startDate: new Date(2024, 0, 1), // 🔥 RÉDUIT de 2023 à 2024
    endDate: new Date(), // Date de fin (aujourd'hui par défaut)
  },
  
  // ============================================
  // CONTENU
  // ============================================
  content: {
    emojiProbability: 0.7, // Probabilité d'avoir un emoji (0-1)
    locationProbability: 0.6, // Probabilité d'avoir une localisation (0-1)
    hashtagsProbability: 0.3, // Probabilité d'avoir des hashtags (0-1)
    maxHashtags: 3,
  },
};

/**
 * 🎨 CONFIGURATION DES PUBLICITÉS
 * Contrôle l'affichage des pubs entre les posts
 */
export const AD_CONFIG = {
  enabled: true, // Active/désactive les publicités
  frequency: 5, // 🔥 AUGMENTÉ de 3 à 5 (moins de pubs = meilleur perf)
  minPostsBeforeFirstAd: 3, // 🔥 AUGMENTÉ de 1 à 3
  canClose: true, // Autoriser la fermeture des pubs
  autoRotate: false, // Rotation automatique des pubs démo
  rotationInterval: 30000, // Intervalle de rotation (ms)
};

/**
 * 🎯 TYPES DE POSTS ET LEUR FRÉQUENCE
 * Ajuste la probabilité de chaque type de post
 */
export const POST_TYPE_WEIGHTS = {
  business: 15, // Posts d'affaires
  food: 20, // Posts nourriture
  lifestyle: 25, // Posts lifestyle
  motivation: 15, // Posts motivants
  events: 10, // Posts événements
  random: 10, // Posts divers
  trending: 5, // Posts tendance
};

/**
 * 🌍 VILLES PRINCIPALES
 * Définit quelles villes apparaissent le plus souvent
 */
export const CITY_WEIGHTS = {
  'Abidjan': 60, // 60% des posts
  'Bouaké': 10,
  'Yamoussoukro': 8,
  'San-Pédro': 5,
  'Daloa': 5,
  'Korhogo': 4,
  'Man': 3,
  'Grand-Bassam': 5,
};

/**
 * 📱 CONFIGURATION MOBILE
 * Optimisations spécifiques mobile
 */
export const MOBILE_CONFIG = {
  lazyLoadThreshold: '200px', // Distance avant chargement
  imageQuality: 50, // 🔥 RÉDUIT de 60 à 50 pour mobile
  initialCountMobile: 5, // 🔥 RÉDUIT de 10 à 5
  loadMoreCountMobile: 5, // Moins de posts par scroll sur mobile
};

/**
 * 🔧 CONFIGURATION DÉVELOPPEMENT
 * Utile pendant le développement
 */
export const DEV_CONFIG = {
  enableLogs: true, // Activer les logs console
  showGenerationStats: true, // Afficher les stats de génération
  enablePerformanceMetrics: true, // 🔥 ACTIVÉ pour surveiller les perfs
  mockDataCaching: true, // Mettre en cache les données générées
  measureINP: true, // 🆕 Mesurer l'Interaction to Next Paint
};

/**
 * 🎨 THÈME DES PUBLICITÉS
 * Personnalise l'apparence des pubs
 */
export const AD_THEME = {
  borderRadius: 'none', // none | sm | md | lg | full
  showSponsoredLabel: true,
  labelText: 'Publicité',
  labelPosition: 'top', // top | bottom
};

/**
 * 🚀 PRESETS RAPIDES
 * Configurations pré-définies pour différents scénarios
 */
export const PRESETS = {
  // Projet en phase de démarrage
  startup: {
    ...MOCK_CONFIG,
    enabled: true,
    initialCount: 30,
    showDemoIndicator: true,
    mixWithRealPosts: false,
    totalUsers: 200,
    totalPosts: 500,
  },
  
  // Projet en croissance
  growth: {
    ...MOCK_CONFIG,
    enabled: true,
    initialCount: 15,
    mixWithRealPosts: true,
    autoDisableThreshold: 20,
    totalUsers: 500,
    totalPosts: 1000,
  },
  
  // Projet mature
  production: {
    ...MOCK_CONFIG,
    enabled: false,
    showDemoIndicator: false,
    lazyGeneration: {
      enabled: false,
    },
  },
  
  // Mode démo pour présentation
  demo: {
    ...MOCK_CONFIG,
    enabled: true,
    initialCount: 20,
    showDemoIndicator: true,
    showMockPostBadge: true,
    allowMockPostInteractions: true,
    totalUsers: 1000,
    totalPosts: 2000,
  },
  
  // Mode test/développement (OPTIMISÉ)
  development: {
    ...MOCK_CONFIG,
    enabled: true,
    initialCount: 10, // 🔥 Seulement 10 posts au départ
    totalUsers: 100, // 🔥 100 users max
    totalPosts: 200, // 🔥 200 posts max
    showDemoIndicator: true,
    lazyGeneration: {
      enabled: true,
      delayMs: 15000, // Attendre 15s en dev
      generateOnIdle: true,
      maxIdleTimeout: 5000,
    },
    images: {
      quality: 50, // Qualité réduite en dev
      mainWidth: 800,
      thumbnailWidth: 300,
      postWithImagesPercent: 50,
      multiImagePercent: 20,
      maxImagesPerPost: 3,
    },
  },
};

/**
 * 🎯 HELPER FUNCTIONS
 * Fonctions utilitaires pour gérer la config
 */

/**
 * Charge un preset pré-défini
 * @param {string} presetName - Nom du preset (startup, growth, production, demo, development)
 * @returns {object} Configuration du preset
 */
export function loadPreset(presetName) {
  if (!PRESETS[presetName]) {
    console.warn(`⚠️ Preset "${presetName}" not found. Using default config.`);
    return MOCK_CONFIG;
  }
  
  console.log(`📦 Preset "${presetName}" loaded`);
  return PRESETS[presetName];
}

/**
 * Détecte automatiquement le meilleur preset selon le contexte
 * @param {number} realPostsCount - Nombre de vrais posts existants
 * @returns {object} Configuration adaptée
 */
export function autoDetectPreset(realPostsCount) {
  // Vérifier si on est en développement
  const isDev = import.meta.env?.DEV || process.env.NODE_ENV === 'development';
  
  if (isDev) {
    console.log('🛠️ Auto-detected: DEVELOPMENT preset');
    return PRESETS.development;
  }
  
  if (realPostsCount === 0) {
    console.log('🚀 Auto-detected: STARTUP preset');
    return PRESETS.startup;
  }
  
  if (realPostsCount < 20) {
    console.log('📈 Auto-detected: GROWTH preset');
    return PRESETS.growth;
  }
  
  console.log('✅ Auto-detected: PRODUCTION preset');
  return PRESETS.production;
}

/**
 * Fusionne une config custom avec le preset par défaut
 * @param {object} customConfig - Configuration personnalisée
 * @returns {object} Configuration fusionnée
 */
export function mergeConfig(customConfig = {}) {
  return {
    ...MOCK_CONFIG,
    ...customConfig,
    lazyGeneration: {
      ...MOCK_CONFIG.lazyGeneration,
      ...(customConfig.lazyGeneration || {}),
    },
    images: {
      ...MOCK_CONFIG.images,
      ...(customConfig.images || {}),
    },
  };
}

/**
 * Valide la configuration
 * @param {object} config - Configuration à valider
 * @returns {boolean} true si valide
 */
export function validateConfig(config) {
  const errors = [];
  
  if (config.initialCount > config.totalPosts) {
    errors.push('initialCount cannot be greater than totalPosts');
  }
  
  if (config.loadMoreCount < 1) {
    errors.push('loadMoreCount must be at least 1');
  }
  
  if (config.verifiedUsersPercent < 0 || config.verifiedUsersPercent > 100) {
    errors.push('verifiedUsersPercent must be between 0 and 100');
  }
  
  if (config.totalUsers > 10000) {
    console.warn('⚠️ totalUsers > 10000 may cause performance issues');
  }
  
  if (config.totalPosts > 50000) {
    console.warn('⚠️ totalPosts > 50000 may cause performance issues');
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration errors:', errors);
    return false;
  }
  
  return true;
}

/**
 * Affiche la configuration actuelle dans la console
 * @param {object} config - Configuration à afficher
 */
export function logConfig(config = MOCK_CONFIG) {
  console.group('⚙️  Configuration Actuelle');
  console.log('Enabled:', config.enabled);
  console.log('Initial posts:', config.initialCount);
  console.log('Total posts:', config.totalPosts);
  console.log('Total users:', config.totalUsers);
  console.log('Mix with real posts:', config.mixWithRealPosts);
  console.log('Auto-disable at:', config.autoDisableThreshold, 'real posts');
  console.log('Lazy generation:', config.lazyGeneration?.enabled ? 'ON' : 'OFF');
  if (config.lazyGeneration?.enabled) {
    console.log('  - Delay:', config.lazyGeneration.delayMs + 'ms');
    console.log('  - Idle mode:', config.lazyGeneration.generateOnIdle);
  }
  console.groupEnd();
}

/**
 * 🆕 Vérifie si on doit générer les données complètes
 * @param {object} config - Configuration active
 * @returns {boolean}
 */
export function shouldGenerateFullDataset(config = MOCK_CONFIG) {
  if (!config.enabled) return false;
  if (!config.lazyGeneration?.enabled) return false;
  
  // Ne pas générer si le dataset est petit
  if (config.totalPosts <= 100) {
    console.log('💡 Dataset too small, skipping full generation');
    return false;
  }
  
  return true;
}

/**
 * 🆕 Calcule le délai optimal avant génération
 * @param {object} config - Configuration active
 * @returns {number} Délai en ms
 */
export function getOptimalGenerationDelay(config = MOCK_CONFIG) {
  const baseDelay = config.lazyGeneration?.delayMs || 10000;
  
  // Augmenter le délai si beaucoup de données à générer
  const datasetSize = config.totalUsers + config.totalPosts;
  if (datasetSize > 5000) return baseDelay + 5000;
  if (datasetSize > 2000) return baseDelay + 2000;
  
  return baseDelay;
}

// Export par défaut de la config
export default MOCK_CONFIG;

// 🔥 Auto-détection et validation au chargement
if (DEV_CONFIG.enableLogs) {
  const detectedConfig = autoDetectPreset(0); // Vous pouvez passer le vrai count
  if (validateConfig(detectedConfig)) {
    logConfig(detectedConfig);
  }
}