import type { SubToolModule } from './index';

export const landingModule: SubToolModule = {
  type: 'landing',
  label: 'Landing Page',
  parameters: [
    'hero clarity',
    'value proposition',
    'CTA hierarchy',
    'social proof',
    'scannability',
    'conversion friction',
  ],
  researchSources: ['cxl.com', 'nngroup.com', 'growth.design'],
  systemPrompt: `You are auditing a Landing Page. Prioritize CXL conversion research, NNGroup scannability/F-pattern studies, and Growth.Design teardowns.`,
  discoveryPlan: {
    // Landing pages are single-purpose by design; only the submitted URL matters.
    roles: [],
  },
};
