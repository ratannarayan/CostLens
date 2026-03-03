// ============================================================
// Plan Configuration — CostLens Pricing & Feature Matrix
// ============================================================

const PLANS = {
  free: {
    id: 'free',
    name: 'Starter',
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyCredits: 0,
    freePriceChecks: 2,
    maxUsers: 1,
    features: {
      modules: true,
      templates: true,
      aiExtraction: false,
      reports: false,
      pdfExport: false,
      historyLimit: 5,
      ebookPreview: true,
      ebookFull: false,
      teamDashboard: false,
      apiAccess: false,
      sso: false
    }
  },
  pro: {
    id: 'pro',
    name: 'Professional',
    monthlyPrice: 1999,       // ₹1,999/mo
    annualPrice: 19999,       // ₹19,999/yr (save ₹3,989)
    monthlyCredits: 50,
    freePriceChecks: 0,
    maxUsers: 1,
    features: {
      modules: true,
      templates: true,
      aiExtraction: true,
      reports: true,
      pdfExport: true,
      historyLimit: -1,       // unlimited
      ebookPreview: true,
      ebookFull: true,
      teamDashboard: false,
      apiAccess: false,
      sso: false
    }
  },
  team: {
    id: 'team',
    name: 'Team',
    monthlyPrice: 4999,       // ₹4,999/mo
    annualPrice: 49999,       // ₹49,999/yr
    monthlyCredits: 50,       // per user
    freePriceChecks: 0,
    maxUsers: 5,
    features: {
      modules: true,
      templates: true,
      aiExtraction: true,
      reports: true,
      pdfExport: true,
      historyLimit: -1,
      ebookPreview: true,
      ebookFull: true,
      teamDashboard: true,
      apiAccess: false,
      sso: false
    }
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 0,          // Custom pricing
    annualPrice: 0,
    monthlyCredits: 999,
    freePriceChecks: 0,
    maxUsers: 999,
    features: {
      modules: true,
      templates: true,
      aiExtraction: true,
      reports: true,
      pdfExport: true,
      historyLimit: -1,
      ebookPreview: true,
      ebookFull: true,
      teamDashboard: true,
      apiAccess: true,
      sso: true
    }
  }
};

// Credit costs for each feature
const CREDIT_COSTS = {
  // AI Tools
  'price-check':        1,
  'contract-analyzer':  3,
  'rfq-comparator':     3,
  'negotiation-brief':  2,
  
  // Reports
  'spend':                  3,
  'price-variance':         2,
  'inventory-health':       2,
  'supplier-scorecard':     2,
  'category-opportunity':   3,
  'cost-reduction-tracker': 2,
  'savings-validation':     3,
  'supplier-risk':          2,
  
  // Module AI extraction
  'module-ai-extraction': 1,
  'should-cost-ai':       2,
  'tool-cost-ai':         2,
  
  // Smart Action emails
  'smart-email':          1,
};

function canAccess(plan, feature) {
  return PLANS[plan]?.features?.[feature] || false;
}

function getCreditCost(featureId) {
  return CREDIT_COSTS[featureId] || 0;
}

module.exports = { PLANS, CREDIT_COSTS, canAccess, getCreditCost };
