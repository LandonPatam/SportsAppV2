import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  theme?: 'default' | 'nfl' | 'nba';
}

export function PageLayout({ title, children, theme = 'default' }: PageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('sidebarExpanded') === 'true';
  });

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar theme={theme} onHoverChange={setSidebarOpen} />
      <main
        className="flex-1 min-h-screen px-6 py-6 overflow-x-hidden transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 120 : 14 }}
      >
        {title && <h1 className="text-2xl font-bold mb-6">{title}</h1>}
        {children}
      </main>
    </div>
  );
}
