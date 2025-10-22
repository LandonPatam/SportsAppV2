
import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function PageLayout({ children, title }: PageLayoutProps) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <main className="flex-1 ml-32">
        <div className="container max-w-full p-4 lg:p-6 animate-fade-in">
          <h1 className="text-2xl font-bold mb-6">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
