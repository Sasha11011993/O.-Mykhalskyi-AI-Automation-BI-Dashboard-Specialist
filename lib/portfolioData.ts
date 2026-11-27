import type {
  BiDomainId,
  BiPeriodId,
  BudgetTierId,
  CaseCategory,
  FaqCategory,
  Locale,
  ServiceId,
  TabId,
} from './portfolioLogic';

export interface LocalizedText {
  uk: string;
  en: string;
}

export interface KpiProofItem {
  id: string;
  numericValue: number;
  decimals?: number;
  prefix?: string;
  suffix: LocalizedText;
  label: LocalizedText;
  context: LocalizedText;
}

export interface ServiceItem {
  id: ServiceId;
  index: string;
  title: LocalizedText;
  shortTitle: LocalizedText;
  summary: LocalizedText;
  deliverables: LocalizedText[];
  timeline: LocalizedText;
  investment: LocalizedText;
  outcome: LocalizedText;
  stack: string[];
}

export interface CaseStudyItem {
  id: string;
  imageKey: 'case_ai_support' | 'case_retail_bi' | 'case_b2b_pipeline' | 'case_logistics_tower';
  n8nPreset?: 'debt-control-15';
  workflowScreenshotSrc?: string;
  category: Exclude<CaseCategory, 'all'>;
  categoryLabel: LocalizedText;
  industry: LocalizedText;
  year: string;
  duration: LocalizedText;
  title: LocalizedText;
  headlineMetric: LocalizedText;
  summary: LocalizedText;
  challenge: LocalizedText;
  solution: LocalizedText;
  stack: string[];
  metrics: {
    value: string;
    label: LocalizedText;
  }[];
  testimonial: {
    quote: LocalizedText;
    author: LocalizedText;
    role: LocalizedText;
    company: string;
  };
  relatedServiceId: ServiceId;
}

export interface BiChartPoint {
  label: LocalizedText;
  revenue: number;
  automatedShare: number;
  efficiencyIndex: number;
}

export interface BiChannelRow {
  channel: LocalizedText;
  volume: LocalizedText;
  automationRate: string;
  marginImpact: LocalizedText;
  trend: 'up' | 'steady';
}

export interface BiDataset {
  id: BiDomainId;
  label: LocalizedText;
  subtitle: LocalizedText;
  kpis: {
    id: string;
    label: LocalizedText;
    value6m: string;
    value12m: string;
    delta: LocalizedText;
  }[];
  series6m: BiChartPoint[];
  series12m: BiChartPoint[];
  rows: BiChannelRow[];
  insight: LocalizedText;
  sources: string[];
  refreshCadence: LocalizedText;
}

export const BRAND_NAME = 'O. Mykhalskyi';

export const TAB_LABELS: Record<TabId, LocalizedText> = {
  overview: { uk: 'Огляд', en: 'Overview' },
  services: { uk: 'Послуги', en: 'Services' },
  cases: { uk: 'Кейси', en: 'Cases' },
  demo: { uk: 'Інтерактив', en: 'Live Demo' },
  faq: { uk: 'FAQ', en: 'FAQ' },
  contact: { uk: 'Контакти', en: 'Contact' },
};

export const MOBILE_TAB_LABELS: Record<TabId, LocalizedText> = {
  overview: { uk: 'Огляд', en: 'Home' },
  services: { uk: 'Послуги', en: 'Services' },
  cases: { uk: 'Кейси', en: 'Cases' },
  demo: { uk: 'Демо', en: 'Demo' },
  faq: { uk: 'FAQ', en: 'FAQ' },
  contact: { uk: 'Контакт', en: 'Contact' },
};

export const UI_COPY = {
  primaryCta: { uk: 'Обговорити проєкт', en: 'Start Project' },
  footerMeta: {
    uk: '© 2026 Олександр Михальський · Україна / Remote',
    en: '© 2026 Oleksandr Mykhalskyi · Ukraine / Remote',
  },
  keyboardHint: {
    uk: 'Навігація: 1–6 або ← →',
    en: 'Navigate: 1–6 or ← →',
  },
  themeLabels: {
    system: { uk: 'Авто', en: 'Auto' },
    light: { uk: 'Світла', en: 'Light' },
    dark: { uk: 'Темна', en: 'Dark' },
  },
  overview: {
    kicker: {
      uk: 'Олександр Михальський · Незалежний AI та BI-інженер',
      en: 'Oleksandr Mykhalskyi · Independent AI & BI Engineer',
    },
    headline: {
      uk: 'Автоматизую операційну рутину та бізнес-звітність',
      en: 'Automating operational busywork and business reporting',
    },
    lead: {
      uk: 'Налаштовую надійні n8n-воркфлоу, AI-агентів, інтеграції з CRM/1С та живі BI-дашборди (Google Sheets BI, Web BI, Telegram Mini Apps), щоб команда не витрачала години на ручні таблиці.',
      en: 'I build production n8n workflows, cost-smart AI agents, CRM/ERP integrations, and live BI dashboards (Google Sheets BI, custom Web BI, Telegram Mini Apps) so teams stop losing hours to manual spreadsheets.',
    },
    ctaPrimary: { uk: 'Дивитись кейси', en: 'Explore Cases' },
    ctaSecondary: { uk: 'Інтерактивне демо', en: 'Open Live Demo' },
    pipelineCaption: {
      uk: 'Типова архітектура впровадження',
      en: 'Core Production Architecture',
    },
    pipelineNodes: {
      source: { uk: 'CRM · ERP · API', en: 'CRM · ERP · API' },
      engine: { uk: 'AI-агент · ETL', en: 'AI Agent · ETL' },
      output: { uk: 'BI-дашборд · Дія', en: 'BI Suite · Action' },
    },
  },
  services: {
    kicker: {
      uk: 'Напрямки співпраці · Прозорий формат спринтів',
      en: 'Practice Areas · Structured Sprint Delivery',
    },
    heading: {
      uk: 'Чотири ключові спеціалізації',
      en: 'Four Focused Engineering Tracks',
    },
    deliverablesLabel: { uk: 'Що входить у результат', en: 'Concrete Deliverables' },
    stackLabel: { uk: 'Технологічний стек', en: 'Core Stack' },
    impactLabel: { uk: 'Очікуваний бізнес-ефект', en: 'Expected Business Impact' },
    requestBtn: { uk: 'Замовити цей напрям', en: 'Request This Service' },
    timelineLabel: { uk: 'Термін', en: 'Timeline' },
    investmentLabel: { uk: 'Орієнтир бюджету', en: 'Typical Investment' },
  },
  cases: {
    kicker: {
      uk: 'Обрані впровадження · Підтверджені цифри',
      en: 'Selected Work · Verified Business Outcomes',
    },
    heading: { uk: 'Кейси з вимірюваним ROI', en: 'Case Studies with Measurable ROI' },
    filters: {
      all: { uk: 'Усі проєкти', en: 'All Projects' },
      ai: { uk: 'AI-автоматизація', en: 'AI Automation' },
      bi: { uk: 'BI-дашборди', en: 'BI Dashboards' },
      etl: { uk: 'Дані та ETL', en: 'Data & ETL' },
    } as Record<CaseCategory, LocalizedText>,
    viewCase: { uk: 'Детальніше', en: 'Inspect Case' },
    modal: {
      challenge: { uk: 'Виклик клієнта', en: 'Client Challenge' },
      solution: { uk: 'Архітектурне рішення', en: 'Engineered Solution' },
      stack: { uk: 'Використаний стек', en: 'Architecture Stack' },
      outcomes: { uk: 'Вимірювані результати', en: 'Quantified Outcomes' },
      similarCta: { uk: 'Обговорити подібний проєкт', en: 'Scope a Similar Project' },
      closeLabel: { uk: 'Закрити деталі кейсу', en: 'Close case study modal' },
    },
  },
  demo: {
    kicker: {
      uk: 'Інтерактивна демонстрація · Дані та окупність',
      en: 'Interactive Workbench · Live Data & Payback',
    },
    heading: {
      uk: 'Перевірте BI-логіку та ROI автоматизації',
      en: 'Inspect Live BI Logic & Automation ROI',
    },
    modes: {
      bi: { uk: 'BI-прев’ю', en: 'BI Preview' },
      roi: { uk: 'Калькулятор ROI', en: 'ROI Calculator' },
    },
    periods: {
      '6m': { uk: '6 місяців', en: '6 Months' },
      '12m': { uk: '12 місяців', en: '12 Months' },
    } as Record<BiPeriodId, LocalizedText>,
    chartTitle: {
      uk: 'Динаміка виторгу ($ тис.) та частки автоматизованих операцій',
      en: 'Revenue Trajectory ($K) & Automated Operations Share',
    },
    tableHeaders: {
      channel: { uk: 'Напрям / Вузол', en: 'Operational Stream' },
      volume: { uk: 'Обіг / Запити', en: 'Volume' },
      automation: { uk: 'Автоматизація', en: 'Automation' },
      impact: { uk: 'Вплив на маржу', en: 'Margin Impact' },
    },
    roi: {
      inputsHeading: { uk: 'Параметри вашої команди', en: 'Your Operational Inputs' },
      teamSize: { uk: 'Розмір операційної команди', en: 'Operations Team Size' },
      teamUnit: { uk: 'осіб', en: 'people' },
      weeklyHours: {
        uk: 'Ручна рутина на 1 людину / тиждень',
        en: 'Manual Routine per Person / Week',
      },
      hoursUnit: { uk: 'год', en: 'hrs' },
      hourlyRate: { uk: 'Середня вартість години спеціаліста', en: 'Blended Hourly Cost' },
      resultsHeading: { uk: 'Прогноз ефективності (72% автоматизації)', en: 'Projected Efficiency (72% Capture)' },
      savedHoursLabel: { uk: 'Вивільнено часу / міс.', en: 'Hours Reclaimed / Mo.' },
      annualSavingsLabel: { uk: 'Річна економія бюджету', en: 'Annual Cost Savings' },
      paybackLabel: { uk: 'Орієнтовна окупність', en: 'Estimated Payback' },
      weeksUnit: { uk: 'тижн.', en: 'wks' },
      recommendedLabel: { uk: 'Рекомендований напрям', en: 'Recommended Track' },
      transferBtn: {
        uk: 'Отримати план впровадження',
        en: 'Get Implementation Plan',
      },
    },
  },
  contact: {
    kicker: {
      uk: 'Прямий контакт · Відповідь до 24 годин',
      en: 'Direct Contact · Response Within 24 Hours',
    },
    heading: {
      uk: 'Запустімо ваш проєкт без зайвої бюрократії',
      en: 'Scope your automation or BI system directly',
    },
    copyEmail: { uk: 'Скопіювати email', en: 'Copy email' },
    copiedEmail: { uk: 'Скопійовано', en: 'Copied' },
    processHeading: { uk: 'Як відбувається співпраця', en: 'How We Work Together' },
    processSteps: [
      {
        num: '01.',
        title: { uk: 'Діагностика 30 хв', en: '30-Min Discovery' },
        desc: {
          uk: 'Розбираємо вузькі місця, джерела даних та цільові KPI.',
          en: 'Map operational bottlenecks, data sources, and target KPIs.',
        },
      },
      {
        num: '02.',
        title: { uk: 'Архітектура та кошторис', en: 'Architecture & Fixed Scope' },
        desc: {
          uk: 'Фіксуємо схему інтеграцій, терміни та вартість етапів.',
          en: 'Clear system blueprint, milestones, and fixed sprint budget.',
        },
      },
      {
        num: '03.',
        title: { uk: 'Впровадження та навчання', en: 'Delivery & Handoff' },
        desc: {
          uk: 'Запуск у продакшн, документація та супровід команди.',
          en: 'Production deployment, documentation, and team walkthrough.',
        },
      },
    ],
    form: {
      nameLabel: { uk: 'Ваше ім’я', en: 'Your Name' },
      namePlaceholder: { uk: 'Олена Савченко', en: 'Olena Savchenko' },
      emailLabel: { uk: 'Робочий email', en: 'Work Email' },
      emailPlaceholder: { uk: 'olena@company.com', en: 'olena@company.com' },
      serviceLabel: { uk: 'Ключовий напрям', en: 'Primary Focus' },
      budgetLabel: { uk: 'Орієнтовний бюджет', en: 'Estimated Budget' },
      budgets: {
        starter: { uk: '$300 – $1k', en: '$300 – $1k' },
        growth: { uk: '$1k – $3k', en: '$1k – $3k' },
        enterprise: { uk: '$3k+', en: '$3k+' },
      } as Record<BudgetTierId, LocalizedText>,
      detailsLabel: { uk: 'Короткий опис задачі', en: 'Project Brief' },
      detailsPlaceholder: {
        uk: 'Які системи потрібно поєднати (CRM, ERP, таблиці) та який результат очікуєте?',
        en: 'Which tools need connecting (CRM, ERP, spreadsheets) and what outcome matters most?',
      },
      submitBtn: { uk: 'Надіслати бриф', en: 'Send Project Brief' },
      successTitle: { uk: 'Бриф успішно зафіксовано', en: 'Project Brief Received' },
      successSubtitle: {
        uk: 'Дякую! Я перегляну деталі та повернуся з конкретною пропозицією щодо архітектури протягом одного робочого дня.',
        en: 'Thank you. I will review your requirements and respond with an initial architecture proposal within one business day.',
      },
      refLabel: { uk: 'Номер звернення', en: 'Reference ID' },
      resetBtn: { uk: 'Надіслати новий запит', en: 'Send Another Inquiry' },
    },
  },
} as const;

