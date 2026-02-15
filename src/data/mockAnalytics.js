// ============================================
// 📁 src/utils/mockAnalytics.js
// Système d'analytics pour les posts fictifs
// Track l'engagement et l'utilisation
// ============================================

/**
 * 📊 ANALYTICS POUR POSTS FICTIFS
 * Permet de tracker comment les utilisateurs interagissent
 * avec les posts de démonstration
 */

class MockAnalytics {
  constructor() {
    this.sessionData = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      events: [],
      interactions: {
        views: 0,
        clicks: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      },
      mockPosts: {
        viewed: new Set(),
        clicked: new Set(),
        liked: new Set(),
      },
      performance: {
        loadTime: 0,
        renderTime: 0,
      },
    };
    
    this.enabled = true;
    this.autoSave = true;
    this.saveInterval = 30000; // Sauvegarder toutes les 30s
    
    if (this.autoSave) {
      this.startAutoSave();
    }
  }

  // ============================================
  // GÉNÉRATION D'ID
  // ============================================
  
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================
  // TRACKING DES ÉVÉNEMENTS
  // ============================================
  
  /**
   * Track une vue de post fictif
   * @param {string} postId - ID du post
   * @param {object} metadata - Données additionnelles
   */
  trackView(postId, metadata = {}) {
    if (!this.enabled || !postId.startsWith('post_')) return;
    
    this.sessionData.mockPosts.viewed.add(postId);
    this.sessionData.interactions.views++;
    
    this.logEvent('view', {
      postId,
      timestamp: Date.now(),
      ...metadata,
    });
  }

  /**
   * Track un clic sur un post fictif
   * @param {string} postId - ID du post
   * @param {string} action - Type de clic (image, profile, content, etc.)
   */
  trackClick(postId, action = 'content') {
    if (!this.enabled || !postId.startsWith('post_')) return;
    
    this.sessionData.mockPosts.clicked.add(postId);
    this.sessionData.interactions.clicks++;
    
    this.logEvent('click', {
      postId,
      action,
      timestamp: Date.now(),
    });
  }

  /**
   * Track un like sur un post fictif
   * @param {string} postId - ID du post
   * @param {boolean} isLiked - true si ajout, false si retrait
   */
  trackLike(postId, isLiked = true) {
    if (!this.enabled || !postId.startsWith('post_')) return;
    
    if (isLiked) {
      this.sessionData.mockPosts.liked.add(postId);
      this.sessionData.interactions.likes++;
    } else {
      this.sessionData.mockPosts.liked.delete(postId);
      this.sessionData.interactions.likes = Math.max(0, this.sessionData.interactions.likes - 1);
    }
    
    this.logEvent('like', {
      postId,
      isLiked,
      timestamp: Date.now(),
    });
  }

  /**
   * Track un commentaire sur un post fictif
   * @param {string} postId - ID du post
   * @param {number} commentLength - Longueur du commentaire
   */
  trackComment(postId, commentLength = 0) {
    if (!this.enabled || !postId.startsWith('post_')) return;
    
    this.sessionData.interactions.comments++;
    
    this.logEvent('comment', {
      postId,
      commentLength,
      timestamp: Date.now(),
    });
  }

  /**
   * Track un partage de post fictif
   * @param {string} postId - ID du post
   * @param {string} method - Méthode de partage (whatsapp, copy, etc.)
   */
  trackShare(postId, method = 'unknown') {
    if (!this.enabled || !postId.startsWith('post_')) return;
    
    this.sessionData.interactions.shares++;
    
    this.logEvent('share', {
      postId,
      method,
      timestamp: Date.now(),
    });
  }

  /**
   * Track le scroll
   * @param {number} scrollDepth - Profondeur de scroll (%)
   * @param {number} postsVisible - Nombre de posts visibles
   */
  trackScroll(scrollDepth, postsVisible) {
    if (!this.enabled) return;
    
    this.logEvent('scroll', {
      scrollDepth,
      postsVisible,
      timestamp: Date.now(),
    });
  }

  /**
   * Track les performances de chargement
   * @param {number} loadTime - Temps de chargement (ms)
   * @param {number} renderTime - Temps de rendu (ms)
   */
  trackPerformance(loadTime, renderTime) {
    if (!this.enabled) return;
    
    this.sessionData.performance.loadTime = loadTime;
    this.sessionData.performance.renderTime = renderTime;
    
    this.logEvent('performance', {
      loadTime,
      renderTime,
      timestamp: Date.now(),
    });
  }

  // ============================================
  // GESTION DES ÉVÉNEMENTS
  // ============================================
  
  logEvent(type, data) {
    this.sessionData.events.push({
      type,
      data,
      timestamp: Date.now(),
    });
    
    // Limite à 1000 événements pour éviter les fuites mémoire
    if (this.sessionData.events.length > 1000) {
      this.sessionData.events = this.sessionData.events.slice(-1000);
    }
  }

  // ============================================
  // STATISTIQUES ET RAPPORTS
  // ============================================
  
  /**
   * Obtenir les statistiques de la session
   * @returns {object} Statistiques
   */
  getStats() {
    const duration = Date.now() - this.sessionData.startTime;
    
    return {
      session: {
        id: this.sessionData.sessionId,
        duration: duration,
        durationMinutes: Math.floor(duration / 60000),
      },
      interactions: {
        ...this.sessionData.interactions,
        uniquePostsViewed: this.sessionData.mockPosts.viewed.size,
        uniquePostsClicked: this.sessionData.mockPosts.clicked.size,
        uniquePostsLiked: this.sessionData.mockPosts.liked.size,
      },
      engagement: {
        clickThroughRate: this.calculateCTR(),
        likeRate: this.calculateLikeRate(),
        averageTimePerPost: this.calculateAverageTimePerPost(),
      },
      performance: this.sessionData.performance,
      totalEvents: this.sessionData.events.length,
    };
  }

  /**
   * Calculer le taux de clic (CTR)
   * @returns {number} CTR en pourcentage
   */
  calculateCTR() {
    const { views, clicks } = this.sessionData.interactions;
    return views > 0 ? ((clicks / views) * 100).toFixed(2) : 0;
  }

  /**
   * Calculer le taux de like
   * @returns {number} Like rate en pourcentage
   */
  calculateLikeRate() {
    const { views, likes } = this.sessionData.interactions;
    return views > 0 ? ((likes / views) * 100).toFixed(2) : 0;
  }

  /**
   * Calculer le temps moyen par post
   * @returns {number} Temps en secondes
   */
  calculateAverageTimePerPost() {
    const duration = Date.now() - this.sessionData.startTime;
    const postsViewed = this.sessionData.mockPosts.viewed.size;
    
    return postsViewed > 0 
      ? Math.floor((duration / 1000) / postsViewed)
      : 0;
  }

  /**
   * Obtenir un rapport détaillé
   * @returns {object} Rapport complet
   */
  getReport() {
    const stats = this.getStats();
    
    return {
      ...stats,
      timeline: this.getEventTimeline(),
      topPosts: this.getTopPosts(),
      recommendations: this.generateRecommendations(stats),
    };
  }

  /**
   * Obtenir la timeline des événements
   * @returns {Array} Liste d'événements groupés par type
   */
  getEventTimeline() {
    const timeline = {};
    
    this.sessionData.events.forEach(event => {
      if (!timeline[event.type]) {
        timeline[event.type] = [];
      }
      timeline[event.type].push(event);
    });
    
    return timeline;
  }

  /**
   * Obtenir les posts les plus engageants
   * @returns {Array} Top posts
   */
  getTopPosts() {
    const postEngagement = {};
    
    this.sessionData.events.forEach(event => {
      const postId = event.data.postId;
      if (!postId) return;
      
      if (!postEngagement[postId]) {
        postEngagement[postId] = {
          postId,
          views: 0,
          clicks: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          score: 0,
        };
      }
      
      switch (event.type) {
        case 'view':
          postEngagement[postId].views++;
          postEngagement[postId].score += 1;
          break;
        case 'click':
          postEngagement[postId].clicks++;
          postEngagement[postId].score += 2;
          break;
        case 'like':
          postEngagement[postId].likes++;
          postEngagement[postId].score += 3;
          break;
        case 'comment':
          postEngagement[postId].comments++;
          postEngagement[postId].score += 5;
          break;
        case 'share':
          postEngagement[postId].shares++;
          postEngagement[postId].score += 10;
          break;
      }
    });
    
    return Object.values(postEngagement)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  /**
   * Générer des recommandations basées sur les stats
   * @param {object} stats - Statistiques
   * @returns {Array} Liste de recommandations
   */
  generateRecommendations(stats) {
    const recommendations = [];
    
    // CTR faible
    if (stats.engagement.clickThroughRate < 10) {
      recommendations.push({
        type: 'warning',
        message: 'Taux de clic faible. Considérez des posts plus visuels.',
        metric: 'CTR',
        value: stats.engagement.clickThroughRate,
      });
    }
    
    // Peu de likes
    if (stats.engagement.likeRate < 5) {
      recommendations.push({
        type: 'info',
        message: 'Taux de like faible. Le contenu pourrait être plus engageant.',
        metric: 'Like Rate',
        value: stats.engagement.likeRate,
      });
    }
    
    // Beaucoup de vues
    if (stats.interactions.uniquePostsViewed > 50) {
      recommendations.push({
        type: 'success',
        message: 'Excellent engagement ! Les utilisateurs explorent le contenu.',
        metric: 'Posts vus',
        value: stats.interactions.uniquePostsViewed,
      });
    }
    
    // Session longue
    if (stats.session.durationMinutes > 10) {
      recommendations.push({
        type: 'success',
        message: 'Session longue détectée. Les utilisateurs sont engagés.',
        metric: 'Durée',
        value: `${stats.session.durationMinutes} min`,
      });
    }
    
    return recommendations;
  }

  // ============================================
  // SAUVEGARDE ET CHARGEMENT
  // ============================================
  
  /**
   * Sauvegarder les données dans localStorage
   */
  save() {
    try {
      const data = {
        ...this.sessionData,
        mockPosts: {
          viewed: Array.from(this.sessionData.mockPosts.viewed),
          clicked: Array.from(this.sessionData.mockPosts.clicked),
          liked: Array.from(this.sessionData.mockPosts.liked),
        },
      };
      
      localStorage.setItem('mockAnalytics', JSON.stringify(data));
      console.log('📊 Analytics saved');
    } catch (error) {
      console.error('❌ Error saving analytics:', error);
    }
  }

  /**
   * Charger les données depuis localStorage
   */
  load() {
    try {
      const saved = localStorage.getItem('mockAnalytics');
      if (saved) {
        const data = JSON.parse(saved);
        
        this.sessionData = {
          ...data,
          mockPosts: {
            viewed: new Set(data.mockPosts.viewed),
            clicked: new Set(data.mockPosts.clicked),
            liked: new Set(data.mockPosts.liked),
          },
        };
        
        console.log('📊 Analytics loaded');
      }
    } catch (error) {
      console.error('❌ Error loading analytics:', error);
    }
  }

  /**
   * Démarrer la sauvegarde automatique
   */
  startAutoSave() {
    this.autoSaveTimer = setInterval(() => {
      this.save();
    }, this.saveInterval);
  }

  /**
   * Arrêter la sauvegarde automatique
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
  }

  /**
   * Réinitialiser les données
   */
  reset() {
    this.sessionData = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      events: [],
      interactions: {
        views: 0,
        clicks: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      },
      mockPosts: {
        viewed: new Set(),
        clicked: new Set(),
        liked: new Set(),
      },
      performance: {
        loadTime: 0,
        renderTime: 0,
      },
    };
    
    localStorage.removeItem('mockAnalytics');
    console.log('📊 Analytics reset');
  }

  // ============================================
  // EXPORT DES DONNÉES
  // ============================================
  
  /**
   * Exporter les données au format JSON
   * @returns {string} Données JSON
   */
  exportJSON() {
    const report = this.getReport();
    return JSON.stringify(report, null, 2);
  }

  /**
   * Télécharger le rapport
   */
  downloadReport() {
    const report = this.exportJSON();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `mock-analytics-${this.sessionData.sessionId}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  /**
   * Afficher le rapport dans la console
   */
  printReport() {
    const stats = this.getStats();
    
    console.group('📊 Mock Analytics Report');
    console.log('Session ID:', stats.session.id);
    console.log('Duration:', stats.session.durationMinutes, 'minutes');
    console.log('\n--- Interactions ---');
    console.table(stats.interactions);
    console.log('\n--- Engagement ---');
    console.table(stats.engagement);
    console.log('\n--- Performance ---');
    console.table(stats.performance);
    console.groupEnd();
  }
}

// ============================================
// INSTANCE GLOBALE
// ============================================

const mockAnalytics = new MockAnalytics();

// Charger les données sauvegardées au démarrage
mockAnalytics.load();

// Sauvegarder avant de quitter
window.addEventListener('beforeunload', () => {
  mockAnalytics.save();
});

export default mockAnalytics;

// ============================================
// HELPERS D'UTILISATION
// ============================================

/**
 * Hook React pour utiliser les analytics
 */
export function useMockAnalytics() {
  return {
    trackView: (postId, metadata) => mockAnalytics.trackView(postId, metadata),
    trackClick: (postId, action) => mockAnalytics.trackClick(postId, action),
    trackLike: (postId, isLiked) => mockAnalytics.trackLike(postId, isLiked),
    trackComment: (postId, length) => mockAnalytics.trackComment(postId, length),
    trackShare: (postId, method) => mockAnalytics.trackShare(postId, method),
    getStats: () => mockAnalytics.getStats(),
    getReport: () => mockAnalytics.getReport(),
    printReport: () => mockAnalytics.printReport(),
    downloadReport: () => mockAnalytics.downloadReport(),
  };
}