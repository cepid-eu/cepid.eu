/**
 * Job Family Classifier
 * Categorizes job offers into families based on title/description
 */

const JobClassifier = {
  // Job families with their classification patterns
  families: [
    {
      name: 'Professeur Documentaliste',
      icon: '🎓',
      color: '#8b5cf6',
      description: 'Enseignement et formation en documentation'
    },
    {
      name: 'Archiviste',
      icon: '📚',
      color: '#06b6d4',
      description: 'Gestion et conservation des archives'
    },
    {
      name: 'Record Manager',
      icon: '🗃️',
      color: '#84cc16',
      description: 'Gestion des documents d\'activité'
    },
    {
      name: 'Knowledge Manager',
      icon: '💡',
      color: '#f59e0b',
      description: 'Gestion des connaissances en entreprise'
    },
    {
      name: 'Document Controller',
      icon: '✅',
      color: '#10b981',
      description: 'Contrôle et suivi documentaire projet'
    },
    {
      name: 'Veille',
      icon: '🔍',
      color: '#ec4899',
      description: 'Veille stratégique et intelligence économique'
    },
    {
      name: 'Médiathécaire/Bibliothécaire',
      icon: '📖',
      color: '#6366f1',
      description: 'Animation de médiathèques et bibliothèques'
    },
    {
      name: 'Directeur/Directrice',
      icon: '👔',
      color: '#1e40af',
      description: 'Direction de services documentaires'
    },
    {
      name: 'Responsable',
      icon: '📋',
      color: '#0891b2',
      description: 'Responsabilité d\'équipe ou de projet'
    },
    {
      name: 'Gestionnaire',
      icon: '🗄️',
      color: '#65a30d',
      description: 'Gestion de bases de données et fonds documentaires'
    },
    {
      name: 'Assistant(e)',
      icon: '🤝',
      color: '#f97316',
      description: 'Assistance documentaire et administrative'
    },
    {
      name: 'Documentaliste',
      icon: '📄',
      color: '#2563eb',
      description: 'Documentation généraliste'
    }
  ],

  /**
   * Get family info by name
   * @param {string} name - Family name
   * @returns {object} Family info
   */
  getFamily(name) {
    return this.families.find(f => f.name === name) || this.families[this.families.length - 1];
  },

  /**
   * Get all family names
   * @returns {string[]} Array of family names
   */
  getAllFamilyNames() {
    return this.families.map(f => f.name);
  },

  /**
   * Get color for a family
   * @param {string} name - Family name
   * @returns {string} Hex color code
   */
  getColor(name) {
    const family = this.getFamily(name);
    return family ? family.color : '#64748b';
  },

  /**
   * Get icon for a family
   * @param {string} name - Family name
   * @returns {string} Emoji icon
   */
  getIcon(name) {
    const family = this.getFamily(name);
    return family ? family.icon : '📄';
  },

  /**
   * Generate a color palette for charts
   * @returns {string[]} Array of colors
   */
  getColorPalette() {
    return this.families.map(f => f.color);
  }
};

// Export for use in other modules
window.JobClassifier = JobClassifier;