export const KPI_PROOF_ITEMS: KpiProofItem[] = [
  {
    id: 'systems',
    numericValue: 190,
    suffix: { uk: '', en: '' },
    label: { uk: 'Тестових прогонів', en: 'Production Test Runs' },
    context: { uk: 'система «Дебет Контроль»', en: 'Debit Control live testing' },
  },
  {
    id: 'accuracy',
    numericValue: 98.9,
    decimals: 1,
    suffix: { uk: '%', en: '%' },
    label: { uk: 'Стабільність пайплайну', en: 'Pipeline Reliability' },
    context: { uk: 'з авто-моніторингом помилок', en: 'with centralized error alerts' },
  },
  {
    id: 'hours',
    numericValue: 11.5,
    decimals: 1,
    suffix: { uk: ' с', en: 's' },
    label: { uk: 'Середній цикл оновлення', en: 'Average Sync Cycle' },
    context: { uk: 'від файлу 1С до BI та Telegram', en: 'from ERP export to BI & Telegram' },
  },
  {
    id: 'roi',
    numericValue: 0,
    prefix: '$',
    suffix: { uk: ' LLM', en: ' LLM' },
    label: { uk: 'Витрати на AI у нормі', en: 'Routine-Day AI Spend' },
    context: { uk: 'чистий JS у n8n · AI при аномаліях', en: 'pure JS math · AI on anomalies only' },
  },
];

export const SERVICES_DATA: ServiceItem[] = [
  {
    id: 'ai-agents',
    index: '01.',
    title: {
      uk: 'n8n-автоматизація та AI-агенти',
      en: 'n8n Workflows & Cost-Smart AI Agents',
    },
    shortTitle: { uk: 'AI-агенти', en: 'AI Agents' },
    summary: {
      uk: 'Надійні воркфлоу в n8n для обробки заявок із месенджерів, кваліфікації лідів, голосових ботів та AI-контролю аномалій без зайвих витрат на токени.',
      en: 'Production n8n workflows for omnichannel lead intake, voice/chat Telegram AI agents, and conditional anomaly watchdogs that keep LLM costs near $0.',
    },
    deliverables: [
      {
        uk: 'Умовні AI-агенти (OpenAI / Gemini API): чистий JS робить рутину за $0, AI вирішує нестандартні задачі',
        en: 'Cost-smart LLM agents (OpenAI / Gemini API): pure JS handles routine math ($0), AI solves edge cases',
      },
      {
        uk: 'Надійні сценарії в n8n з пакетною обробкою (SplitInBatches), ретраями й алертами помилок у Telegram',
        en: 'Fault-tolerant n8n orchestrations with batching, retries, and centralized Telegram error alerts',
      },
      {
        uk: 'Контроль людини (Human-in-the-Loop) та прозоре логування витрат токенів',
        en: 'Human-in-the-loop approval gates plus transparent per-run token cost logging',
      },
    ],
    timeline: { uk: '1 – 3 тижні', en: '1 – 3 weeks' },
    investment: { uk: 'від $450', en: 'from $450' },
    outcome: {
      uk: 'Нуль втрачених заявок і до 70% менше ручної операційної рутини.',
      en: 'Zero lost leads and up to 70% less repetitive operational busywork.',
    },
    stack: ['n8n', 'JavaScript', 'OpenAI API', 'Telegram Bots', 'Webhooks', 'CRM APIs'],
  },
  {
    id: 'bi-dashboards',
    index: '02.',
    title: {
      uk: 'Живі BI-дашборди та Mini Apps',
      en: 'Custom BI Dashboards & Telegram Mini Apps',
    },
    shortTitle: { uk: 'BI-дашборди', en: 'BI Dashboards' },
    summary: {
      uk: 'Прозорі управлінські дашборди для власника: маржа, дебіторка (FIFO), конверсія каналів і швидкість відповіді — у Google Sheets BI, кастомному Web BI або прямо в Telegram Mini App.',
      en: 'Executive dashboards for SMB founders: margins, receivables aging (FIFO), lead conversion, and response speed — in Google Sheets BI, custom Web BI, or Serverless Telegram Mini Apps.',
    },
    deliverables: [
      {
        uk: 'Чиста структура даних та автоматизовані багатосторінкові Google Sheets BI або Web BI (React / SQL)',
        en: 'Clean data model powering automated multi-tab Google Sheets BI or custom Web BI (React / SQL)',
      },
      {
        uk: 'Serverless Telegram Mini App з живими графіками та інтерактивними фільтрами прямо в месенджері',
        en: 'Serverless Telegram Mini Apps with live charts and interactive filters inside Telegram',
      },
      {
        uk: 'Автоматичні щоденні ранкові дайджести (5 головних цифр за 30 секунд) у Telegram',
        en: 'Automated morning digests (5 core numbers in 30 seconds) delivered straight to Telegram',
      },
    ],
    timeline: { uk: '1 – 2 тижні', en: '1 – 2 weeks' },
    investment: { uk: 'від $490', en: 'from $490' },
    outcome: {
      uk: 'Власник бачить реальний стан бізнесу за 30 секунд без ручного Excel у п’ятницю ввечері.',
      en: 'Founders see real business health in 30 seconds without Friday-evening manual Excel assembly.',
    },
    stack: ['Google Sheets BI', 'React', 'SQL', 'Telegram Mini App', 'n8n', 'REST API'],
  },
  {
    id: 'etl-pipelines',
    index: '03.',
    title: {
      uk: 'Інтеграції 1С / ERP / CRM та ETL',
      en: 'ERP / CRM Integrations & Data Pipelines',
    },
    shortTitle: { uk: 'Дані та ETL', en: 'Data & ETL' },
    summary: {
      uk: 'Автоматична синхронізація вигрузок 1С / ERP, Google Drive, месенджерів і CRM у єдину чисту базу даних із захистом від дублікатів та збереженням ручних коментарів.',
      en: 'Event-driven synchronization connecting accounting/ERP exports, Google Drive Push, messengers, and CRM records into one reliable analytical layer.',
    },
    deliverables: [
      {
        uk: 'Миттєві тригери (Google Drive Push / Webhooks) та парсинг .xls / CSV / JSON у чистому JS',
        en: 'Instant triggers (Google Drive Push / Webhooks) and pure JS parsing for .xls / CSV / JSON',
      },
      {
        uk: 'Неруйнівне оновлення таблиць і БД (Google Sheets / SQL / Supabase) зі збереженням нотаток команди',
        en: 'Non-destructive batch updates to Google Sheets / SQL / Supabase preserving team notes',
      },
      {
        uk: 'Ідемпотентність, захист від лімітів API та централізований Error Handler',
        en: 'Idempotent runs, rate-limit safe batching, and centralized Error Handler monitoring',
      },
    ],
    timeline: { uk: '2 – 3 тижні', en: '2 – 3 weeks' },
    investment: { uk: 'від $900', en: 'from $900' },
    outcome: {
      uk: 'Повна синхронізація за секунди замість годин ручного копіювання між таблицями.',
      en: 'Full synchronization in seconds instead of hours of manual copy-paste across spreadsheets.',
    },
    stack: ['n8n', 'Google Drive Push', 'JavaScript', 'SQL', 'Supabase', 'REST API'],
  },
  {
    id: 'audit-architecture',
    index: '04.',
    title: {
      uk: 'Аудит процесів та архітектура',
      en: 'Process Audit & System Blueprint',
    },
    shortTitle: { uk: 'Аудит і план', en: 'Audit & Plan' },
    summary: {
      uk: 'Швидка діагностика ручних таблиць, месенджерів і поточних n8n-воркфлоу з чіткою схемою автоматизації, оцінкою економії та фіксованим планом запуску.',
      en: 'Focused diagnostic of your manual spreadsheets, lead channels, or existing n8n flows — yielding a clear architecture blueprint, savings estimate, and fixed sprint plan.',
    },
    deliverables: [
      {
        uk: 'Карта процесів (AS-IS / TO-BE) із виявленням найдорожчих ручних операцій і втрат лідів',
        en: 'AS-IS / TO-BE workflow mapping pinpointing the highest-cost manual bottlenecks and lead leaks',
      },
      {
        uk: 'Оптимальний стек без зайвих SaaS-підписок та переплат за токени LLM',
        en: 'Lean architecture spec avoiding bloated SaaS subscriptions and unnecessary LLM token burn',
      },
      {
        uk: 'Покроковий план впровадження MVP за 7–14 днів із прозорим бюджетом',
        en: 'Actionable 7–14 day MVP launch roadmap with fixed milestone pricing',
      },
    ],
    timeline: { uk: '3 – 5 днів', en: '3 – 5 days' },
    investment: { uk: '$290 фіксовано', en: '$290 fixed' },
    outcome: {
      uk: 'Чітке розуміння, які 20% автоматизацій дадуть 80% економії вже цього місяця.',
      en: 'Clarity on the exact 20% of automations that deliver 80% of operational payoff this month.',
    },
    stack: ['Process Mapping', 'ROI Modeling', 'n8n Architecture', 'BI Design'],
  },
];

