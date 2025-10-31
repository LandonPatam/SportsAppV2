import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function PageLayout({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main
  className="
    flex-1
    ml-[100px]
    min-h-screen
    px-6 py-6
    w-[calc(100vw-120px)]
    overflow-x-hidden
  "
>
  {title && <h1 className="text-2xl font-bold mb-6">{title}</h1>}
  {children}
</main>

    </div>
  );
}

