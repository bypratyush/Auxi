import type { SubToolModule } from './index';

export const saasModule: SubToolModule = {
  type: 'saas',
  label: 'SaaS',
  parameters: [
    'onboarding',
    'empty states',
    'feature discoverability',
    'pricing page clarity',
    'activation funnel',
    'dashboard information architecture',
  ],
  researchSources: ['nngroup.com', 'growth.design', 'reforge.com'],
  systemPrompt: `You are auditing a SaaS website. Prioritize onboarding/activation research from Reforge and Growth.Design, and NNGroup studies on dashboard IA and empty states.`,
};
