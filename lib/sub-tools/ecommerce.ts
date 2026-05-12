import type { SubToolModule } from './index';

export const ecommerceModule: SubToolModule = {
  type: 'ecommerce',
  label: 'E-commerce',
  parameters: [
    'checkout flow',
    'product page clarity',
    'trust signals',
    'cart friction',
    'search & filter',
    'mobile purchase flow',
  ],
  researchSources: ['baymard.com', 'nngroup.com', 'cxl.com'],
  systemPrompt: `You are auditing an E-commerce website. Prioritize Baymard checkout & cart research, NNGroup product-page studies, and CXL conversion findings. Ground every finding in observable evidence from the scraped DOM and screenshot.`,
};
