import React, { useState, useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ufcData from '../ufc_rankings.json';

interface Fighter {
  rank: number;
  name: string;
  nationality: string;
  champion: boolean;
  url: string;
  headshot_url?: string;
  flag_url?: string;
}

interface Division {
  total_fighters: number;
  top_ranked: Fighter[];
}

const FighterCard = ({ fighter, divisionName }: { fighter: Fighter; divisionName: string }) => {
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {fighter.headshot_url && (
                <img 
                  src={fighter.headshot_url} 
                  alt={fighter.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-border"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div>
                <CardTitle className="text-base font-bold leading-tight">{fighter.name}</CardTitle>
                <div className="flex items-center gap-1 mt-1">
                  {fighter.flag_url && (
                    <img 
                      src={fighter.flag_url} 
                      alt={fighter.nationality}
                      className="w-5 h-4 object-cover border border-border"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <span className="text-xs text-muted-foreground">{fighter.nationality}</span>
                </div>
              </div>
            </div>
          </div>
          <Badge 
            className={`${
              fighter.champion
                ? 'bg-yellow-500 text-black hover:bg-yellow-600'
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            {fighter.champion ? '🏆' : `#${fighter.rank}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className="font-semibold">
              {fighter.champion ? 'Champion' : `Ranked #${fighter.rank}`}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Division</span>
            <span className="font-semibold text-xs">
              {divisionName.replace('Mens ', '').replace('Womens ', '')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};


import { Sun, Moon } from 'lucide-react';

const DarkModeToggle = () => {
  const [darkMode, setDarkMode] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (!stored && prefersDark);
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  // When user toggles it
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleDarkMode}
      className="p-2 rounded-md transition-all duration-200 hover:bg-accent flex items-center justify-center"
      title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {darkMode ? (
        <Sun className="w-5 h-5 text-yellow-400" />
      ) : (
        <Moon className="w-5 h-5 text-blue-400" />
      )}
    </button>
  );
};

const UFC = () => {
  const [divisions, setDivisions] = useState<Record<string, Division>>({});

  useEffect(() => {
    setDivisions(ufcData);
  }, []);

  const getFilteredDivisions = (gender: 'mens' | 'womens' | 'all') => {
  const entries = Object.entries(divisions);
  if (gender === 'all') return entries;
  return entries.filter(([name]) =>
    gender === 'mens' ? name.toLowerCase().startsWith('mens') : name.toLowerCase().startsWith('womens')
  );
};


  const sortDivisions = (divisionEntries: [string, Division][]) => {
    return divisionEntries.sort((a, b) => {
      const weightA = parseInt(a[0].match(/\d+/)?.[0] || '0');
      const weightB = parseInt(b[0].match(/\d+/)?.[0] || '0');
      return weightB - weightA;
    });
  };

  return (
    <PageLayout title="UFC Rankings - Top Fighters by Division">
      <div className="flex justify-end">
  <DarkModeToggle />
</div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
          <TabsTrigger value="all">All Divisions</TabsTrigger>
          <TabsTrigger value="mens">Men's</TabsTrigger>
          <TabsTrigger value="womens">Women's</TabsTrigger>
        </TabsList>

        {['all', 'mens', 'womens'].map(tab => {
          const filteredDivisions = sortDivisions(getFilteredDivisions(tab as 'all' | 'mens' | 'womens'));
          if (filteredDivisions.length === 0) return null;

          return (
            <TabsContent key={tab} value={tab} className="space-y-8">
              {filteredDivisions.map(([divisionName, divisionData]) => {
                const topFighters = divisionData.top_ranked.slice(0, 5);
                return (
                  <div key={divisionName} className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
                      {divisionName} ({divisionData.total_fighters} fighters)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {topFighters.map(fighter => (
                        <FighterCard
                          key={`${divisionName}-${fighter.rank}`}
                          fighter={fighter}
                          divisionName={divisionName}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </TabsContent>
          );
        })}
      </Tabs>
    </PageLayout>
  );
};


export default UFC;