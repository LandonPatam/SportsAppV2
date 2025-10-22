
import React from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link, useLocation } from 'react-router-dom';

const FootballIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.5 8.5C21.5 10.5 21.5 13.5 20.5 15.5L15.5 20.5C13.5 21.5 10.5 21.5 8.5 20.5L3.5 15.5C2.5 13.5 2.5 10.5 3.5 8.5L8.5 3.5C10.5 2.5 13.5 2.5 15.5 3.5L20.5 8.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 9L15 15M9 15L15 9M12 7V9M12 15V17M7 12H9M15 12H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TireIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
    <path d="M12 3V7M12 17V21M3 12H7M17 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M5.64 5.64L8.46 8.46M15.54 15.54L18.36 18.36M5.64 18.36L8.46 15.54M15.54 8.46L18.36 5.64" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

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
  
  const navItems = [
    {
      title: 'NFL',
      icon: FootballIcon,
      href: '/nfl',
    },
    {
      title: 'F1',
      icon: TireIcon,
      href: '/f1',
    },
    {
      title: 'UFC',
      icon: TireIcon,
      href: '/ufc',
    },
    {
      title: 'NBA',
      icon: TireIcon,
      href: '/nba',
    }



  ];

  return (
    <aside className={cn(
      "bg-sidebar text-sidebar-foreground w-32 flex flex-col border-r border-sidebar-border fixed left-0 top-0 h-screen",
      className
    )}>
      
      <ScrollArea className="flex-1 py-4">
        <nav className="flex flex-col gap-2 px-2 h-full">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={index}
                to={item.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-2 rounded-md py-8 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground"
                )}
              >
                <item.icon className="h-6 w-6 shrink-0" />
                <span className="text-sm font-medium">
                  {item.title}
                </span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      
      <div className="p-2 border-t border-sidebar-border">
        <div className="rounded-md bg-sidebar-accent/50 p-2 text-[10px] text-sidebar-accent-foreground text-center">
          <p className="font-medium">Week 7</p>
          <p className="text-[9px]">2024-25</p>
        </div>
      </div>
    </aside>
  );
}
