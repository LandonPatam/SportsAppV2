import React from 'react';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  theme?: 'default' | 'nba' | 'nfl';
}

export function PageLayout({ title, children, theme = 'default' }: PageLayoutProps) {
  return (
    <div className="flex-1 min-h-screen px-6 py-6 overflow-x-hidden">
      {title && <h1 className="text-2xl font-bold mb-6">{title}</h1>}
      {children}
    </div>
  );
}