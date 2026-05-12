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
};
