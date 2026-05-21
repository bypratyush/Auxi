import type { WebsiteType } from '../audit/types';
import type { DiscoveryPlan } from '../audit/page-discovery';
import { ecommerceModule } from './ecommerce';
import { saasModule } from './saas';
import { landingModule } from './landing';
import { blogModule } from './blog';
import { portfolioModule } from './portfolio';
import { docsModule } from './docs';
import { nonprofitModule } from './nonprofit';
import { newsModule } from './news';

export interface SubToolModule {
  type: WebsiteType;
  label: string;
  // Parameters this audit specializes in (e.g. checkout flow, trust signals).
  parameters: string[];
  // Research-source domains that Tavily should prioritize for this type.
  researchSources: string[];
  // The specialist system prompt fragment appended to the base audit prompt.
  systemPrompt: string;
  // Which pages we scrape beyond the homepage and how to recognize them.
  discoveryPlan: DiscoveryPlan;
}

export const subTools: Record<WebsiteType, SubToolModule> = {
  ecommerce: ecommerceModule,
  saas: saasModule,
  landing: landingModule,
  blog: blogModule,
  portfolio: portfolioModule,
  docs: docsModule,
  nonprofit: nonprofitModule,
  news: newsModule,
};