export const CASE_STUDIES_DATA: CaseStudyItem[] = [
  {
    id: 'debt-control-1c-n8n',
    imageKey: 'case_b2b_pipeline',
    n8nPreset: 'debt-control-15',
    workflowScreenshotSrc: '/assets/aistudio/image_4c39709d.png',
    category: 'ai',
    categoryLabel: { uk: 'Бойове тестування · n8n', en: 'Live Testing · n8n' },
    industry: { uk: 'Дистрибуція · 1С + Sheets (Анонімізовано)', en: 'Distribution · ERP + Sheets (Anonymized)' },
    year: '2026',
    duration: { uk: 'У тестуванні', en: 'In Live Testing' },
    title: {
      uk: 'Дебет-контроль: 1С → Google Sheets BI → AI-сторож → Telegram Mini App',
      en: 'Debit Control: 1C / ERP → Google Sheets BI → AI Watchdog → Telegram Mini App',
    },
    headlineMetric: {
      uk: '190 прогонів · 98.9% · $0 LLM у нормі',
      en: '190 runs · 98.9% · $0 LLM routine',
    },
    summary: {
      uk: 'Реальна система у бойовому тестуванні (6 воркфлоу n8n): підхоплює .xls із 1С через Google Drive Push за 2–5 с, рахує FIFO-борги чистим JS, оновлює 6 вкладок BI та запускає OpenAI лише при аномаліях.',
      en: 'Real production system in live testing (6 n8n workflows): catches ERP .xls exports via Google Drive Push in 2–5s, runs Pure JS FIFO aging math, syncs 6 BI tabs + Serverless Telegram Mini App, and triggers OpenAI only on anomalies.',
    },
    challenge: {
      uk: 'Щоденна звірка дебіторської заборгованості з 1С займала до 1.5 години ручної роботи, створювала ризик перезапису коментарів менеджерів у таблицях і затримувала виявлення прострочки чи підозрілих повернень.',
      en: 'Daily accounts-receivable reconciliation from ERP took up to 1.5 hours of manual spreadsheet work, risked overwriting manager notes, and delayed detection of overdue accounts or unusual returns.',
    },
    solution: {
      uk: 'Побудовано 6 зв’язаних воркфлоу n8n: Google Drive Push ловить новий .xls, Pure JS FIFO-движок рахує борги та світлофор прострочки (≤7д / 8–21д / >21д) зі збереженням коментарів, SplitInBatches оновлює 6 вкладок Google Sheets BI, IF-фільтр викликає OpenAI лише при аномаліях ($0 у штатні дні), а поверх працює Serverless Telegram Mini App і голосовий AI-агент українською.',
      en: 'Engineered 6 interconnected n8n workflows: Google Drive Push picks up new .xls exports, a Pure JS FIFO engine computes debt aging tiers (≤7d / 8–21d / >21d) while preserving notes, SplitInBatches updates 6 Google Sheets BI tabs, an IF gate triggers OpenAI only on anomalies ($0 on normal days), paired with a Serverless Telegram Mini App and voice AI assistant.',
    },
    stack: ['n8n', 'JavaScript (FIFO)', 'OpenAI API', 'Google Sheets BI', 'Google Drive Push', 'Telegram Mini App'],
    metrics: [
      { value: '190 / 98.9%', label: { uk: 'Тест-прогонів і фактична стабільність', en: 'Test runs & verified reliability' } },
      { value: '$0.00 LLM', label: { uk: 'У нормальні дні (умовний IF-фільтр)', en: 'On normal days via conditional IF gate' } },
      { value: '11.5 с', label: { uk: 'Середній цикл від .xls до BI і Telegram', en: 'Avg end-to-end sync to BI & Telegram' } },
    ],
    testimonial: {
      quote: {
        uk: 'Система проходить реальне бойове тестування: щоранку керівництво отримує в Telegram чітке зведення прострочки, світлофор боргів і попередження про аномалії без ручної звірки в Excel.',
        en: 'Currently in live production testing: leadership gets a clean Telegram brief with overdue aging tiers, deltas, and AI anomaly flags without manual spreadsheet reconciliation.',
      },
      author: { uk: 'Підтверджена телеметрія', en: 'Verified Live Telemetry' },
      role: { uk: 'Дистрибуційний бізнес', en: 'Distribution Operations' },
      company: 'NDA · Україна (Анонімізовано)',
    },
    relatedServiceId: 'ai-agents',
  },
  {
    id: 'retail-powerbi-suite',
    imageKey: 'case_retail_bi',
    category: 'bi',
    categoryLabel: { uk: 'Архітектурний концепт · BI', en: 'Reference Blueprint · BI' },
    industry: { uk: 'Роздріб та SMB · Демо-модель', en: 'SMB Retail · Blueprint' },
    year: '2026',
    duration: { uk: '2 тижні (орієнтир)', en: '2 weeks (target)' },
    title: {
      uk: 'Ранковий BI-дашборд власника: 5 ключових цифр бізнесу за 30 секунд',
      en: 'SMB Owner Morning BI Cockpit: 5 Core Metrics in 30 Seconds',
    },
    headlineMetric: {
      uk: '5 KPI на 1 екрані · 0 ручного Excel',
      en: '5 KPIs on 1 view · 0 manual Excel',
    },
    summary: {
      uk: 'Типова архітектура заміни 10+ ручних Excel-таблиць єдиним Google Sheets BI / Web BI з автоматичним ранковим дайджестом у Telegram.',
      en: 'Reference architecture replacing 10+ fragmented Excel tabs with a unified Google Sheets BI / Web BI dashboard and automated morning Telegram digest.',
    },
    challenge: {
      uk: 'Власники SMB часто зводять виручку, маржу, заявки та прострочку вручну лише у п’ятницю ввечері, помічаючи касові розриви й втрату маржі із запізненням.',
      en: 'SMB founders often compile revenue, margin, leads, and overdue balances manually on Friday evenings, spotting cash leaks and bottlenecks weeks too late.',
    },
    solution: {
      uk: 'Автоматичний пайплайн n8n підтягує дані з обліку, CRM та таблиць у єдину чисту модель із 5 управлінськими KPI: чиста маржа, швидкість лідів, прострочена дебіторка, вузьке місце операційки та залишок коштів.',
      en: 'An automated n8n data pipeline feeds accounting, CRM, and spreadsheet records into a single clean view tracking 5 executive KPIs: net margin, lead response speed, overdue receivables, top bottleneck, and cash position.',
    },
    stack: ['Google Sheets BI', 'n8n', 'SQL', 'React Web BI', 'Telegram Digest'],
    metrics: [
      { value: '30 сек', label: { uk: 'Час на ранковий огляд цифр бізнесу', en: 'Morning executive review time' } },
      { value: '5 KPI', label: { uk: 'Фокус лише на рішеннях, без шуму', en: 'Decision-focused KPIs, zero clutter' } },
      { value: '100%', label: { uk: 'Автоматичне оновлення без ручних копій', en: 'Automated refresh without manual copies' } },
    ],
    testimonial: {
      quote: {
        uk: 'Типовий архітектурний шаблон для малого й середнього бізнесу — адаптується під ваші реальні джерела (1С, CRM, Google Sheets) за 1–2 тижні.',
        en: 'Reference SMB architecture — tailored directly to your actual data sources (ERP, CRM, Google Sheets) within 1–2 weeks.',
      },
      author: { uk: 'Типове рішення', en: 'Reference Architecture' },
      role: { uk: 'BI & Автоматизація звітності', en: 'BI & Reporting Automation' },
      company: 'Демо-концепт · SMB',
    },
    relatedServiceId: 'bi-dashboards',
  },
  {
    id: 'ecommerce-ai-triage',
    imageKey: 'case_ai_support',
    category: 'ai',
    categoryLabel: { uk: 'Архітектурний концепт · AI', en: 'Reference Blueprint · AI' },
    industry: { uk: 'E-commerce / Послуги · Демо', en: 'E-commerce / Services · Blueprint' },
    year: '2026',
    duration: { uk: '1 – 2 тижні (орієнтир)', en: '1–2 weeks (target)' },
    title: {
      uk: '3 месенджери → 1 система: прийом і AI-кваліфікація лідів без втрат',
      en: '3 Messengers → 1 System: Zero-Loss Omnichannel Lead Intake',
    },
    headlineMetric: {
      uk: 'TG + IG + WA → 1 CRM + Live BI',
      en: 'TG + IG + WA → 1 CRM + Live BI',
    },
    summary: {
      uk: 'Архітектура об’єднання заявок із Telegram, Instagram Direct і WhatsApp/сайту в єдиний webhook n8n із AI-кваліфікацією, контролем людини (HITL) та BI по швидкості відповіді.',
      en: 'Reference architecture unifying inquiries from Telegram, Instagram Direct, and WhatsApp/web forms into one n8n webhook with AI qualification, human-in-the-loop approval, and response-time BI.',
    },
    challenge: {
      uk: 'Коли менеджери стрибають між трьома месенджерами вручну, частина теплих заявок губиться в потоці повідомлень, а власник не бачить реального ROI кожного каналу.',
      en: 'When managers switch manually across three messaging apps, warm inquiries slip through the cracks and owners have zero visibility into true channel ROI or response speed.',
    },
    solution: {
      uk: 'Єдиний оркестратор n8n приймає всі звернення, AI-агент класифікує намір і готує структуровану картку з контролем людини перед відповіддю, записує лід у CRM/Sheets і шле миттєвий алерт відповідальному в Telegram.',
      en: 'A unified n8n orchestrator captures every message, runs structured AI triage with human-in-the-loop review, logs clean records to CRM/Sheets, and triggers instant Telegram alerts to the assigned rep.',
    },
    stack: ['n8n', 'OpenAI API', 'Telegram API', 'Instagram / Webhooks', 'CRM / Sheets'],
    metrics: [
      { value: '3 → 1', label: { uk: 'Усі канали заявок в єдиній системі', en: 'All inquiry channels in one pipeline' } },
      { value: '< 2 хв', label: { uk: 'Цільовий час першої реакції на лід', en: 'Target first-response speed' } },
      { value: 'HITL', label: { uk: 'Контроль людини перед відповіддю клієнту', en: 'Human approval before client replies' } },
    ],
    testimonial: {
      quote: {
        uk: 'Архітектурний шаблон для сервісного та e-commerce бізнесу, що поєднує прийом заявок і прозорий BI-контроль менеджерів.',
        en: 'Reference blueprint for service and e-commerce teams combining omnichannel lead intake with live manager SLA tracking.',
      },
      author: { uk: 'Типове рішення', en: 'Reference Architecture' },
      role: { uk: 'Омніканальна автоматизація', en: 'Omnichannel Lead Automation' },
      company: 'Демо-концепт · SMB',
    },
    relatedServiceId: 'ai-agents',
  },
  {
    id: 'logistics-etl-tower',
    imageKey: 'case_logistics_tower',
    category: 'etl',
    categoryLabel: { uk: 'Власний інструмент · ETL + AI', en: 'Internal Build · ETL + AI' },
    industry: { uk: 'Моніторинг ринку · n8n + AI', en: 'Market Intelligence · n8n + AI' },
    year: '2026',
    duration: { uk: '1 тиждень', en: '1 week' },
    title: {
      uk: 'AI_Jobs_Hunter: автоматичний збір, AI-скоринг і фільтрація запитів у Telegram',
      en: 'AI_Jobs_Hunter: Automated Lead/Job Ingestion, AI Scoring & Telegram Alerts',
    },
    headlineMetric: {
      uk: 'Скоринг 0–100 · Миттєвий алерт у TG',
      en: '0–100 AI rubric · Instant TG alerts',
    },
    summary: {
      uk: 'Власна система моніторингу джерел у n8n: автоматично збирає нові проєкти/вакансії, відсіює нерелевантне чистим кодом, оцінює релевантність через AI-рубрику та шле топ-матчі в Telegram.',
      en: 'Production internal n8n monitoring pipeline: ingests opportunities across sources, filters noise with deterministic JS, scores fit via an AI rubric (0–100), and alerts only top matches in Telegram.',
    },
    challenge: {
      uk: 'Ручний перегляд десятків стрічок і дощок оголошень щодня забирає 1–2 години та призводить до запізнення з першим відгуком на гарячі запити.',
      en: 'Manually scanning multiple feeds every day wastes 1–2 hours and causes slow reaction times on high-intent opportunities.',
    },
    solution: {
      uk: 'Пайплайн у n8n з дедуплікацією записів, попереднім JS-фільтром (щоб не спалювати токени на спам), AI-оцінкою за критеріями і форматованим повідомленням у Telegram із ключовим контекстом.',
      en: 'Built an n8n pipeline with record deduplication, deterministic JS pre-filtering (avoiding wasted LLM tokens on noise), rubric-based AI scoring, and crisp Telegram alerts.',
    },
    stack: ['n8n', 'JavaScript', 'OpenAI API', 'REST API', 'Google Sheets', 'Telegram'],
    metrics: [
      { value: '0–100', label: { uk: 'Прозорий AI-скоринг релевантності', en: 'Structured AI relevance rubric' } },
      { value: '24/7', label: { uk: 'Автоматичний моніторинг без ручного пошуку', en: 'Automated continuous monitoring' } },
      { value: '100%', label: { uk: 'Дедуплікація та контроль витрат токенів', en: 'Deduplication & token budget guard' } },
    ],
    testimonial: {
      quote: {
        uk: 'Та саму архітектуру легко адаптувати для моніторингу тендерів, B2B-лідів, цін конкурентів або згадок бренду в реальному часі.',
        en: 'The exact same pipeline adapts cleanly to tender monitoring, B2B lead discovery, competitor pricing, or real-time market alerts.',
      },
      author: { uk: 'Власна розробка', en: 'Internal Production Tool' },
      role: { uk: 'ETL & AI-фільтрація', en: 'ETL & AI Filtering' },
      company: 'O. Mykhalskyi · 2026',
    },
    relatedServiceId: 'etl-pipelines',
  },
];

