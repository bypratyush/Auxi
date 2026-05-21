import type { SubToolModule } from './index';

export const portfolioModule: SubToolModule = {
  type: 'portfolio',
  label: 'Portfolio',
  parameters: [
    'work-sample hierarchy',
    'case-study clarity',
    'contact path',
    'visual hierarchy',
    'personal brand coherence',
  ],
  researchSources: ['nngroup.com', 'smashingmagazine.com'],
  systemPrompt: `You are auditing a Portfolio website. Prioritize NNGroup work-sample hierarchy research and Smashing Magazine case-study presentation studies.`,
  discoveryPlan: {
    roles: [
      {
        role: 'case-study',
        label: 'Case Study / Project',
        priority: 1,
        pathPatterns: [/\/(work|projects?|case-stud(y|ies)|portfolio|selected)(\/|$)[^/]*/i],
        pathExcludes: [/\/(category|tag)/i],
        maxCount: 1,
      },
      {
        role: 'experience',
        label: 'Experience / Resume',
        priority: 2,
        pathPatterns: [/\/(experience|resume|cv|career|history|background)(\/|$)/i],
        maxCount: 1,
      },
      {
        role: 'about',
        label: 'About / Bio',
        priority: 3,
        pathPatterns: [/\/(about|bio|story|info)(\/|$)/i],
        maxCount: 1,
      },
      {
        role: 'contact',
        label: 'Contact',
        priority: 4,
        pathPatterns: [/\/(contact|hire|hello|reach|get-in-touch)(\/|$)/i],
        maxCount: 1,
      },
    ],
  },
};
