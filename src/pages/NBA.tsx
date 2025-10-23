import React, { useState, useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X } from 'lucide-react';
import nbaData from '../nba_team_stats.json';
import nbaPlayerData from '../nba_player_stats.json';



interface NBATeam {
  TEAM_ID: number;
  TEAM_NAME: string;
  GP: number;
  W: number;
  L: number;
  WIN_PCT: number;
  PTS: number;
  REB: number;
  AST: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
  conference?: string;
  division?: string;
}

interface Player {
  PLAYER_ID: number;
  PLAYER_NAME: string;
  TEAM_ID: number;
  TEAM_ABBREVIATION: string;
  JERSEY_NUMBER: string;
  GP: number;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  TOV: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
  FGA: number;
  FG3A: number;
  FTA: number;
}

// Team conference/division mapping
const teamConferences: Record<string, { conference: string; division: string }> = {
  'Oklahoma City Thunder': { conference: 'Western', division: 'Northwest' },
  'Cleveland Cavaliers': { conference: 'Eastern', division: 'Central' },
  'Boston Celtics': { conference: 'Eastern', division: 'Atlantic' },
  'Houston Rockets': { conference: 'Western', division: 'Southwest' },
  'New York Knicks': { conference: 'Eastern', division: 'Atlantic' },
  'LA Clippers': { conference: 'Western', division: 'Pacific' },
  'Los Angeles Lakers': { conference: 'Western', division: 'Pacific' },
  'Indiana Pacers': { conference: 'Eastern', division: 'Central' },
  'Denver Nuggets': { conference: 'Western', division: 'Northwest' },
  'Minnesota Timberwolves': { conference: 'Western', division: 'Northwest' },
  'Memphis Grizzlies': { conference: 'Western', division: 'Southwest' },
  'Golden State Warriors': { conference: 'Western', division: 'Pacific' },
  'Milwaukee Bucks': { conference: 'Eastern', division: 'Central' },
  'Detroit Pistons': { conference: 'Eastern', division: 'Central' },
  'Orlando Magic': { conference: 'Eastern', division: 'Southeast' },
  'Atlanta Hawks': { conference: 'Eastern', division: 'Southeast' },
  'Sacramento Kings': { conference: 'Western', division: 'Pacific' },
  'Chicago Bulls': { conference: 'Eastern', division: 'Central' },
  'Dallas Mavericks': { conference: 'Western', division: 'Southwest' },
  'Miami Heat': { conference: 'Eastern', division: 'Southeast' },
  'Portland Trail Blazers': { conference: 'Western', division: 'Northwest' },
  'Phoenix Suns': { conference: 'Western', division: 'Pacific' },
  'San Antonio Spurs': { conference: 'Western', division: 'Southwest' },
  'Toronto Raptors': { conference: 'Eastern', division: 'Atlantic' },
  'Brooklyn Nets': { conference: 'Eastern', division: 'Atlantic' },
  'Philadelphia 76ers': { conference: 'Eastern', division: 'Atlantic' },
  'New Orleans Pelicans': { conference: 'Western', division: 'Southwest' },
  'Charlotte Hornets': { conference: 'Eastern', division: 'Southeast' },
  'Washington Wizards': { conference: 'Eastern', division: 'Southeast' },
  'Utah Jazz': { conference: 'Western', division: 'Northwest' }
};


