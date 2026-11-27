'use client';

import React from 'react';
import { ThemeLocaleProvider } from '@/components/ThemeLocaleContext';
import FirebaseErrorBoundary from '@/components/FirebaseErrorBoundary';
import AdminCaseWorkspace from '@/components/admin/AdminCaseWorkspace';

export default function AdminPage() {
  return (
    <ThemeLocaleProvider>
      <FirebaseErrorBoundary>
        <AdminCaseWorkspace />
      </FirebaseErrorBoundary>
    </ThemeLocaleProvider>
  );
}
