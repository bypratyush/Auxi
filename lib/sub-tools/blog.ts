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
};
