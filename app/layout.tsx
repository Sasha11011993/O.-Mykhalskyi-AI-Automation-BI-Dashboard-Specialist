import type { Metadata } from 'next';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Oleksandr Mykhalskyi — AI Automation (n8n) & Custom BI Dashboards',
  description:
    'Interactive portfolio of Oleksandr Mykhalskyi: production n8n workflows, cost-smart AI agents ($0 LLM routine), Google Sheets BI, custom Web BI dashboards, and serverless Telegram Mini Apps.',
  openGraph: {
    title: 'Oleksandr Mykhalskyi — AI Automation (n8n) & Custom BI Dashboards',
    description:
      'Production n8n workflows, cost-smart AI agents, and live BI dashboards for SMBs — featuring interactive 1:1 n8n workflow playback.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Oleksandr Mykhalskyi — AI Automation (n8n) & Custom BI Dashboards',
    description:
      'Production n8n workflows, cost-smart AI agents, and live BI dashboards for SMBs.',
  },
};

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('mk-theme-pref');
    var pref = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = pref === 'dark' || (pref === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        suppressHydrationWarning
        className="font-sans bg-[#F7F5F0] text-[#161513] dark:bg-[#111110] dark:text-[#F5F3EE] transition-colors duration-200 selection:bg-[#CC4518]/15 selection:text-[#C84317] dark:selection:bg-[#F97343]/25 dark:selection:text-[#FDBA74]"
      >
        {children}
      </body>
    </html>
  );
}
