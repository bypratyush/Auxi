import type { SubToolModule } from './index';

export const nonprofitModule: SubToolModule = {
  type: 'nonprofit',
  label: 'Non-profit / Charity',
  parameters: [
    'trust signals',
    'donation flow',
    'emotional clarity',
    'mission framing',
    'impact storytelling',
    'CTA-to-donate friction',
  ],
  researchSources: ['stanford.edu', 'nngroup.com', 'classy.org'],
  systemPrompt: `You are auditing a Non-profit / Charity website. Prioritize the Stanford Web Credibility Project, NNGroup trust-signal research, and Classy donation-flow findings.`,
  discoveryPlan: {
    roles: [
      {
        role: 'donate',
        label: 'Donate',
        priority: 1,
        pathPatterns: [/\/(donate|give|giving|support|contribute|gift|fund)(\/|$)/i],
        maxCount: 1,
      },
      {
        role: 'about',
        label: 'About / Mission',
        priority: 2,
        pathPatterns: [/\/(about|mission|who-we-are|our-story|vision)(\/|$)/i],
        maxCount: 1,
      },
      {
        role: 'impact',
        label: 'Impact / Programs',
        priority: 3,
        pathPatterns: [/\/(impact|programs?|work|projects?|causes?|results?|what-we-do)(\/|$)/i],
        maxCount: 1,
      },
    ],
  },
};
