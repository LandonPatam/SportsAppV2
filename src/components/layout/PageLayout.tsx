import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function PageLayout({ children, title }: PageLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 p-4 lg:p-6 animate-fade-in overflow-x-hidden">
        <h1 className="text-2xl font-bold mb-6">{title}</h1>
        {children}
      </main>
    </div>
  );
}
