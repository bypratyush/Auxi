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
};
