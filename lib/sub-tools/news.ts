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
};
