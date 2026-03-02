import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isNBA = location.pathname.startsWith('/nba');

  const handleToggle = () => {
    if (isNBA) {
      navigate('/nfl');
    } else {
      navigate('/nba');
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Persistent Toggle Slider - stays mounted during route changes */}
      <div className="fixed top-6 left-6 z-50">
        <button
          onClick={handleToggle}
          className="relative inline-flex h-11 w-20 items-center rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background shadow-lg overflow-hidden"
          style={{
            background: isNBA 
              ? 'linear-gradient(to right, rgba(98, 0, 164, 0.95), rgba(0, 241, 246, 0.95))' 
              : 'linear-gradient(to right, #ff7979, #ffca58',
            transition: 'background 0.5s ease-in-out'
          }}
        >
          {/* Sliding white circle */}
          <span
            className="absolute inline-block h-8 w-8 rounded-full bg-white shadow-lg"
            style={{
              left: isNBA ? '44px' : '4px',
              transition: 'left 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
          {/* NFL Label */}
          <span
            className="absolute left-2 text-xs font-bold text-white pointer-events-none z-10"
            style={{
              opacity: isNBA ? 0.6 : 1,
              transition: 'opacity 0.3s ease-in-out'
            }}
          >
          </span>
          {/* NBA Label */}
          <span
            className="absolute right-2 text-xs font-bold text-white pointer-events-none z-10"
            style={{
              opacity: isNBA ? 1 : 0.6,
              transition: 'opacity 0.3s ease-in-out'
            }}
          >
          </span>
        </button>
      </div>

      {/* Main Content - routes render here */}
      {children}
    </div>
  );
}
