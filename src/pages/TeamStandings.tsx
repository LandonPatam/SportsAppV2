import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area'; // Ensure you have this or use a normal div

const TEAM_CONFERENCES: Record<string, 'West' | 'East'> = {
  ATL: 'East', BOS: 'East', BKN: 'East', CHA: 'East', CHI: 'East',
  CLE: 'East', DET: 'East', IND: 'East', MIA: 'East', MIL: 'East',
  NYK: 'East', ORL: 'East', PHI: 'East', TOR: 'East', WAS: 'East',
  DAL: 'West', DEN: 'West', GSW: 'West', HOU: 'West', LAC: 'West',
  LAL: 'West', MEM: 'West', MIN: 'West', NOP: 'West', OKC: 'West',
  PHX: 'West', POR: 'West', SAC: 'West', SAS: 'West', UTA: 'West',
};

const TeamStandings = ({ 
  recordMap, 
  logoMap, 
  onTeamFocus 
}: { 
  recordMap: Record<string, string>;
  logoMap: Record<string, string>;
  onTeamFocus?: (info: { teamAbbr: string }) => void;
}) => {
  
  const standings = React.useMemo(() => {
    const allTeams = Object.keys(TEAM_CONFERENCES);
    
    // Create sortable team objects
    const teams = allTeams.map((abbr) => {
      const rec = recordMap[abbr] || '0-0';
      const [w, l] = rec.split('-').map(Number);
      const winPct = (w + l) > 0 ? w / (w + l) : 0;
      return { abbr, rec, winPct, conf: TEAM_CONFERENCES[abbr] };
    });

    // Sort by Win % (High to Low)
    teams.sort((a, b) => b.winPct - a.winPct);

    return {
      east: teams.filter(t => t.conf === 'East'),
      west: teams.filter(t => t.conf === 'West')
    };
  }, [recordMap]);

  const ConferenceColumn = ({ title, teams }: { title: string, teams: typeof standings.east }) => (
    <div className="flex flex-col h-[calc(100vh-200px)] border rounded-xl overflow-hidden bg-card/40">
      <div className="p-3 bg-muted/50 border-b font-bold text-muted-foreground text-center uppercase tracking-widest text-xs">
        {title}
      </div>
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/50">
          {teams.map((t, i) => (
            <div 
              key={t.abbr} 
              onClick={() => onTeamFocus?.({ teamAbbr: t.abbr })}
              className="flex items-center justify-between p-3 hover:bg-accent/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-muted-foreground w-6 text-center text-sm">{i + 1}</span>
                <div className="w-8 h-8 relative">
                   {logoMap[t.abbr] && <img src={logoMap[t.abbr]} alt={t.abbr} className="w-full h-full object-contain" />}
                </div>
                <span className="font-bold text-sm">{t.abbr}</span>
              </div>
              <span className="font-mono text-sm font-medium mr-2">{t.rec.replace('-', ' - ')}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
      <ConferenceColumn title="Western Conference" teams={standings.west} />
      <ConferenceColumn title="Eastern Conference" teams={standings.east} />
    </div>
  );
};

export default TeamStandings;