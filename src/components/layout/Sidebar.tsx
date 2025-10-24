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
    'sticky top-0 self-start h-screen overflow-y-auto w-[8vw] min-w-[80px] max-w-[128px] flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border'
  )}
>

  <ScrollArea className="flex-1 py-4">
    <nav className="flex flex-col gap-2 px-2 h-full">
      {navItems.map((item, index) => {
        const isActive = location.pathname.startsWith(item.href);
        return (
          <Link
            key={index}
            to={item.href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-2 rounded-md py-8 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground'
            )}
          >
            <item.icon className="h-6 w-6 shrink-0" />
            <span className="text-sm font-medium">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  </ScrollArea>

  {/* Footer */}
  <div className="p-2 border-t border-sidebar-border">
    <div className="rounded-md bg-sidebar-accent/50 p-2 text-[10px] text-sidebar-accent-foreground text-center">
      <p className="font-medium">{month}</p>
      <p className="text-[9px]">{year}</p>
    </div>
  </div>
</aside>



  );
}
