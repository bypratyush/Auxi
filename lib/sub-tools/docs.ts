import type { SubToolModule } from './index';

export const docsModule: SubToolModule = {
  type: 'docs',
  label: 'Documentation',
  parameters: [
    'search quality',
    'information architecture',
    'code-sample clarity',
    'navigation depth',
    'findability',
    'onboarding path',
  ],
  researchSources: ['writethedocs.org', 'nngroup.com'],
  systemPrompt: `You are auditing a Documentation site. Prioritize Write the Docs IA & search guidelines and NNGroup findability research.`,
  discoveryPlan: {
    roles: [
      {
        role: 'getting-started',
        label: 'Getting Started',
        priority: 1,
        pathPatterns: [
          /\/(getting-started|get-started|quic?kstart|start|introduction|intro|setup|installation|install)(\/|$)/i,
        ],
        maxCount: 1,
      },
      {
        role: 'reference',
        label: 'Reference Page',
        priority: 2,
        pathPatterns: [/\/(api|reference|docs?|guides?|tutorials?|sdk)\/[^/]+/i],
        pathExcludes: [/\/(getting-started|get-started|quickstart)/i],
        maxCount: 1,
      },
      {
        role: 'search',
        label: 'Search / Index',
        priority: 3,
        pathPatterns: [/\/(search|index|all|sitemap|overview)(\/|$)/i],
        maxCount: 1,
      },
    ],
  },
};
