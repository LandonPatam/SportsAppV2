import React from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link, useLocation } from 'react-router-dom';

const currentDate = new Date();
const month = currentDate.toLocaleString('default', { month: 'long' });
const year = currentDate.getFullYear();

/* ============================================================================
 * ICONS — stylistically consistent but slightly varied
 * ============================================================================ */

// 🏈 NFL — football shape with stitches
const FootballIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="12" cy="12" rx="10" ry="6" stroke="currentColor" strokeWidth="2" />
    <path d="M8 12h8M10 10l4 4M10 14l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 🏎️ F1 — simplified racing tire with motion lines
const F1Icon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" />
    <path
      d="M4 10h3M4 14h3M17 10h3M17 14h3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

// 🥊 UFC — octagon outline (subtle nod to the cage)
const UFCIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon
      points="9,3 15,3 21,9 21,15 15,21 9,21 3,15 3,9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path d="M8 8l8 8M8 16l8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// 🏀 NBA — balanced basketball icon (contained within circle)
const NBAIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
    {/* Vertical line */}
    <path d="M12 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* Horizontal line */}
    <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* Curved internal arcs */}
    <path
      d="M6.5 6.5c3 2.5 3 8.5 0 11M17.5 6.5c-3 2.5-3 8.5 0 11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

// Simple beaker icon for Playground/Lab
const LabIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 3h6M10 3v5l-5 9a3 3 0 002.6 4.5h8.8A3 3 0 0019 17l-5-9V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);


/* ============================================================================
 * SIDEBAR COMPONENT
 * ============================================================================ */

interface SidebarProps {
  className?: string;
}

interface NavItem {
  title: string;
  icon: React.ElementType;
  href: string;
}

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();

  const navItems: NavItem[] = [
    { title: 'NFL', icon: FootballIcon, href: '/nfl' },
    { title: 'F1', icon: F1Icon, href: '/f1' },
    { title: 'UFC', icon: UFCIcon, href: '/ufc' },
    { title: 'NBA', icon: NBAIcon, href: '/nba' },
  ];

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-screen w-[100px] z-40 flex flex-col justify-between',
        'backdrop-blur-lg bg-[rgba(0, 0, 0, 0.85)] border-r border-white/10 shadow-[inset_0_0_30px_rgba(255,255,255,0.06)]',
        className
      )}
    >
      {/* === NAVIGATION === */}
      <nav className="flex flex-col flex-1 justify-between py-6">
        <div className="flex flex-col flex-1 gap-4 px-2">
          {navItems.map((item, index) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={index}
                to={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 w-full flex-1 py-6 rounded-lg',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.03] hover:shadow-[0_0_10px_rgba(255,255,255,0.15)]',
                  isActive
                    ? 'bg-gradient-to-b from-white-500/80 to-purple-500/80 text-white ring-1 ring-white/30 shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                    : 'bg-[rgba(0, 0, 0, 1)] text-white/70 hover:bg-[rgba(255, 255, 255, 1)]'
                )}
              >
                <item.icon
                  className={cn(
                    'h-7 w-7 transition-all duration-300',
                    isActive
                      ? 'text-white drop-shadow-[0_0_0px_rgba(255,255,255,0.6)]'
                      : 'text-white/80 group-hover:text-white'
                  )}
                />
                <span
                  className={cn(
                    'text-xs font-semibold tracking-wide',
                    isActive ? 'text-white' : 'text-white/70'
                  )}
                >
                  {item.title}
                </span>
              </Link>
            );
          })}
        </div>

        {/* === FOOTER (Month/Year) === */}
        <div className="p-2 mt-auto">
          <div
            className="
              flex flex-col items-center justify-center
              rounded-lg 
              text-white/90
              shadow-[0_0_0px_rgba(0,0,0,0.4)]
              w-full aspect-square
              text-center text-[11px] font-medium
              select-none
            "
          >
            <p className="text-sm font-semibold">{month}</p>
            <p className="text-[10px] leading-none opacity-90">{year}</p>
          </div>
        </div>
      </nav>
    </aside>
  );
}

