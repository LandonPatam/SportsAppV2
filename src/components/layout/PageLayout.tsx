import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  theme?: 'default' | 'nba' | 'nfl' | 'f1';
}

export function PageLayout({ title, children, theme = 'default' }: PageLayoutProps) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 && window.innerHeight > window.innerWidth
  );
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640 && window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  return (
    <div
      className="flex-1 min-h-screen overflow-x-hidden"
      style={{
        paddingTop: isMobile ? '0' : '1.5rem',
        paddingBottom: '1.5rem',
        paddingLeft: isMobile ? '0' : '1.5rem',
        paddingRight: isMobile ? '0' : '1.5rem',
      }}
    >
      {title && <h1 className="text-2xl font-bold mb-6">{title}</h1>}
      {children}
    </div>
  );
}