const teamColors: Record<string, { primary: string; secondary: string }> = {
  ATL: { primary: '#E03A3E', secondary: '#C1D32F' }, // Hawks
  BOS: { primary: '#007A33', secondary: '#BA9653' }, // Celtics
  BKN: { primary: '#000000', secondary: '#000000ff' }, // Nets
  CHA: { primary: '#1D1160', secondary: '#00788C' }, // Hornets
  CHI: { primary: '#CE1141', secondary: '#000000' }, // Bulls
  CLE: { primary: '#6F263D', secondary: '#FFB81C' }, // Cavs
  DAL: { primary: '#00538C', secondary: '#002B5E' }, // Mavs
  DEN: { primary: '#0E2240', secondary: '#FEC524' }, // Nuggets
  DET: { primary: '#C8102E', secondary: '#006BB6' }, // Pistons
  GSW: { primary: '#1D428A', secondary: '#FFC72C' }, // Warriors
  HOU: { primary: '#CE1141', secondary: '#C4CED4' }, // Rockets
  IND: { primary: '#002D62', secondary: '#FDBB30' }, // Pacers
  LAC: { primary: '#C8102E', secondary: '#1D428A' }, // Clippers
  LAL: { primary: '#552583', secondary: '#FDB927' }, // Lakers
  MEM: { primary: '#5D76A9', secondary: '#12173F' }, // Grizzlies
  MIA: { primary: '#98002E', secondary: '#F9A01B' }, // Heat
  MIL: { primary: '#00471B', secondary: '#edc87fff' }, // Bucks
  MIN: { primary: '#0C2340', secondary: '#236192' }, // Timberwolves
  NOP: { primary: '#0C2340', secondary: '#C8102E' }, // Pelicans
  NYK: { primary: '#006BB6', secondary: '#F58426' }, // Knicks
  OKC: { primary: '#007AC1', secondary: '#EF3B24' }, // Thunder
  ORL: { primary: '#0077C0', secondary: '#C4CED4' }, // Magic
  PHI: { primary: '#006BB6', secondary: '#ED174C' }, // 76ers
  PHX: { primary: '#1D1160', secondary: '#E56020' }, // Suns
  POR: { primary: '#E03A3E', secondary: '#000000' }, // Trail Blazers
  SAC: { primary: '#5A2D81', secondary: '#63727A' }, // Kings
  SAS: { primary: '#C4CED4', secondary: '#000000' }, // Spurs
  TOR: { primary: '#CE1141', secondary: '#000000' }, // Raptors
  UTA: { primary: '#002B5C', secondary: '#F9A01B' }, // Jazz
  WAS: { primary: '#002B5C', secondary: '#E31837' }, // Wizards
};


const teamAbbreviations: Record<string, string> = {
  'Atlanta Hawks': 'ATL',
  'Boston Celtics': 'BOS',
  'Brooklyn Nets': 'BKN',
  'Charlotte Hornets': 'CHA',
  'Chicago Bulls': 'CHI',
  'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL',
  'Denver Nuggets': 'DEN',
  'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GSW',
  'Houston Rockets': 'HOU',
  'Indiana Pacers': 'IND',
  'LA Clippers': 'LAC',
  'Los Angeles Lakers': 'LAL',
  'Memphis Grizzlies': 'MEM',
  'Miami Heat': 'MIA',
  'Milwaukee Bucks': 'MIL',
  'Minnesota Timberwolves': 'MIN',
  'New Orleans Pelicans': 'NOP',
  'New York Knicks': 'NYK',
  'Oklahoma City Thunder': 'OKC',
  'Orlando Magic': 'ORL',
  'Philadelphia 76ers': 'PHI',
  'Phoenix Suns': 'PHX',
  'Portland Trail Blazers': 'POR',
  'Sacramento Kings': 'SAC',
  'San Antonio Spurs': 'SAS',
  'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA',
  'Washington Wizards': 'WAS',
};


