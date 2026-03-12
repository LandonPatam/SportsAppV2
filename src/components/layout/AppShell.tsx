import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const pages = ['/nba', '/f1', '/nfl'] as const;
  type Page = typeof pages[number];

  const currentIndex = pages.findIndex(p => location.pathname.startsWith(p));
  const activeIndex = currentIndex === -1 ? 1 : currentIndex;

  const backgrounds: Record<Page, string> = {
    '/nfl': 'linear-gradient(to right, #95f9c3, #0b3866)',
    '/nba': 'linear-gradient(to right, rgba(98, 0, 164, 0.81), rgba(0, 241, 246, 0.81))',
    '/f1': 'linear-gradient(to right, #2dd4bf, #fb809f)',
  };

  const pageLabels: Record<Page, string> = {
    '/nba': 'NBA',
    '/f1': 'F1',
    '/nfl': 'NFL',
  };

  // knob: left=NBA(0), middle=F1(1), right=NFL(2)
  // w-28 = 112px, knob = 32px, padding = 4px each side → travel = 72px
  const knobLeft = activeIndex === 0 ? '4px' : activeIndex === 1 ? '40px' : '76px';

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

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;
    if (x < third) {
      navigate('/nba');
    } else if (x < third * 2) {
      navigate('/f1');
    } else {
      navigate('/nfl');
    }
  };

  const handleKnobClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = pages[(activeIndex + 1) % pages.length];
    navigate(next);
  };

  const handleMobileSquareClick = () => {
    const next = pages[(activeIndex + 1) % pages.length];
    navigate(next);
  };

  const activePage = pages[activeIndex];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop: Persistent Toggle Slider */}
      {!isMobile && (
        <div className="fixed top-6 left-6 z-50">
          <button
            onClick={handleClick}
            className="relative inline-flex h-11 w-28 items-center rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background shadow-lg overflow-hidden"
            style={{
              background: backgrounds[activePage],
              transition: 'background 0.5s ease-in-out'
            }}
          >
            {/* Sliding white circle */}
            <span
              className="absolute inline-block h-8 w-8 rounded-full bg-white shadow-lg cursor-pointer z-10"
              style={{
                left: knobLeft,
                transition: 'left 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onClick={handleKnobClick}
            />
          </button>
        </div>
      )}

      {/* Mobile: Rounded Square Page Switcher */}
      {isMobile && (
        <div className="fixed top-5 left-4 z-50">
          <button
            onClick={handleMobileSquareClick}
            className="relative flex items-center justify-center focus:outline-none active:scale-95"
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '18px',
              background: backgrounds[activePage],
              transition: 'background 0.4s ease-in-out, transform 0.15s ease',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            }}
            aria-label={`Switch page, current: ${pageLabels[activePage]}`}
          >
            <span
              className="text-white font-bold tracking-wide select-none"
              style={{
                fontSize: '13px',
                letterSpacing: '0.05em',
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
            >
              {pageLabels[activePage]}
            </span>
          </button>
        </div>
      )}

      {/* Main Content - routes render here */}
      {children}
    </div>
  );
}