export const BI_DATASETS: Record<BiDomainId, BiDataset> = {
  ecommerce: {
    id: 'ecommerce',
    label: { uk: 'E-commerce', en: 'E-commerce' },
    subtitle: {
      uk: 'Модель онлайн-ритейлу: замовлення, AI-підтримка та юніт-економіка',
      en: 'D2C retail telemetry: order flow, AI support capture & unit economics',
    },
    kpis: [
      {
        id: 'rev',
        label: { uk: 'Чистий виторг', en: 'Net Revenue' },
        value6m: '$482K',
        value12m: '$946K',
        delta: { uk: '+24.8%', en: '+24.8%' },
      },
      {
        id: 'margin',
        label: { uk: 'Валова маржа', en: 'Gross Margin' },
        value6m: '38.4%',
        value12m: '41.2%',
        delta: { uk: '+4.6 п.п.', en: '+4.6 pp' },
      },
      {
        id: 'auto',
        label: { uk: 'Авто-закриття тікетів', en: 'Auto-Resolved Tickets' },
        value6m: '71.5%',
        value12m: '76.8%',
        delta: { uk: '+18.2%', en: '+18.2%' },
      },
      {
        id: 'saved',
        label: { uk: 'Економія ФОП / рік', en: 'Annual Ops Savings' },
        value6m: '$34.2K',
        value12m: '$68.4K',
        delta: { uk: 'ROI 4.1x', en: 'ROI 4.1x' },
      },
    ],
    series6m: [
      { label: { uk: 'Чер', en: 'Jun' }, revenue: 64, automatedShare: 48, efficiencyIndex: 62 },
      { label: { uk: 'Лип', en: 'Jul' }, revenue: 71, automatedShare: 56, efficiencyIndex: 68 },
      { label: { uk: 'Сер', en: 'Aug' }, revenue: 76, automatedShare: 63, efficiencyIndex: 74 },
      { label: { uk: 'Вер', en: 'Sep' }, revenue: 84, automatedShare: 68, efficiencyIndex: 80 },
      { label: { uk: 'Жов', en: 'Oct' }, revenue: 91, automatedShare: 72, efficiencyIndex: 86 },
      { label: { uk: 'Лис', en: 'Nov' }, revenue: 96, automatedShare: 76, efficiencyIndex: 91 },
    ],
    series12m: [
      { label: { uk: 'Q1', en: 'Q1' }, revenue: 188, automatedShare: 42, efficiencyIndex: 58 },
      { label: { uk: 'Q2', en: 'Q2' }, revenue: 224, automatedShare: 58, efficiencyIndex: 71 },
      { label: { uk: 'Q3', en: 'Q3' }, revenue: 256, automatedShare: 69, efficiencyIndex: 82 },
      { label: { uk: 'Q4', en: 'Q4' }, revenue: 278, automatedShare: 77, efficiencyIndex: 92 },
    ],
    rows: [
      {
        channel: { uk: 'AI-агент підтримки та ТТН', en: 'AI Support & Shipment Agent' },
        volume: { uk: '6 420 / міс.', en: '6,420 / mo' },
        automationRate: '76.4%',
        marginImpact: { uk: '+$3,850 / міс.', en: '+$3,850 / mo' },
        trend: 'up',
      },
      {
        channel: { uk: 'Авто-прогноз закупівель SKU', en: 'SKU Replenishment Forecast' },
        volume: { uk: '1 280 SKU', en: '1,280 SKUs' },
        automationRate: '89.0%',
        marginImpact: { uk: '+$5,120 / міс.', en: '+$5,120 / mo' },
        trend: 'up',
      },
      {
        channel: { uk: 'Звірка накладених платежів', en: 'COD Payment Reconciliation' },
        volume: { uk: '3 910 транз.', en: '3,910 txns' },
        automationRate: '98.5%',
        marginImpact: { uk: '+$1,940 / міс.', en: '+$1,940 / mo' },
        trend: 'steady',
      },
    ],
    insight: {
      uk: 'Зростання частки автоматизації з 48% до 76% вивільнило 1.8 FTE підтримки та прискорило оборотність топ-200 SKU.',
      en: 'Lifting automation share from 48% to 76% freed 1.8 support FTEs and accelerated top-200 SKU inventory turns.',
    },
    sources: ['Shopify', 'Nova Poshta API', 'BigQuery', 'Power BI'],
    refreshCadence: { uk: 'Оновлення: кожні 15 хв · SLA 99.8%', en: 'Refresh: every 15m · 99.8% SLA' },
  },
  saas: {
    id: 'saas',
    label: { uk: 'SaaS B2B', en: 'SaaS B2B' },
    subtitle: {
      uk: 'Підписна аналітика: MRR, AI-скоринг лідів та контроль відтоку',
      en: 'Subscription analytics: MRR velocity, AI lead scoring & churn signals',
    },
    kpis: [
      {
        id: 'rev',
        label: { uk: 'Поточний MRR', en: 'Active MRR' },
        value6m: '$118K',
        value12m: '$164K',
        delta: { uk: '+39.0%', en: '+39.0%' },
      },
      {
        id: 'margin',
        label: { uk: 'Net Revenue Retention', en: 'Net Revenue Retention' },
        value6m: '112%',
        value12m: '119%',
        delta: { uk: '+7.0 п.п.', en: '+7.0 pp' },
      },
      {
        id: 'auto',
        label: { uk: 'AI-збагачення лідів', en: 'AI-Enriched Leads' },
        value6m: '94.0%',
        value12m: '98.2%',
        delta: { uk: '18с SLA', en: '18s SLA' },
      },
      {
        id: 'saved',
        label: { uk: 'Приріст Pipeline / рік', en: 'Annual Pipeline Lift' },
        value6m: '$142K',
        value12m: '$310K',
        delta: { uk: 'ROI 5.4x', en: 'ROI 5.4x' },
      },
    ],
    series6m: [
      { label: { uk: 'Чер', en: 'Jun' }, revenue: 88, automatedShare: 64, efficiencyIndex: 70 },
      { label: { uk: 'Лип', en: 'Jul' }, revenue: 94, automatedShare: 71, efficiencyIndex: 76 },
      { label: { uk: 'Сер', en: 'Aug' }, revenue: 101, automatedShare: 78, efficiencyIndex: 82 },
      { label: { uk: 'Вер', en: 'Sep' }, revenue: 108, automatedShare: 85, efficiencyIndex: 88 },
      { label: { uk: 'Жов', en: 'Oct' }, revenue: 113, automatedShare: 91, efficiencyIndex: 92 },
      { label: { uk: 'Лис', en: 'Nov' }, revenue: 118, automatedShare: 95, efficiencyIndex: 96 },
    ],
    series12m: [
      { label: { uk: 'Q1', en: 'Q1' }, revenue: 290, automatedShare: 55, efficiencyIndex: 66 },
      { label: { uk: 'Q2', en: 'Q2' }, revenue: 345, automatedShare: 72, efficiencyIndex: 79 },
      { label: { uk: 'Q3', en: 'Q3' }, revenue: 412, automatedShare: 86, efficiencyIndex: 89 },
      { label: { uk: 'Q4', en: 'Q4' }, revenue: 492, automatedShare: 96, efficiencyIndex: 96 },
    ],
    rows: [
      {
        channel: { uk: 'HubSpot ICP-скоринг і бриф', en: 'HubSpot ICP Scoring & Brief' },
        volume: { uk: '1 840 лідів', en: '1,840 leads' },
        automationRate: '98.2%',
        marginImpact: { uk: '+2.4x демо', en: '+2.4x demos' },
        trend: 'up',
      },
      {
        channel: { uk: 'Ранні сигнали відтоку (Churn BI)', en: 'Churn Risk Signal Pipeline' },
        volume: { uk: '420 акаунтів', en: '420 accounts' },
        automationRate: '91.5%',
        marginImpact: { uk: '-3.8% відтік', en: '-3.8% churn' },
        trend: 'up',
      },
      {
        channel: { uk: 'Авто-білінг Stripe → BigQuery', en: 'Stripe → BigQuery Ledger' },
        volume: { uk: '12 400 подій', en: '12,400 events' },
        automationRate: '99.7%',
        marginImpact: { uk: '0 розбіжностей', en: '0 variances' },
        trend: 'steady',
      },
    ],
    insight: {
      uk: 'Автоматичний ICP-скоринг за 18 сек. подвоїв конверсію в демо, а ранні алерти відтоку втримали NRR вище 112%.',
      en: '18-second ICP scoring doubled demo booking rate while proactive churn alerts kept NRR solidly above 112%.',
    },
    sources: ['HubSpot', 'Stripe', 'BigQuery', 'Looker Studio'],
    refreshCadence: { uk: 'Синхронізація: Real-time · Webhook', en: 'Sync: Real-time · Webhook' },
  },
  logistics: {
    id: 'logistics',
    label: { uk: 'Логістика', en: 'Logistics' },
    subtitle: {
      uk: 'Контроль автопарку: рентабельність маршрутів, паливо та простої',
      en: 'Fleet control tower: route profitability, fuel variance & idle alerts',
    },
    kpis: [
      {
        id: 'rev',
        label: { uk: 'Маржа на км', en: 'Margin per km' },
        value6m: '$0.44',
        value12m: '$0.51',
        delta: { uk: '+15.9%', en: '+15.9%' },
      },
      {
        id: 'margin',
        label: { uk: 'Зниження простоїв', en: 'Idle Reduction' },
        value6m: '-27.4%',
        value12m: '-31.2%',
        delta: { uk: '+118 рейсів', en: '+118 trips' },
      },
      {
        id: 'auto',
        label: { uk: 'Авто-обробка CMR/актів', en: 'OCR CMR & Invoice Sync' },
        value6m: '82.0%',
        value12m: '88.5%',
        delta: { uk: '99.4% точн.', en: '99.4% acc.' },
      },
      {
        id: 'saved',
        label: { uk: 'Економія парку / рік', en: 'Annual Fleet Savings' },
        value6m: '$52.0K',
        value12m: '$108.5K',
        delta: { uk: 'ROI 3.9x', en: 'ROI 3.9x' },
      },
    ],
    series6m: [
      { label: { uk: 'Чер', en: 'Jun' }, revenue: 72, automatedShare: 54, efficiencyIndex: 66 },
      { label: { uk: 'Лип', en: 'Jul' }, revenue: 78, automatedShare: 62, efficiencyIndex: 72 },
      { label: { uk: 'Сер', en: 'Aug' }, revenue: 81, automatedShare: 69, efficiencyIndex: 77 },
      { label: { uk: 'Вер', en: 'Sep' }, revenue: 88, automatedShare: 76, efficiencyIndex: 83 },
      { label: { uk: 'Жов', en: 'Oct' }, revenue: 94, automatedShare: 83, efficiencyIndex: 88 },
      { label: { uk: 'Лис', en: 'Nov' }, revenue: 102, automatedShare: 88, efficiencyIndex: 93 },
    ],
    series12m: [
      { label: { uk: 'Q1', en: 'Q1' }, revenue: 215, automatedShare: 48, efficiencyIndex: 61 },
      { label: { uk: 'Q2', en: 'Q2' }, revenue: 248, automatedShare: 63, efficiencyIndex: 74 },
      { label: { uk: 'Q3', en: 'Q3' }, revenue: 282, automatedShare: 77, efficiencyIndex: 84 },
      { label: { uk: 'Q4', en: 'Q4' }, revenue: 314, automatedShare: 89, efficiencyIndex: 93 },
    ],
    rows: [
      {
        channel: { uk: 'OCR розпізнавання CMR / інвойсів', en: 'AI OCR for CMR & Invoices' },
        volume: { uk: '2 150 док.', en: '2,150 docs' },
        automationRate: '88.5%',
        marginImpact: { uk: '+$4,200 / міс.', en: '+$4,200 / mo' },
        trend: 'up',
      },
      {
        channel: { uk: 'GPS + Паливні карти ETL', en: 'GPS + Fuel Card Telemetry ETL' },
        volume: { uk: '64 авто', en: '64 vehicles' },
        automationRate: '99.6%',
        marginImpact: { uk: '-9.2% паливо', en: '-9.2% fuel waste' },
        trend: 'up',
      },
      {
        channel: { uk: 'Алерти простою на кордоні', en: 'Border Queue Delay Alerts' },
        volume: { uk: '310 рейсів', en: '310 routes' },
        automationRate: '95.0%',
        marginImpact: { uk: '-31% простою', en: '-31% idle time' },
        trend: 'up',
      },
    ],
    insight: {
      uk: 'Об’єднання GPS-телеметрії та паливних карт у BigQuery виявило 9.2% перевитрат і скоротило порожні пробіги на 31%.',
      en: 'Unifying GPS telemetry with fuel cards in BigQuery exposed 9.2% fuel leakage and cut empty fleet miles by 31%.',
    },
    sources: ['Wialon GPS', 'TMS', 'Fuel Cards', 'Power BI'],
    refreshCadence: { uk: 'Оновлення: щогодини · dbt tests', en: 'Refresh: hourly · dbt tests' },
  },
};

