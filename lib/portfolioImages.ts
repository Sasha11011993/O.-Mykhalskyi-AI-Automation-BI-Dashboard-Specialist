import type { StaticImageData } from 'next/image';
import heroAnalyticsWorkspace from '@/src/assets/images/hero_analytics_workspace_1795093921089.jpg';
import caseAiSupport from '@/src/assets/images/case_ai_support_warm_1795120788205.jpg';
import caseRetailBi from '@/src/assets/images/case_retail_bi_warm_1795120788023.jpg';
import caseB2bPipeline from '@/src/assets/images/case_b2b_pipeline_warm_1795120787177.jpg';
import caseLogisticsTower from '@/src/assets/images/case_logistics_tower_warm_1795120788574.jpg';

export const PORTFOLIO_IMAGES = {
  hero_analytics_workspace: heroAnalyticsWorkspace,
  case_ai_support: caseAiSupport,
  case_retail_bi: caseRetailBi,
  case_b2b_pipeline: caseB2bPipeline,
  case_logistics_tower: caseLogisticsTower,
} satisfies Record<string, StaticImageData>;

export type PortfolioImageKey = keyof typeof PORTFOLIO_IMAGES;
