'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export default class FirebaseErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let readable = error.message || 'Несподівана помилка доступу до бази даних.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        readable = `${parsed.operationType ?? 'firestore'} (${parsed.path ?? ''}): ${parsed.error}`;
      }
    } catch {
      // Plain text error
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error): void {
    console.error('FirebaseErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[320px] w-full flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-2xl border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-[#C84317] dark:text-[#FB8356]">
              <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <h2 className="text-base font-semibold text-[#161513] dark:text-[#F5F3EE]">
                Помилка синхронізації з Firebase
              </h2>
            </div>
            <p className="text-xs font-mono text-[#555049] dark:text-[#A8A298] break-words leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#161513] dark:bg-[#F5F3EE] text-white dark:text-[#111110] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Оновити сторінку</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