export interface PipelineNodeSpec {
  id: string;
  role: 'extract' | 'transform' | 'load';
  label: LocalizedText;
  sublabel: LocalizedText;
  protocol: LocalizedText;
  explanation: LocalizedText;
  conduitIndices: number[];
}

export interface PipelineBlueprint {
  serviceId: ServiceId;
  code: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  stageLabels: {
    extract: LocalizedText;
    transform: LocalizedText;
    load: LocalizedText;
  };
  sources: [PipelineNodeSpec, PipelineNodeSpec, PipelineNodeSpec];
  transforms: [PipelineNodeSpec, PipelineNodeSpec];
  outputs: [PipelineNodeSpec, PipelineNodeSpec];
  initialRecords: number;
  batchDelta: number;
  recordsUnit: LocalizedText;
  sparkBars: [number, number, number, number, number];
  impactSummary: LocalizedText;
  stack: string[];
}

export const PIPELINE_BLUEPRINTS: Record<ServiceId, PipelineBlueprint> = {
  'etl-pipelines': {
    serviceId: 'etl-pipelines',
    code: 'ETL',
    title: {
      uk: 'ETL-пайплайн: Автозбір даних у DWH',
      en: 'ETL Pipeline: Automated Warehouse Sync',
    },
    subtitle: {
      uk: 'Об’єднання ERP, CRM та рекламних API у чисті SQL-вітрини без ручного Excel',
      en: 'Unifying ERP, CRM, and ad APIs into clean SQL marts with zero manual spreadsheets',
    },
    stageLabels: {
      extract: { uk: '01. Extract · Джерела', en: '01. Extract · Sources' },
      transform: { uk: '02. Transform · ETL', en: '02. Transform · ETL' },
      load: { uk: '03. Load · Вітрини', en: '03. Load · Output' },
    },
    sources: [
      {
        id: 'erp',
        role: 'extract',
        label: { uk: '1C / ERP', en: 'ERP / Inventory' },
        sublabel: { uk: 'Залишки та P&L', en: 'Stock & Ledger' },
        protocol: { uk: 'OData / SQL CDC · кожні 30 хв', en: 'OData / SQL CDC · every 30m' },
        explanation: {
          uk: 'Інкрементально забирає собівартість, складські залишки та фінансові проводки без навантаження на робочу базу.',
          en: 'Incrementally extracts COGS, warehouse stock, and ledger entries without slowing down production ERP.',
        },
        conduitIndices: [0],
      },
      {
        id: 'crm',
        role: 'extract',
        label: { uk: 'Shopify / CRM', en: 'Shopify / CRM' },
        sublabel: { uk: 'Замовлення API', en: 'Orders Webhook' },
        protocol: { uk: 'REST API + Webhooks · Real-time', en: 'REST API + Webhooks · Real-time' },
        explanation: {
          uk: 'Фіксує нові замовлення, повернення, знижки та статуси клієнтів у момент події з захистом від дублікатів.',
          en: 'Captures orders, refunds, discount codes, and customer lifecycle updates in real time with idempotent keys.',
        },
        conduitIndices: [1, 2],
      },
      {
        id: 'ads',
        role: 'extract',
        label: { uk: 'Meta & Google Ads', en: 'Meta & Google Ads' },
        sublabel: { uk: 'Витрати ROAS', en: 'Ad Spend Feed' },
        protocol: { uk: 'Marketing API · щогодинна звірка', en: 'Marketing API · hourly sync' },
        explanation: {
          uk: 'Автоматично підтягує витрати по кампаніях, UTM-мітки та кліки для наскрізного розрахунку CAC і ROAS.',
          en: 'Pulls campaign spend, UTM attribution, and click metrics automatically for accurate CAC and ROAS tracking.',
        },
        conduitIndices: [3],
      },
    ],
    transforms: [
      {
        id: 'py',
        role: 'transform',
        label: { uk: 'Python + Airbyte', en: 'Python + Airbyte' },
        sublabel: { uk: 'Очищення та дедуплікація', en: 'Schema & Dedupe' },
        protocol: { uk: 'Python ETL · Retry + Schema Guard', en: 'Python ETL · Retry + Schema Guard' },
        explanation: {
          uk: 'Приводить валюти, дати й формати API до єдиного стандарту, автоматично повторює запити при збоях мережі.',
          en: 'Normalizes currencies, timestamps, and API schemas while automatically retrying transient network failures.',
        },
        conduitIndices: [0, 1, 4],
      },
      {
        id: 'dbt',
        role: 'transform',
        label: { uk: 'BigQuery + dbt', en: 'BigQuery + dbt' },
        sublabel: { uk: 'SQL-моделі та QA-тести', en: 'SQL Marts & QA' },
        protocol: { uk: 'dbt Core · 40+ авто-тестів даних', en: 'dbt Core · 40+ data QA tests' },
        explanation: {
          uk: 'Будує чисті аналітичні вітрини (факти й виміри) та автоматично перевіряє відсутність пустих або битих значень.',
          en: 'Builds clean analytical marts (facts & dimensions) and runs automated integrity checks before data hits BI.',
        },
        conduitIndices: [2, 3, 5],
      },
    ],
    outputs: [
      {
        id: 'bi',
        role: 'load',
        label: { uk: 'Power BI / Looker', en: 'Power BI / Looker' },
        sublabel: { uk: 'Оновлення щогодини', en: 'Hourly Refresh' },
        protocol: { uk: 'Live SQL / Scheduled Refresh', en: 'Live SQL / Scheduled Refresh' },
        explanation: {
          uk: 'Готові інтерактивні дашборди для власника та команд без ручного зведення CSV і розбіжностей між відділами.',
          en: 'Decision-ready executive dashboards refreshed automatically with zero manual CSV exports or conflicting totals.',
        },
        conduitIndices: [4],
      },
      {
        id: 'alert',
        role: 'load',
        label: { uk: 'Telegram Алерти', en: 'Slack / TG Alerts' },
        sublabel: { uk: 'Контроль збоїв і маржі', en: 'Anomaly Guard' },
        protocol: { uk: 'Bot Webhook · Threshold Rules', en: 'Bot Webhook · Threshold Rules' },
        explanation: {
          uk: 'Миттєво сповіщає відповідальних, якщо впала маржа по SKU, закінчується товар або змінилася структура API.',
          en: 'Instantly alerts owners when SKU margin drops, stock nears depletion, or an upstream API schema drifts.',
        },
        conduitIndices: [5],
      },
    ],
    initialRecords: 14820,
    batchDelta: 420,
    recordsUnit: { uk: 'рядків / цикл', en: 'rows / sync' },
    sparkBars: [42, 58, 66, 81, 95],
    impactSummary: { uk: '99.4% точності · 0 годин ручного зведення', en: '99.4% accuracy · 0 hrs manual prep' },
    stack: ['Python', 'Airbyte', 'dbt', 'BigQuery', 'PostgreSQL'],
  },
  'ai-agents': {
    serviceId: 'ai-agents',
    code: 'AI',
    title: {
      uk: 'AI-потік: Автообробка заявок і CRM',
      en: 'AI Flow: Autonomous Triage & CRM Enrichment',
    },
    subtitle: {
      uk: 'LLM-агент читає звернення, перевіряє статуси в ERP та створює готові дії в CRM',
      en: 'LLM agent classifies inbound requests, queries ERP live, and triggers CRM actions',
    },
    stageLabels: {
      extract: { uk: '01. Вхідні події', en: '01. Inbound Events' },
      transform: { uk: '02. n8n + LLM-агент', en: '02. n8n + LLM Agent' },
      load: { uk: '03. Дії в бізнесі', en: '03. Live Actions' },
    },
    sources: [
      {
        id: 'mail',
        role: 'extract',
        label: { uk: 'Email / Helpdesk', en: 'Email / Helpdesk' },
        sublabel: { uk: 'Тікети клієнтів', en: 'Support Tickets' },
        protocol: { uk: 'IMAP / Zendesk Webhook', en: 'IMAP / Zendesk Webhook' },
        explanation: {
          uk: 'Перехоплює нові листи й тікети клієнтів, витягує номер замовлення, вкладення та контекст історії переписки.',
          en: 'Ingests incoming emails and support tickets, parsing order numbers, attachments, and prior conversation history.',
        },
        conduitIndices: [0],
      },
      {
        id: 'tg',
        role: 'extract',
        label: { uk: 'Telegram / Чат', en: 'Telegram / Chat' },
        sublabel: { uk: 'Запити менеджерів', en: 'Live Inquiries' },
        protocol: { uk: 'Telegram Bot API · < 1s trigger', en: 'Telegram Bot API · < 1s trigger' },
        explanation: {
          uk: 'Приймає повідомлення з месенджерів та веб-чату, миттєво запускаючи перевірку статусу доставки чи ліда.',
          en: 'Captures messenger and live-chat inquiries, immediately triggering shipment lookups or lead qualification.',
        },
        conduitIndices: [1, 2],
      },
      {
        id: 'rag',
        role: 'extract',
        label: { uk: 'База знань (RAG)', en: 'Knowledge (RAG)' },
        sublabel: { uk: 'Прайси і правила', en: 'SOPs & Pricing' },
        protocol: { uk: 'Vector Index (pgvector) · Grounded', en: 'Vector Index (pgvector) · Grounded' },
        explanation: {
          uk: 'Подає агенту лише актуальні прайси, політики повернення та регламенти, унеможливлюючи галюцинації LLM.',
          en: 'Supplies verified pricing sheets, return policies, and internal SOPs so LLM responses stay strictly grounded.',
        },
        conduitIndices: [3],
      },
    ],
    transforms: [
      {
        id: 'n8n',
        role: 'transform',
        label: { uk: 'n8n Orchestrator', en: 'n8n Orchestrator' },
        sublabel: { uk: 'Маршрутизація + API', en: 'Routing + API' },
        protocol: { uk: 'n8n Self-Hosted · Audit Log', en: 'n8n Self-Hosted · Audit Log' },
        explanation: {
          uk: 'Оркеструє виклики до ERP, перевізників і CRM, керує розгалуженнями бізнес-логіки та зберігає повний лог дій.',
          en: 'Orchestrates ERP, carrier, and CRM API calls, routes edge cases deterministically, and preserves full audit logs.',
        },
        conduitIndices: [0, 1, 4],
      },
      {
        id: 'llm',
        role: 'transform',
        label: { uk: 'OpenAI / Claude', en: 'OpenAI / Claude' },
        sublabel: { uk: 'Скоринг та guardrails', en: 'Scoring & Guardrails' },
        protocol: { uk: 'Structured JSON · Confidence Gate', en: 'Structured JSON · Confidence Gate' },
        explanation: {
          uk: 'Класифікує намір, оцінює ICP за 7 критеріями та передає кейс людині, якщо впевненість моделі нижча за поріг.',
          en: 'Classifies intent, scores ICP fit across 7 criteria, and escalates to a human when confidence falls below threshold.',
        },
        conduitIndices: [2, 3, 5],
      },
    ],
    outputs: [
      {
        id: 'crm-act',
        role: 'load',
        label: { uk: 'HubSpot / Pipedrive', en: 'HubSpot / Pipedrive' },
        sublabel: { uk: 'Збагачена картка угоди', en: 'Enriched Deal Brief' },
        protocol: { uk: 'CRM API · Auto-Task & Brief', en: 'CRM API · Auto-Task & Brief' },
        explanation: {
          uk: 'Створює чи оновлює угоду з готовим резюме компанії, оцінкою пріоритету та чернеткою персонального листа.',
          en: 'Creates or updates deals with a researched company summary, ICP score, and tailored first-touch outreach draft.',
        },
        conduitIndices: [4],
      },
      {
        id: 'reply',
        role: 'load',
        label: { uk: 'Авто-відповідь', en: 'Auto-Resolution' },
        sublabel: { uk: 'Закриття за 18 сек.', en: 'Resolved in 18s' },
        protocol: { uk: 'Human-in-the-Loop / Auto-Send', en: 'Human-in-the-Loop / Auto-Send' },
        explanation: {
          uk: 'Самостійно закриває до 72% типових запитів (ТТН, статуси, умови), вивільняючи команду для складних продажів.',
          en: 'Autonomously resolves up to 72% of routine tickets (tracking, status, terms), freeing staff for complex deals.',
        },
        conduitIndices: [5],
      },
    ],
    initialRecords: 6420,
    batchDelta: 185,
    recordsUnit: { uk: 'заявок / міс.', en: 'tickets / mo' },
    sparkBars: [38, 52, 71, 84, 94],
    impactSummary: { uk: '-68% часу відповіді · 72% авто-закриття', en: '-68% response time · 72% auto-resolved' },
    stack: ['n8n', 'OpenAI API', 'Claude API', 'Python', 'HubSpot'],
  },
  'bi-dashboards': {
    serviceId: 'bi-dashboards',
    code: 'BI',
    title: {
      uk: 'BI-архітектура: P&L та юніт-економіка',
      en: 'BI Suite: Executive P&L & Unit Economics',
    },
    subtitle: {
      uk: 'Єдина семантична модель маржі, складів і маркетингу для щоденних рішень',
      en: 'Single semantic model for margin, stock velocity, and marketing ROAS',
    },
    stageLabels: {
      extract: { uk: '01. Фінансові дані', en: '01. Financial Feeds' },
      transform: { uk: '02. Семантика DAX', en: '02. Semantic DAX' },
      load: { uk: '03. Звітність C-level', en: '03. Executive Views' },
    },
    sources: [
      {
        id: 'dwh',
        role: 'extract',
        label: { uk: 'PostgreSQL DWH', en: 'PostgreSQL DWH' },
        sublabel: { uk: 'Історія продажів', en: 'Sales Ledger' },
        protocol: { uk: 'Read Replica · Indexed Views', en: 'Read Replica · Indexed Views' },
        explanation: {
          uk: 'Агрегує історичні чеки, повернення та когорти клієнтів для точного порівняння YoY і MoM без затримок.',
          en: 'Serves indexed historical sales, refunds, and customer cohorts for fast YoY and MoM trend comparisons.',
        },
        conduitIndices: [0],
      },
      {
        id: 'pos',
        role: 'extract',
        label: { uk: 'POS / Склади', en: 'POS / Warehouses' },
        sublabel: { uk: 'Обіг по SKU', en: 'SKU Velocity' },
        protocol: { uk: 'Nightly & Intraday Sync', en: 'Nightly & Intraday Sync' },
        explanation: {
          uk: 'Відстежує оборотність кожної позиції, неліквіди та глибину знижок по кожній торговій точці чи складу.',
          en: 'Tracks per-SKU sell-through rate, dead stock capital, and discount leakage across every branch or warehouse.',
        },
        conduitIndices: [1, 2],
      },
      {
        id: 'bank',
        role: 'extract',
        label: { uk: 'Банк / Stripe', en: 'Bank / Stripe' },
        sublabel: { uk: 'Cashflow & OPEX', en: 'Cashflow & OPEX' },
        protocol: { uk: 'Bank API + Stripe Webhooks', en: 'Bank API + Stripe Webhooks' },
        explanation: {
          uk: 'Автоматично підтягує реальний рух коштів, комісії еквайрингу та операційні витрати для точного EBITDA.',
          en: 'Consolidates bank balances, payment gateway fees, and OPEX categories into verified cashflow and EBITDA.',
        },
        conduitIndices: [3],
      },
    ],
    transforms: [
      {
        id: 'model',
        role: 'transform',
        label: { uk: 'Star Schema SQL', en: 'Star Schema SQL' },
        sublabel: { uk: 'Зв’язки фактів і вимірів', en: 'Fact & Dim Tables' },
        protocol: { uk: 'Kimball Modeling · Single Truth', en: 'Kimball Modeling · Single Truth' },
        explanation: {
          uk: 'Правильна модель «зірка» усуває дублювання сум і забезпечує миттєву фільтрацію навіть на мільйонах рядків.',
          en: 'Proper star-schema modeling prevents double-counting and keeps multi-million-row slice filtering instantaneous.',
        },
        conduitIndices: [0, 1, 4],
      },
      {
        id: 'dax',
        role: 'transform',
        label: { uk: 'DAX KPI Engine', en: 'DAX KPI Engine' },
        sublabel: { uk: 'EBITDA, LTV, CAC', en: 'EBITDA, LTV, CAC' },
        protocol: { uk: 'Verified DAX Measures · RLS', en: 'Verified DAX Measures · RLS' },
        explanation: {
          uk: 'Фіксує єдині формули маржі, LTV і CAC з розмежуванням прав доступу (RLS) для керівників різних філій.',
          en: 'Standardizes margin, LTV, and CAC formulas with Row-Level Security (RLS) so each manager sees only their scope.',
        },
        conduitIndices: [2, 3, 5],
      },
    ],
    outputs: [
      {
        id: 'pbi',
        role: 'load',
        label: { uk: 'Power BI Executive', en: 'Power BI Executive' },
        sublabel: { uk: 'P&L по філіях і SKU', en: 'Branch & SKU P&L' },
        protocol: { uk: 'Desktop + Mobile Drill-Through', en: 'Desktop + Mobile Drill-Through' },
        explanation: {
          uk: 'Багаторівневий звіт: від загального P&L компанії до маржинальності конкретного SKU чи менеджера у два кліки.',
          en: 'Layered executive suite drilling from company-wide P&L down to individual SKU or rep margin in two clicks.',
        },
        conduitIndices: [4],
      },
      {
        id: 'digest',
        role: 'load',
        label: { uk: 'Ранковий звіт CFO', en: 'Daily CFO Digest' },
        sublabel: { uk: 'Зведення о 08:30', en: 'Delivered 08:30' },
        protocol: { uk: 'Automated PDF / Telegram Push', en: 'Automated PDF / Slack Push' },
        explanation: {
          uk: 'Щодня надсилає власнику короткий зріз виручки, плану/факту й касових відхилень прямо в месенджер.',
          en: 'Delivers a crisp daily summary of revenue, plan-vs-actual variance, and cash alerts straight to leadership.',
        },
        conduitIndices: [5],
      },
    ],
    initialRecords: 1840,
    batchDelta: 64,
    recordsUnit: { uk: 'SKU під контролем', en: 'SKUs tracked' },
    sparkBars: [46, 55, 68, 79, 91],
    impactSummary: { uk: '+19% маржі · 4 дні Excel → 0', en: '+19% net margin · 4d Excel → 0' },
    stack: ['Power BI', 'Looker Studio', 'DAX', 'SQL', 'BigQuery'],
  },
  'audit-architecture': {
    serviceId: 'audit-architecture',
    code: 'PLAN',
    title: {
      uk: 'Аудит: Карта процесів і план на 90 днів',
      en: 'Audit: Process Blueprint & 90-Day ROI Plan',
    },
    subtitle: {
      uk: 'Виявляємо найдорожчі ручні процеси та проєктуємо оптимальний стек без зайвих ліцензій',
      en: 'Pinpointing costly manual bottlenecks and designing a lean 90-day rollout',
    },
    stageLabels: {
      extract: { uk: '01. Поточний стан', en: '01. AS-IS Audit' },
      transform: { uk: '02. Моделювання', en: '02. Architecture' },
      load: { uk: '03. Результат аудиту', en: '03. Deliverables' },
    },
    sources: [
      {
        id: 'sheets',
        role: 'extract',
        label: { uk: 'Ручні таблиці', en: 'Manual Sheets' },
        sublabel: { uk: 'Дублі та помилки', en: 'Copy-Paste Loops' },
        protocol: { uk: 'Spreadsheet & Formula Audit', en: 'Spreadsheet & Formula Audit' },
        explanation: {
          uk: 'Перевіряємо всі критичні Excel/Google Sheets, де команда щотижня копіює дані вручну та втрачає точність.',
          en: 'Audits critical Excel/Google Sheets where manual copy-paste loops waste hours and introduce silent errors.',
        },
        conduitIndices: [0],
      },
      {
        id: 'silos',
        role: 'extract',
        label: { uk: 'Розрізнені CRM', en: 'Siloed Tools' },
        sublabel: { uk: 'Втрати лідів', en: 'Disconnected APIs' },
        protocol: { uk: 'API & SaaS Stack Inventory', en: 'API & SaaS Stack Inventory' },
        explanation: {
          uk: 'Оцінюємо наявні API-можливості ваших CRM/ERP та прибираємо дублюючі SaaS-підписки, за які ви переплачуєте.',
          en: 'Evaluates API capabilities across your CRM/ERP tools and cuts overlapping SaaS subscriptions draining budget.',
        },
        conduitIndices: [1, 2],
      },
      {
        id: 'ops',
        role: 'extract',
        label: { uk: 'Інтерв’ю команди', en: 'Team Interviews' },
        sublabel: { uk: 'Хронометраж годин', en: 'Hour Time-Study' },
        protocol: { uk: '3–5 фокус-сесій по 30 хв', en: '3–5 focused 30-min sessions' },
        explanation: {
          uk: 'Фіксуємо реальні витрати часу менеджерів і фінансистів, щоб автоматизувати найболючіші вузькі місця першими.',
          en: 'Measures actual team hours spent on repetitive tasks to target the highest-friction bottlenecks first.',
        },
        conduitIndices: [3],
      },
    ],
    transforms: [
      {
        id: 'map',
        role: 'transform',
        label: { uk: 'AS-IS → TO-BE', en: 'AS-IS → TO-BE' },
        sublabel: { uk: 'Схема інтеграцій', en: 'Integration Map' },
        protocol: { uk: 'Target Data & Automation Spec', en: 'Target Data & Automation Spec' },
        explanation: {
          uk: 'Проєктуємо цільову архітектуру потоків даних, обираючи найпростіший надійний стек без vendor lock-in.',
          en: 'Designs the target data and automation architecture using the leanest reliable stack without vendor lock-in.',
        },
        conduitIndices: [0, 1, 4],
      },
      {
        id: 'roi',
        role: 'transform',
        label: { uk: 'Фінмодель ROI', en: 'ROI Financial Model' },
        sublabel: { uk: 'Окупність етапів', en: 'Sprint Payback' },
        protocol: { uk: 'Cost-vs-Savings Calculator', en: 'Cost-vs-Savings Calculator' },
        explanation: {
          uk: 'Рахуємо точну вартість розробки, ліцензій та окупність кожного модуля у тижнях ще до старту робіт.',
          en: 'Calculates build cost, license overhead, and payback in weeks for every module before writing a line of code.',
        },
        conduitIndices: [2, 3, 5],
      },
    ],
    outputs: [
      {
        id: 'spec',
        role: 'load',
        label: { uk: 'Технічна схема', en: 'System Blueprint' },
        sublabel: { uk: 'Стек і кошторис', en: 'Stack & Budget' },
        protocol: { uk: 'Architecture Doc + Diagrams', en: 'Architecture Doc + Diagrams' },
        explanation: {
          uk: 'Документ із діаграмами інтеграцій та фіксованим бюджетом, який можна реалізувати зі мною або вашою командою.',
          en: 'Complete integration diagrams and fixed-scope estimates you can execute with me or hand to an internal team.',
        },
        conduitIndices: [4],
      },
      {
        id: 'roadmap',
        role: 'load',
        label: { uk: 'План на 90 днів', en: '90-Day Roadmap' },
        sublabel: { uk: 'Пріоритет 20/80', en: '20/80 Priorities' },
        protocol: { uk: '3 спринти · Quick Wins за 14 дн.', en: '3 sprints · Quick Wins in 14d' },
        explanation: {
          uk: 'Поетапний план впровадження, де перші 20% автоматизацій дають 80% фінансового ефекту вже в перший місяць.',
          en: 'Phased rollout prioritizing the 20% of automations that unlock 80% of operational savings in month one.',
        },
        conduitIndices: [5],
      },
    ],
    initialRecords: 24,
    batchDelta: 3,
    recordsUnit: { uk: 'вузлів оцінено', en: 'flows mapped' },
    sparkBars: [30, 48, 65, 82, 96],
    impactSummary: { uk: 'Готово за 5–7 днів · фіксовано $850', en: 'Ready in 5–7 days · $850 fixed' },
    stack: ['Process Mapping', 'ROI Modeling', 'Data Governance', 'Architecture'],
  },
};

