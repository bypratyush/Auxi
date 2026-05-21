import type { SubToolModule } from './index';

export const blogModule: SubToolModule = {
  type: 'blog',
  label: 'Blog / Content',
  parameters: [
    'scannability',
    'typography & readability',
    'information scent',
    'related-content surfacing',
    'reading flow',
    'subscribe friction',
  ],
  researchSources: ['nngroup.com', 'smashingmagazine.com'],
  systemPrompt: `You are auditing a Blog / Content website. Prioritize NNGroup eye-tracking & scannability research and Smashing Magazine typography findings.`,
  discoveryPlan: {
    roles: [
      {
        role: 'article',
        label: 'Article',
        priority: 1,
        pathPatterns: [/\/(post|article|blog|story|read|essay)\/[^\/]+/i, /\/\d{4}\/\d{2}\/[^\/]+/i],
        pathExcludes: [/\/(category|tag|author)\//i],
        maxCount: 1,
      },
      {
        role: 'category',
        label: 'Category / Tag',
        priority: 2,
        pathPatterns: [/\/(category|categories|tag|tags|topics?)(\/|$)/i],
        maxCount: 1,
      },
      {
        role: 'about',
        label: 'About / Author',
        priority: 3,
        pathPatterns: [/\/(about|author|bio|team)(\/|$)/i],
        maxCount: 1,
      },
    ],
  },
};
