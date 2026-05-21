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
  discoveryPlan: {
    roles: [
      {
        role: 'pricing',
        label: 'Pricing',
        priority: 1,
        pathPatterns: [/\/(pricing|plans?|subscribe|cost)(\/|$)/i],
        maxCount: 1,
      },
      {
        role: 'features',
        label: 'Features / Product',
        priority: 2,
        pathPatterns: [/\/(features?|product|platform|solutions?|capabilities)(\/|$)/i],
        pathExcludes: [/\/(pricing|plans?)/i],
        maxCount: 1,
      },
      {
        role: 'signup',
        label: 'Sign-up',
        priority: 3,
        pathPatterns: [/\/(signup|sign-up|register|join|get-started|start|try)(\/|$)/i],
        maxCount: 1,
      },
      {
        role: 'docs',
        label: 'Docs / Help',
        priority: 4,
        pathPatterns: [/\/(docs?|documentation|help|guide|tutorials?|learn)(\/|$)/i],
        maxCount: 1,
      },
    ],
  },
};