export interface FaqItem {
  id: string;
  index: string;
  category: Exclude<FaqCategory, 'all'>;
  question: LocalizedText;
  answer: LocalizedText;
  meta: LocalizedText;
}

export const FAQ_COPY = {
  kicker: {
    uk: 'Часті питання · Процес співпраці та автоматизації',
    en: 'Frequently Asked Questions · Process & Delivery',
  },
  heading: {
    uk: 'Як проходить співпраця та запуск систем',
    en: 'How collaboration & automation rollout work',
  },
  filters: {
    all: { uk: 'Усі', en: 'All' },
    process: { uk: 'Процес', en: 'Process' },
    pricing: { uk: 'Вартість', en: 'Pricing' },
    security: { uk: 'Безпека', en: 'Security' },
  } as Record<FaqCategory, LocalizedText>,
  processTitle: {
    uk: 'Як ми запускаємо проєкт',
    en: 'How we launch together',
  },
  steps: [
    {
      index: '01.',
      title: { uk: 'Діагностика 30 хв', en: '30-Min Discovery' },
      desc: {
        uk: 'Розбираємо рутинні процеси, джерела даних та очікуваний ефект у годинах і грошах.',
        en: 'We map operational bottlenecks, data sources, and target ROI in hours and dollars.',
      },
    },
    {
      index: '02.',
      title: { uk: 'Схема, терміни й кошторис', en: 'Architecture & Fixed Scope' },
      desc: {
        uk: 'Фіксуємо технічну схему, етапи та бюджет до старту робіт без прихованих доплат.',
        en: 'We lock the system diagram, sprint milestones, and fixed budget before building.',
      },
    },
    {
      index: '03.',
      title: { uk: 'Запуск і передача команді', en: 'Rollout & Team Handover' },
      desc: {
        uk: 'Щотижневі демо, перенесення у ваш контур, відеоінструкції та 30 днів супроводу.',
        en: 'Weekly demos, deployment inside your infrastructure, Loom guides, and 30-day warranty.',
      },
    },
  ],
  ctaTitle: {
    uk: 'Залишилось питання під ваш процес?',
    en: 'Have a question specific to your stack?',
  },
  ctaLead: {
    uk: 'Опишіть задачу у 2–3 реченнях — підкажу реалістичний підхід і орієнтир бюджету протягом доби.',
    en: 'Share your workflow in 2–3 lines — I will outline a practical approach and budget range within 24h.',
  },
  ctaPrimary: {
    uk: 'Задати питання',
    en: 'Ask a Question',
  },
  ctaAudit: {
    uk: 'Почати з аудиту ($850)',
    en: 'Start with Audit ($850)',
  },
};

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'collaboration-flow',
    index: '01',
    category: 'process',
    question: {
      uk: 'Як відбувається співпраця від першого дзвінка до запуску?',
      en: 'How does the collaboration work from the first call to production?',
    },
    answer: {
      uk: 'Спершу проводимо безкоштовну 30-хвилинну діагностику, де фіксуємо вузькі місця, CRM/таблиці та бажаний результат. За 1–2 дні ви отримуєте схему рішення, точний кошторис і графік спринтів. Розробка йде короткими ітераціями зі щотижневим демо, а фінал — запуск у продакшн, документація й навчання команди.',
      en: 'We start with a free 30-minute discovery call to map bottlenecks, existing CRM/spreadsheets, and target KPIs. Within 1–2 days you receive an architecture proposal, fixed estimate, and sprint schedule. Delivery runs in weekly demo milestones, finishing with production deployment, documentation, and team onboarding.',
    },
    meta: { uk: 'Старт за 2–3 дні', en: 'Kickoff in 2–3 days' },
  },
  {
    id: 'team-technical-skills',
    index: '02',
    category: 'process',
    question: {
      uk: 'Чи потрібно нашій команді знати n8n, Python або Power BI?',
      en: 'Does our team need to know n8n, Python, or Power BI to use the system?',
    },
    answer: {
      uk: 'Ні. Автоматизації працюють у фоні, а менеджери й керівники користуються звичними інструментами — CRM, Telegram, поштою або готовим BI-дашбордом з інтуїтивними фільтрами. До кожного проєкту додаю короткі відеоінструкції (Loom) і просту карту сценаріїв для вашого адміна.',
      en: 'No. Automations run silently in the background while your managers work inside familiar tools — CRM, Telegram, email, or a clean BI dashboard with one-click filters. Every handoff includes short Loom walkthroughs and a clear operating runbook.',
    },
    meta: { uk: 'Loom-інструкції у комплекті', en: 'Loom guides included' },
  },
  {
    id: 'timeline-and-budget',
    index: '03',
    category: 'pricing',
    question: {
      uk: 'Скільки часу займає впровадження і як фіксується вартість?',
      en: 'How long does delivery take and how is pricing structured?',
    },
    answer: {
      uk: 'Точкові AI-сценарії або управлінський BI-дашборд запускаються за 2–4 тижні (від $1,600–$1,800), комплексні ETL-сховища та мультиінтеграції — за 3–5 тижнів (від $2,600). Бюджет і перелік результатів фіксуються до старту з оплатою двома етапами: 50% на старті та 50% після приймання готової системи.',
      en: 'Focused AI automations or executive BI suites ship in 2–4 weeks (from $1,600–$1,800); end-to-end ETL warehouses and multi-system syncs take 3–5 weeks (from $2,600). Scope and pricing are fixed upfront with milestone billing: 50% at kickoff and 50% upon production sign-off.',
    },
    meta: { uk: 'Фіксований бюджет · 50 / 50', en: 'Fixed scope · 50 / 50 split' },
  },
  {
    id: 'no-clear-spec',
    index: '04',
    category: 'pricing',
    question: {
      uk: 'З чого почати, якщо процеси хаотичні й немає готового ТЗ?',
      en: 'Where should we start if our processes are messy and we have no spec?',
    },
    answer: {
      uk: 'Із фіксованого 5–7 денного спринту «Аудит і план автоматизації» за $850. Я розбираю ваші реальні процеси й дані, рахую окупність кожного модуля та віддаю готову схему архітектури й план на 90 днів. Ви можете запускати впровадження зі мною або передати цей план будь-якому підряднику.',
      en: 'Start with the fixed 5–7 day “Audit & Automation Roadmap” sprint ($850). I map your live workflows and data silos, model payback per module, and deliver a complete architecture blueprint plus a 90-day rollout plan you can execute with me or any internal team.',
    },
    meta: { uk: 'Аудит 5–7 днів · $850', en: '5–7 day Audit · $850' },
  },
  {
    id: 'data-security-nda',
    index: '05',
    category: 'security',
    question: {
      uk: 'Де зберігаються наші дані, ключі API та чи підписуємо NDA?',
      en: 'Where do our data and API keys live, and do you sign an NDA?',
    },
    answer: {
      uk: 'Усі дані, сервери n8n/VPS, бази BigQuery/PostgreSQL і ключі OpenAI розгортаються виключно у вашому контурі та на ваших акаунтах. До обміну доступами підписуємо NDA, налаштовуємо окремі сервісні токени з мінімальними правами та не використовуємо ваші дані для навчання сторонніх моделей.',
      en: 'All workflows, n8n/VPS instances, BigQuery/PostgreSQL databases, and LLM API keys stay strictly inside your own cloud accounts. We sign an NDA before access sharing, use scoped least-privilege service tokens, and never expose private business data to model training.',
    },
    meta: { uk: 'Ваш контур · NDA до старту', en: 'Your cloud · NDA upfront' },
  },
  {
    id: 'ownership-and-support',
    index: '06',
    category: 'security',
    question: {
      uk: 'Кому належить код і як працює підтримка після запуску?',
      en: 'Who owns the code and how does post-launch support work?',
    },
    answer: {
      uk: '100% прав на всі n8n-воркфлоу, Python-скрипти, SQL-моделі та файли Power BI / Looker Studio належать вам — без прив’язки до мене як підрядника. У вартість впровадження включено 30 днів гарантійного супроводу на випадок змін API чи правок, а далі за потреби можна підключити гнучку щомісячну підтримку.',
      en: 'You retain 100% ownership of every n8n workflow, Python script, SQL model, and BI file with zero vendor lock-in. Every project includes 30 days of post-launch warranty for API adjustments or fine-tuning, with optional lightweight retainer support afterward.',
    },
    meta: { uk: '100% ваш код · 30 дн. гарантії', en: '100% ownership · 30d warranty' },
  },
];

export function t(item: LocalizedText, locale: Locale): string {
  return item[locale];
}



