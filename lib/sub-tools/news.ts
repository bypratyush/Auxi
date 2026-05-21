import type { SubToolModule } from './index';

export const newsModule: SubToolModule = {
  type: 'news',
  label: 'News / Media',
  parameters: [
    'headline scannability',
    'article density',
    'ad intrusion',
    'subscription friction',
    'content discovery',
    'mobile reading',
  ],
  researchSources: ['nngroup.com', 'niemanlab.org'],
  systemPrompt: `You are auditing a News / Media website. Prioritize NNGroup news-reading studies and Nieman Lab research on digital news UX.`,
  discoveryPlan: {
    roles: [
      {
        role: 'article',
        label: 'Article',
        priority: 1,
        pathPatterns: [
          /\/(article|story|news|post)\/[^/]+/i,
          /\/\d{4}\/\d{2}\/[^/]+/i,
        ],
        pathExcludes: [/\/(category|tag|topic|author|section)\//i],
        maxCount: 1,
      },
      {
        role: 'section',
        label: 'Section',
        priority: 2,
        pathPatterns: [
          /\/(politics|business|tech(nology)?|sports?|world|opinion|culture|science|health|entertainment)(\/|$)/i,
          /\/(section|category|topic)\/[^/]+/i,
        ],
        maxCount: 1,
      },
      {
        role: 'subscribe',
        label: 'Subscribe',
        priority: 3,
        pathPatterns: [/\/(subscribe|subscriptions?|membership|join|plans?)(\/|$)/i],
        maxCount: 1,
      },
    ],
  },
};
