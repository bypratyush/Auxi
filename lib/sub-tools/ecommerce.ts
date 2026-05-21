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
  discoveryPlan: {
    roles: [
      {
        role: 'plp',
        label: 'Product Listing',
        priority: 1,
        pathPatterns: [/\/(products?|shop|store|collections?|catalog|category|categories)(\/|$)/i],
        pathExcludes: [/\/(reviews?|ratings?|account|wishlist)/i],
        maxCount: 1,
      },
      {
        role: 'pdp',
        label: 'Product Detail',
        priority: 2,
        pathPatterns: [/\/(product|p|item|sku)\/[^\/]+/i, /\/products?\/[^\/]+\/[^\/]+/i],
        pathExcludes: [/\/(category|categories|reviews|compare)\//i],
        maxCount: 1,
      },
      {
        role: 'cart',
        label: 'Cart',
        priority: 3,
        pathPatterns: [/\/(cart|basket|bag)(\/|$)/i],
        maxCount: 1,
      },
      {
        role: 'checkout',
        label: 'Checkout',
        priority: 4,
        pathPatterns: [/\/(checkout|payment|order|purchase)(\/|$)/i],
        pathExcludes: [/\/(order-history|orders\/[a-z0-9-]+)$/i],
        maxCount: 1,
      },
    ],
  },
};