const PlayerCard = ({ player, index }: { player: Player; index: number }) => {
  return (
    <Card 
      className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm"
      style={{
        animation: `slideUp 0.4s ease-out ${index * 0.05}s both`
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-bold">{player.PLAYER_NAME}</CardTitle>
<Badge
  variant="outline"
  className="text-xs font-semibold border mt-1"
  style={{
    backgroundColor: 'transparent',
    color: teamColors[player.TEAM_ABBREVIATION]?.secondary || '#fff',
    borderColor: teamColors[player.TEAM_ABBREVIATION]?.primary || '#888',
    borderWidth: '2px',
    padding: '0.25rem 0.5rem',
    letterSpacing: '0.5px',
  }}
>
  {player.TEAM_ABBREVIATION}
</Badge>
          </div>
          <Badge variant="outline">
            #{player.JERSEY_NUMBER}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">PPG</span>
              <span className="font-semibold">{player.PTS.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">RPG</span>
              <span className="font-semibold">{player.REB.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">APG</span>
              <span className="font-semibold">{player.AST.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">STL</span>
              <span className="font-semibold">{player.STL.toFixed(1)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">FG%</span>
              <span className="font-semibold">{(player.FG_PCT * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">3P%</span>
              <span className="font-semibold">{(player.FG3_PCT * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">FT%</span>
              <span className="font-semibold">{(player.FT_PCT * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">BLK</span>
              <span className="font-semibold">{player.BLK.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const PlayerModal = ({ team, onClose }: { team: NBATeam; onClose: () => void }) => {
  const players: Player[] = nbaPlayerData[team.TEAM_ID.toString()] || [];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
      onClick={onClose}
      style={{
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        className="relative bg-background rounded-2xl shadow-2xl max-w-6xl w-full max-h-[85vh] overflow-hidden border"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'scaleIn 0.25s ease-out'
        }}
      >
        <div className="sticky top-0 bg-background border-b p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-3xl font-bold">{team.TEAM_NAME}</h2>
            <p className="text-muted-foreground mt-1">
              {team.W}-{team.L} • {team.division} Division • {(team.WIN_PCT * 100).toFixed(1)}% Win Rate
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
          <h3 className="text-xl font-semibold mb-4">Roster ({players.length} Players)</h3>
          {players.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map((player, index) => (
                <PlayerCard key={player.PLAYER_ID} player={player} index={index} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No player data available for this team
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

const TeamCard = ({ team, onClick }: { team: NBATeam; onClick?: () => void }) => {
  const winPercentage = (team.WIN_PCT * 100).toFixed(1);

  // Get team abbreviation using explicit mapping
  const teamAbbr = teamAbbreviations[team.TEAM_NAME] || 'UNK';
  const teamColor = teamColors[teamAbbr as keyof typeof teamColors];

  return (
    <Card
      className={`overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-bold">{team.TEAM_NAME}</CardTitle>
            <Badge
              variant="outline"
              className="text-xs font-semibold border mt-1"
              style={{
                backgroundColor: 'transparent',
                color: teamColor?.secondary || '#ccc',
                borderColor: teamColor?.primary || '#888',
                borderWidth: '2px',
                padding: '0.25rem 0.5rem',
                letterSpacing: '0.5px',
              }}
            >
              {teamAbbr}
            </Badge>
          </div>

          <Badge variant={team.W > team.L ? 'default' : 'secondary'}>
            {team.W}-{team.L}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Win %</span>
              <span className="font-semibold">{winPercentage}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">PPG</span>
              <span className="font-semibold">{team.PTS.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">RPG</span>
              <span className="font-semibold">{team.REB.toFixed(1)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">APG</span>
              <span className="font-semibold">{team.AST.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">FG%</span>
              <span className="font-semibold">{(team.FG_PCT * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">3P%</span>
              <span className="font-semibold">{(team.FG3_PCT * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};



const NBA = () => {
  const [nbaTeams, setNbaTeams] = useState<NBATeam[]>([]);
  const [selectedConference, setSelectedConference] = useState<'all' | 'Eastern' | 'Western'>('all');
  const [selectedTeam, setSelectedTeam] = useState<NBATeam | null>(null);

  useEffect(() => {
    const teamsWithConference = nbaData.map(team => ({
      ...team,
      conference: teamConferences[team.TEAM_NAME]?.conference || 'Unknown',
      division: teamConferences[team.TEAM_NAME]?.division || 'Unknown'
    }));

    setNbaTeams(teamsWithConference);
  }, []);

  const sortTeamsByRecord = (teams: NBATeam[]) => {
    return [...teams].sort((a, b) => {
      if (b.WIN_PCT !== a.WIN_PCT) return b.WIN_PCT - a.WIN_PCT;
      if (b.W !== a.W) return b.W - a.W;
      return b.PTS - a.PTS;
    });
  };

  const getFilteredTeams = () => {
    if (selectedConference === 'all') return nbaTeams;
    return nbaTeams.filter(team => team.conference === selectedConference);
  };

  const getDivisionTeams = (division: string) => {
    return getFilteredTeams()
      .filter(team => team.division === division)
      .sort((a, b) => b.WIN_PCT - a.WIN_PCT);
  };

  if (nbaTeams.length === 0) {
    return (
      <PageLayout title="NBA Team Standings - 2024-25 Season">
        <div>Loading...</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="NBA Team Standings - 2024-25 Season">
      <Tabs defaultValue="all" className="w-full" onValueChange={(value) => setSelectedConference(value as any)}>
          <TabsList className="grid w-full max-w-lg grid-cols-4 mb-6">
          <TabsTrigger value="all">All Teams</TabsTrigger>
          <TabsTrigger value="Eastern">Eastern</TabsTrigger>
          <TabsTrigger value="Western">Western</TabsTrigger>
          <TabsTrigger value="top-scorers">Top Scorers</TabsTrigger>
        </TabsList>

        {/* ===== ALL TEAMS TAB ===== */}
        <TabsContent value="all">
          <h2 className="text-2xl font-bold mb-4">All Teams</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {sortTeamsByRecord(nbaTeams).map((team, index) => (
              <TeamCard key={team.TEAM_ID} team={{ ...team, rank: index + 1 }} onClick={() => setSelectedTeam(team)} />
            ))}
          </div>
        </TabsContent>

        {/* ===== EASTERN CONFERENCE ===== */}
        <TabsContent value="Eastern" className="space-y-6">
          {['Atlantic', 'Central', 'Southeast'].map(division => {
            const divisionTeams = getDivisionTeams(division);
            if (divisionTeams.length === 0) return null;

            return (
              <div key={division}>
                <h3 className="text-lg font-semibold mb-3">Eastern {division}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {divisionTeams.map(team => (
                    <TeamCard key={team.TEAM_ID} team={team} onClick={() => setSelectedTeam(team)} />
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* ===== WESTERN CONFERENCE ===== */}
        <TabsContent value="Western" className="space-y-6">
          {['Northwest', 'Pacific', 'Southwest'].map(division => {
            const divisionTeams = getDivisionTeams(division);
            if (divisionTeams.length === 0) return null;

            return (
              <div key={division}>
                <h3 className="text-lg font-semibold mb-3">Western {division}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {divisionTeams.map(team => (
                    <TeamCard key={team.TEAM_ID} team={team} onClick={() => setSelectedTeam(team)} />
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>

          {/* ===== TOP SCORERS TAB ===== */}
<TabsContent value="top-scorers">
  <h2 className="text-2xl font-bold mb-4">Top 50 Scorers</h2>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Object.values(nbaPlayerData)
      .flat() // merge all teams’ players into one array
      .sort((a, b) => b.PTS - a.PTS) // sort by PPG descending
      .slice(0, 50) // take top 50
      .map((player: Player, index) => (
        <Card
          key={player.PLAYER_ID}
          className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm"
          style={{ animation: `slideUp 0.4s ease-out ${index * 0.05}s both` }}
        >
          <CardHeader className="pb-3">
  <div className="flex items-start justify-between">
    <div>
      <CardTitle className="text-lg font-bold">
        #{index + 1} {player.PLAYER_NAME}
      </CardTitle>
      <Badge
  variant="outline"
  className="text-xs font-semibold border mt-1"
  style={{
    backgroundColor: 'transparent',
    color: teamColors[player.TEAM_ABBREVIATION]?.secondary || 'inherit',
    borderColor: teamColors[player.TEAM_ABBREVIATION]?.primary || '#ccc',
    borderWidth: '2px',
    padding: '0.25rem 0.5rem',
    letterSpacing: '0.5px',
  }}
>
  {player.TEAM_ABBREVIATION}
</Badge>


    </div>
    <Badge
  className="text-xs font-semibold mt-1 bg-blue-600 text-white border-blue-700"
  style={{
    letterSpacing: '0.3px',
    padding: '0.25rem 0.5rem',
  }}
>
  PTS: {player.PTS.toFixed(0)} | PPG: {(player.PTS / player.GP).toFixed(1)}
</Badge>


  </div>
</CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">REB</span>
                  <span className="font-semibold">{player.REB.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">AST</span>
                  <span className="font-semibold">{player.AST.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">STL</span>
                  <span className="font-semibold">{player.STL.toFixed(1)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">FG%</span>
                  <span className="font-semibold">{(player.FG_PCT * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">3P%</span>
                  <span className="font-semibold">{(player.FG3_PCT * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">FT%</span>
                  <span className="font-semibold">{(player.FT_PCT * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
  </div>
</TabsContent>





      </Tabs>

      {selectedTeam && (
        <PlayerModal team={selectedTeam} onClose={() => setSelectedTeam(null)} />
      )}
    </PageLayout>
  );
};


export default NBA;