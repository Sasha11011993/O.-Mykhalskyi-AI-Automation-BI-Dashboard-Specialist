# O. Mykhalskyi — AI Automation & BI Dashboard Specialist

Interactive bilingual (**UA / EN**) portfolio and engineering showcase built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Firebase**.

Designed to demonstrate production AI automation pipelines, interactive `n8n` workflows, BI dashboards, and measurable business ROI — backed by a private `/admin` case studio with AI-assisted drafting and multi-provider LLM failover.

---

## Key Features

- **Interactive n8n Workflow Visualizer** — Live animated execution replay over real multi-node automation graphs (including conditional branching, JSON workflow inspection, and per-node technical notes).
- **Automation ROI Calculator** — Real-time savings estimator with 6-month payback curve and prefilled project brief handoff.
- **Public AI Project Consultant** — Server-side AI assistant that scopes visitor automation ideas, estimates timelines, and structures project inquiries.
- **Owner Case Studio (`/admin`)** — Google-authenticated CMS backed by Firestore for creating, ordering, and publishing portfolio case studies (`published`, `draft`, and NDA `unlisted` links), uploading compressed screenshots with interactive hotspots, and importing sanitized `n8n` JSON graphs.
- **AI Case Producer Agent** — Multimodal assistant inside `/admin` that drafts bilingual case studies, metrics, and scene hotspot annotations from notes, screenshots, and `n8n` workflows with multi-step Undo.
- **Multi-Provider AI Failover & Routing** — Automatic server-side failover across **Google Gemini**, **OpenAI**, **Anthropic**, and **OpenRouter** with quota/auth cooldowns. Provider priority, pause toggles, and model IDs can be managed live from `/admin` while API keys remain strictly server-side.
- **Bilingual & Theme-Aware UI** — Full Ukrainian / English localization with Light, Dark, and System theme modes.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Styling & Motion:** Tailwind CSS v4, Motion (`motion/react`), Lucide Icons
- **Database & Auth:** Firebase Authentication + Cloud Firestore with hardened security rules
- **AI Providers:** `@google/genai` (primary) with server-side failover to OpenAI, Anthropic, and OpenRouter
- **Testing:** Node native test runner (`tsx --test`) covering business logic, workflow layout, failover routing, and Firestore security invariants

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and configure at least one AI provider key:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Primary | Google Gemini API key (server-side only) |
| `OPENAI_API_KEY` | Optional | OpenAI API key for automatic failover |
| `OPENAI_MODEL` | Optional | Default OpenAI model ID (e.g. `gpt-4o-mini`) |
| `ANTHROPIC_API_KEY` | Optional | Anthropic API key for automatic failover |
| `ANTHROPIC_MODEL` | Optional | Default Anthropic model ID (e.g. `claude-3-5-haiku-latest`) |
| `OPENROUTER_API_KEY` | Optional | OpenRouter API key for automatic failover |
| `OPENROUTER_MODEL` | Optional | Default OpenRouter model ID (e.g. `google/gemini-2.5-flash`) |
| `AI_PROVIDER_ORDER` | Optional | Comma-separated priority order (`gemini,openai,anthropic,openrouter`) |
| `APP_URL` | Optional | Public site URL used for OpenRouter referrer headers |

> **Security:** Never expose API keys via `NEXT_PUBLIC_*` variables. All AI calls execute exclusively in Next.js server API routes.

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public portfolio, or [http://localhost:3000/admin](http://localhost:3000/admin) for the owner studio.

---

## Available Scripts

```bash
npm run dev     # Start local development server
npm run build   # Create production build
npm run start   # Start production server
npm run lint    # Run ESLint (codebase + Firestore security rules)
```

Run the automated unit and security-rules test suite:

```bash
npx tsx --test lib/*.test.ts firestore.rules.test.ts
```

---

## Deploying to Vercel

1. Push this repository to GitHub (Public or Private).
2. Import the repository in [Vercel](https://vercel.com/new) (Next.js is auto-detected).
3. Add your server-side API keys under **Project Settings → Environment Variables**.
4. In **Firebase Console → Authentication → Settings → Authorized domains**, add your production Vercel domain so Google sign-in works on `/admin`.
5. Deploy — subsequent pushes to `main` redeploy automatically.
