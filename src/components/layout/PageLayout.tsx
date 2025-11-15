import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  theme?: 'nfl' | 'nba';
}

const themeClasses: Record<string, string> = {
  nfl: 'bg-gradient-to-r from-blue-900 via-indigo-800 to-blue-600',
  nba: 'bg-gradient-to-r from-red-600 via-purple-600 to-blue-600',
  default: 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800',
};

export function PageLayout({ title, children, theme = 'default' }: PageLayoutProps) {
  const headerGradient = themeClasses[theme] || themeClasses.default;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main
        className="flex-1 ml-[100px] min-h-screen px-6 py-6 w-[calc(100vw-120px)] overflow-x-hidden"
      >
        {children}
      </main>
    </div>
  );
}
