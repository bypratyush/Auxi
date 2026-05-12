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
};
