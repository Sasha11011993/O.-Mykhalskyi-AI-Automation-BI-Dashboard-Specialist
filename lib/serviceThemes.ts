import type { CaseCategory, ServiceId } from './portfolioLogic';

export interface ServiceAccentTokens {
  /** Active border & subtle surface tint for interactive cards */
  activeCard: string;
  /** Numbered index / label text */
  accentText: string;
  /** Thin top/left semantic indicator strip */
  barBg: string;
  /** Active pill / tab text inside pipeline switcher */
  tabActiveText: string;
  /** Run button tint */
  runBtn: string;
  /** SVG conduit stroke (base highlight) */
  svgStrokeBase: string;
  /** SVG conduit animated dash stroke */
  svgStrokeDash: string;
  /** SVG traveling packet fill */
  svgPacketFill: string;
  /** Primary Transform SVG box fill & stroke */
  svgPrimaryBox: string;
  svgPrimaryBoxHover: string;
  /** Secondary Transform SVG box fill & stroke */
  svgSecondaryBox: string;
  svgSecondaryBoxHover: string;
  /** Radial glow rgba string for subtle SVG stage atmosphere */
  stageGlowCss: string;
}

export const SERVICE_ACCENTS: Record<ServiceId, ServiceAccentTokens> = {
  'ai-agents': {
    activeCard:
      'bg-white dark:bg-[#181715] border-[#CC4518] dark:border-[#F97343] text-[#161513] dark:text-[#F5F3EE]',
    accentText: 'text-[#C84317] dark:text-[#FB8356]',
    barBg: 'bg-[#CC4518] dark:bg-[#F97343]',
    tabActiveText: 'text-[#C84317] dark:text-[#FB8356]',
    runBtn:
      'bg-[#CC4518]/10 dark:bg-[#F97343]/15 text-[#C84317] dark:text-[#FB8356] hover:bg-[#CC4518]/18 dark:hover:bg-[#F97343]/25',
    svgStrokeBase: 'stroke-[#CC4518]/45 dark:stroke-[#FB8356]/50',
    svgStrokeDash: 'stroke-[#CC4518] dark:stroke-[#FB8356]',
    svgPacketFill: 'fill-[#CC4518] dark:fill-[#FB8356]',
    svgPrimaryBox: 'fill-[#CC4518] dark:fill-[#C9471B] stroke-[#CC4518] dark:stroke-[#F97343]',
    svgPrimaryBoxHover: 'fill-[#B23A12] dark:fill-[#DC5324] stroke-[#FDBA74]',
    svgSecondaryBox: 'fill-[#FFF4EE] dark:fill-[#261812] stroke-[#FDBA74] dark:stroke-[#6D331B]',
    svgSecondaryBoxHover:
      'fill-[#FFEBDF] dark:fill-[#331E15] stroke-[#CC4518] dark:stroke-[#FB8356]',
    stageGlowCss: 'rgba(204, 69, 24, 0.08)',
  },
  'bi-dashboards': {
    activeCard:
      'bg-white dark:bg-[#181715] border-[#0F766E] dark:border-[#2DD4BF] text-[#161513] dark:text-[#F5F3EE]',
    accentText: 'text-[#0F766E] dark:text-[#2DD4BF]',
    barBg: 'bg-[#0F766E] dark:bg-[#2DD4BF]',
    tabActiveText: 'text-[#0F766E] dark:text-[#2DD4BF]',
    runBtn:
      'bg-[#0F766E]/10 dark:bg-[#2DD4BF]/15 text-[#0F766E] dark:text-[#2DD4BF] hover:bg-[#0F766E]/18 dark:hover:bg-[#2DD4BF]/25',
    svgStrokeBase: 'stroke-[#0F766E]/45 dark:stroke-[#2DD4BF]/50',
    svgStrokeDash: 'stroke-[#0F766E] dark:stroke-[#2DD4BF]',
    svgPacketFill: 'fill-[#0F766E] dark:fill-[#2DD4BF]',
    svgPrimaryBox: 'fill-[#0F766E] dark:fill-[#0D6B63] stroke-[#0F766E] dark:stroke-[#2DD4BF]',
    svgPrimaryBoxHover: 'fill-[#115E59] dark:fill-[#0F766E] stroke-[#5EEAD4]',
    svgSecondaryBox: 'fill-[#EFFCF9] dark:fill-[#112422] stroke-[#99F6E4] dark:stroke-[#1E4F49]',
    svgSecondaryBoxHover:
      'fill-[#DFF8F2] dark:fill-[#16302D] stroke-[#0F766E] dark:stroke-[#2DD4BF]',
    stageGlowCss: 'rgba(15, 118, 110, 0.08)',
  },
  'etl-pipelines': {
    activeCard:
      'bg-white dark:bg-[#181715] border-[#4338CA] dark:border-[#818CF8] text-[#161513] dark:text-[#F5F3EE]',
    accentText: 'text-[#4338CA] dark:text-[#818CF8]',
    barBg: 'bg-[#4338CA] dark:bg-[#818CF8]',
    tabActiveText: 'text-[#4338CA] dark:text-[#818CF8]',
    runBtn:
      'bg-[#4338CA]/10 dark:bg-[#818CF8]/15 text-[#4338CA] dark:text-[#818CF8] hover:bg-[#4338CA]/18 dark:hover:bg-[#818CF8]/25',
    svgStrokeBase: 'stroke-[#4338CA]/45 dark:stroke-[#818CF8]/50',
    svgStrokeDash: 'stroke-[#4338CA] dark:stroke-[#818CF8]',
    svgPacketFill: 'fill-[#4338CA] dark:fill-[#818CF8]',
    svgPrimaryBox: 'fill-[#4338CA] dark:fill-[#3730A3] stroke-[#4338CA] dark:stroke-[#818CF8]',
    svgPrimaryBoxHover: 'fill-[#3730A3] dark:fill-[#4338CA] stroke-[#A5B4FC]',
    svgSecondaryBox: 'fill-[#F3F4FF] dark:fill-[#191C2E] stroke-[#C7D2FE] dark:stroke-[#323866]',
    svgSecondaryBoxHover:
      'fill-[#E8EAFF] dark:fill-[#212540] stroke-[#4338CA] dark:stroke-[#818CF8]',
    stageGlowCss: 'rgba(67, 56, 202, 0.075)',
  },
  'audit-architecture': {
    activeCard:
      'bg-white dark:bg-[#181715] border-[#B45309] dark:border-[#FBBF24] text-[#161513] dark:text-[#F5F3EE]',
    accentText: 'text-[#B45309] dark:text-[#FBBF24]',
    barBg: 'bg-[#B45309] dark:bg-[#FBBF24]',
    tabActiveText: 'text-[#B45309] dark:text-[#FBBF24]',
    runBtn:
      'bg-[#B45309]/10 dark:bg-[#FBBF24]/15 text-[#B45309] dark:text-[#FBBF24] hover:bg-[#B45309]/18 dark:hover:bg-[#FBBF24]/25',
    svgStrokeBase: 'stroke-[#B45309]/45 dark:stroke-[#FBBF24]/50',
    svgStrokeDash: 'stroke-[#B45309] dark:stroke-[#FBBF24]',
    svgPacketFill: 'fill-[#B45309] dark:fill-[#FBBF24]',
    svgPrimaryBox: 'fill-[#B45309] dark:fill-[#92400E] stroke-[#B45309] dark:stroke-[#FBBF24]',
    svgPrimaryBoxHover: 'fill-[#92400E] dark:fill-[#B45309] stroke-[#FDE68A]',
    svgSecondaryBox: 'fill-[#FEF8EC] dark:fill-[#261E10] stroke-[#FDE68A] dark:stroke-[#5C4315]',
    svgSecondaryBoxHover:
      'fill-[#FDF1D6] dark:fill-[#332713] stroke-[#B45309] dark:stroke-[#FBBF24]',
    stageGlowCss: 'rgba(180, 83, 9, 0.08)',
  },
};

export const CASE_CATEGORY_TEXT: Record<Exclude<CaseCategory, 'all'>, string> = {
  ai: 'text-[#C84317] dark:text-[#FB8356]',
  bi: 'text-[#0F766E] dark:text-[#2DD4BF]',
  etl: 'text-[#4338CA] dark:text-[#818CF8]',
};
