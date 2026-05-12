export type WebsiteType =
  | 'ecommerce'
  | 'saas'
  | 'landing'
  | 'blog'
  | 'portfolio'
  | 'docs'
  | 'nonprofit'
  | 'news';

export type Technicality = 'technical' | 'non_technical' | 'mixed';

export type AuditStatus =
  | 'queued'
  | 'scraping'
  | 'screenshotting'
  | 'a11y_scanning'
  | 'researching'
  | 'analyzing'
  | 'complete'
  | 'failed';

export interface AuditInput {
  url: string;
  websiteType: WebsiteType;
  targetAudience: string;
  technicality: Technicality;
}

export interface AuditFinding {
  parameter: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  observation: string;
  research: { claim: string; source: string }[];
  recommendation: string;
}

export interface AuditReport {
  summary: string;
  score: number;
  findings: AuditFinding[];
  generatedAt: string;
}
