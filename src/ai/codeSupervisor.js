// src/ai/codeSupervisor.js - VERSION CORRIGÉE
import axios from 'axios';

/**
 * 🔥 AMÉLIORATIONS:
 * - Gestion d'erreur robuste
 * - Application des auto-fixes avec confirmation
 * - Interface de debug enrichie
 * - Logs formatés et colorés
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class CodeSupervisor {
  constructor() {
    this.lastReport = null;
    this.autoFixEnabled = false;
    this.analysisInterval = null;
  }

  /**
   * Lance une analyse complète du projet
   */
  async analyze() {
    console.log('🧠 CodeSupervisor: Analyse en cours...');
    
    try {
      const response = await axios.get(`${API_BASE}/api/ai/analyze`, {
        timeout: 30000 // 30 secondes max
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Analyse échouée');
      }

      this.lastReport = response.data.report;
      this.displayReport(this.lastReport);
      
      // 🔥 NOUVEAU: Proposer auto-fix si disponible
      if (this.lastReport.autoFixes && this.lastReport.autoFixes.length > 0) {
        this.promptAutoFix();
      }

      return this.lastReport;
    } catch (error) {
      console.error('❌ CodeSupervisor: Erreur d\'analyse', error.message);
      
      // Gérer les erreurs spécifiques
      if (error.code === 'ECONNREFUSED') {
        console.error('🔴 Backend introuvable. Vérifier que le serveur tourne sur', API_BASE);
      } else if (error.response?.status === 403) {
        console.error('🔒 Analyse désactivée en production');
      }
      
      return null;
    }
  }

  /**
   * Affiche le rapport de manière formatée
   */
  displayReport(report) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 Rapport d\'analyse');
    console.log('='.repeat(80));
    
    // Summary
    console.log('\n📋 RÉSUMÉ:');
    report.summary.forEach(line => console.log(`   ${line}`));

    // Findings par sévérité
    if (report.findings.length > 0) {
      const high = report.findings.filter(f => f.severity === 'high');
      const medium = report.findings.filter(f => f.severity === 'medium');
      const low = report.findings.filter(f => f.severity === 'low');

      if (high.length > 0) {
        console.log('\n🔴 Sévérité HAUTE (' + high.length + ')');
        high.forEach(f => this.displayFinding(f));
      }

      if (medium.length > 0) {
        console.log('\n🟡 Sévérité MOYENNE (' + medium.length + ')');
        medium.forEach(f => this.displayFinding(f));
      }

      if (low.length > 0) {
        console.log('\n🟢 Sévérité BASSE (' + low.length + ')');
        low.forEach(f => this.displayFinding(f));
      }
    } else {
      console.log('\n✅ Aucun problème détecté!');
    }

    // Auto-fixes disponibles
    if (report.autoFixes && report.autoFixes.length > 0) {
      console.log('\n🔧 CORRECTIONS AUTOMATIQUES DISPONIBLES:');
      report.autoFixes.forEach((fix, i) => {
        console.log(`   ${i + 1}. ${fix.file} - ${fix.reason}`);
      });
      console.log('\n💡 Tape window.__APP_DEBUG__.applyFixes() pour appliquer');
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }

  /**
   * Affiche un finding individuel
   */
  displayFinding(finding) {
    console.log(`   📁 ${finding.file}`);
    console.log(`      ${finding.issue}`);
    if (finding.suggestion) {
      console.log(`      💡 ${finding.suggestion}`);
    }
  }

  /**
   * Propose d'appliquer les auto-fixes
   */
  promptAutoFix() {
    if (!this.autoFixEnabled) {
      console.log('\n⚠️ Auto-fix désactivé par défaut pour éviter les modifications accidentelles');
      console.log('💡 Pour activer: window.__APP_DEBUG__.enableAutoFix()');
      console.log('💡 Pour appliquer manuellement: window.__APP_DEBUG__.applyFixes()');
    } else {
      console.log('\n✅ Auto-fix activé! Application automatique dans 5s...');
      setTimeout(() => this.applyFixes(), 5000);
    }
  }

  /**
   * 🔥 NOUVEAU: Applique les corrections automatiques
   */
  async applyFixes(specific = null) {
    if (!this.lastReport || !this.lastReport.autoFixes) {
      console.warn('⚠️ Aucun auto-fix disponible. Lance une analyse d\'abord.');
      return;
    }

    const fixes = specific 
      ? this.lastReport.autoFixes.filter((_, i) => specific.includes(i))
      : this.lastReport.autoFixes;

    if (fixes.length === 0) {
      console.warn('⚠️ Aucun fix sélectionné');
      return;
    }

    console.log(`\n🔧 Application de ${fixes.length} correction(s)...`);
    
    const results = {
      success: [],
      failed: []
    };

    for (const fix of fixes) {
      try {
        const response = await axios.post(`${API_BASE}/api/ai/apply`, {
          file: fix.file,
          patch: fix.patch
        }, {
          timeout: 10000
        });

        if (response.data.ok) {
          console.log(`   ✅ ${fix.file} - ${fix.reason}`);
          results.success.push(fix.file);
        } else {
          throw new Error(response.data.error);
        }
      } catch (error) {
        console.error(`   ❌ ${fix.file} - ${error.message}`);
        results.failed.push({ file: fix.file, error: error.message });
      }
    }

    // Résumé
    console.log(`\n📊 Résultat: ${results.success.length} OK, ${results.failed.length} KO`);
    
    if (results.success.length > 0) {
      console.log('✅ Fichiers modifiés avec succès:');
      results.success.forEach(f => console.log(`   - ${f}`));
    }
    
    if (results.failed.length > 0) {
      console.log('❌ Échecs:');
      results.failed.forEach(f => console.log(`   - ${f.file}: ${f.error}`));
    }

    return results;
  }

  /**
   * Active l'auto-fix automatique
   */
  enableAutoFix() {
    this.autoFixEnabled = true;
    console.log('✅ Auto-fix ACTIVÉ - Les corrections seront appliquées automatiquement');
    console.log('⚠️ ATTENTION: Les fichiers seront modifiés sans confirmation!');
  }

  /**
   * Désactive l'auto-fix
   */
  disableAutoFix() {
    this.autoFixEnabled = false;
    console.log('🔒 Auto-fix DÉSACTIVÉ - Appliquer manuellement avec applyFixes()');
  }

  /**
   * Lance une analyse périodique
   */
  startAutoAnalysis(intervalMinutes = 10) {
    if (this.analysisInterval) {
      console.warn('⚠️ Analyse périodique déjà active');
      return;
    }

    console.log(`🔄 Analyse périodique activée (tous les ${intervalMinutes} min)`);
    
    // Première analyse immédiate
    this.analyze();
    
    // Puis périodique
    this.analysisInterval = setInterval(() => {
      console.log('🔄 Analyse périodique...');
      this.analyze();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Arrête l'analyse périodique
   */
  stopAutoAnalysis() {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
      console.log('⏹️ Analyse périodique arrêtée');
    }
  }

  /**
   * Informations système
   */
  systemInfo() {
    console.log('\n' + '='.repeat(80));
    console.log('🧠 CODE SUPERVISOR - Informations système');
    console.log('='.repeat(80));
    console.log(`📡 API Backend: ${API_BASE}`);
    console.log(`🔧 Auto-fix: ${this.autoFixEnabled ? '✅ Activé' : '🔒 Désactivé'}`);
    console.log(`🔄 Analyse auto: ${this.analysisInterval ? '✅ Active' : '⏹️ Inactive'}`);
    console.log(`📊 Dernier rapport: ${this.lastReport ? '✅ Disponible' : '⚠️ Aucun'}`);
    
    if (this.lastReport) {
      console.log(`   - Fichiers scannés: ${this.lastReport.summary[1]}`);
      console.log(`   - Problèmes: ${this.lastReport.findings.length}`);
      console.log(`   - Auto-fixes: ${this.lastReport.autoFixes.length}`);
    }
    
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Exporte le rapport en JSON
   */
  exportReport() {
    if (!this.lastReport) {
      console.warn('⚠️ Aucun rapport à exporter');
      return;
    }

    const json = JSON.stringify(this.lastReport, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('✅ Rapport exporté');
  }
}

// Instance globale
const supervisor = new CodeSupervisor();

// 🔥 Exposer les commandes dans la console
window.__APP_DEBUG__ = {
  // Analyse
  runAnalysis: () => supervisor.analyze(),
  
  // Auto-fix
  applyFixes: (specific) => supervisor.applyFixes(specific),
  enableAutoFix: () => supervisor.enableAutoFix(),
  disableAutoFix: () => supervisor.disableAutoFix(),
  
  // Périodique
  startAutoAnalysis: (minutes) => supervisor.startAutoAnalysis(minutes),
  stopAutoAnalysis: () => supervisor.stopAutoAnalysis(),
  
  // Utils
  systemInfo: () => supervisor.systemInfo(),
  exportReport: () => supervisor.exportReport(),
  getReport: () => supervisor.lastReport,
  
  // Aide
  help: () => {
    console.log('\n🧠 CODE SUPERVISOR - Commandes disponibles:');
    console.log('   window.__APP_DEBUG__.runAnalysis()        - Lance une analyse');
    console.log('   window.__APP_DEBUG__.applyFixes([0,1])    - Applique les fixes');
    console.log('   window.__APP_DEBUG__.enableAutoFix()      - Active auto-correction');
    console.log('   window.__APP_DEBUG__.disableAutoFix()     - Désactive auto-correction');
    console.log('   window.__APP_DEBUG__.startAutoAnalysis(10) - Analyse tous les X min');
    console.log('   window.__APP_DEBUG__.stopAutoAnalysis()   - Arrête analyse périodique');
    console.log('   window.__APP_DEBUG__.systemInfo()         - Infos système');
    console.log('   window.__APP_DEBUG__.exportReport()       - Exporte rapport JSON');
    console.log('   window.__APP_DEBUG__.getReport()          - Récupère dernier rapport\n');
  }
};

console.log('💡 Debug Tools Available');
console.log('   Type: window.__APP_DEBUG__.help()');

// 🔥 Fonction wrapper pour intégration dans main.jsx
export async function runCodeSupervisor(options = {}) {
  const { force = false, autoFix = false } = options;
  
  // Activer auto-fix si demandé
  if (autoFix) {
    supervisor.enableAutoFix();
  }
  
  // Lancer l'analyse
  return await supervisor.analyze();
}

// 🔥 Analyse initiale (NON automatique pour éviter spam)
console.log('💡 Lance ta première analyse: window.__APP_DEBUG__.runAnalysis()');

export default supervisor;