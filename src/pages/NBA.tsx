import React, { useState, useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import nbaData from '../nba_team_stats.json';

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

const TeamCard = ({ team }: { team: NBATeam }) => {
  const winPercentage = (team.WIN_PCT * 100).toFixed(1);
  
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-bold">{team.TEAM_NAME}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{team.division} Division</p>
          </div>
          <Badge variant={team.W > team.L ? "default" : "secondary"}>
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

  useEffect(() => {
    // Add conference and division to each team
    const teamsWithConference = nbaData.map(team => ({
      ...team,
      conference: teamConferences[team.TEAM_NAME]?.conference || 'Unknown',
      division: teamConferences[team.TEAM_NAME]?.division || 'Unknown'
    }));
    
    setNbaTeams(teamsWithConference);
  }, []);

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
    return <PageLayout title="NBA Team Standings - 2024-25 Season"><div>Loading...</div></PageLayout>;
  }

  return (
    <PageLayout title="NBA Team Standings - 2024-25 Season">
      <Tabs defaultValue="all" className="w-full" onValueChange={(value) => setSelectedConference(value as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
          <TabsTrigger value="all">All Teams</TabsTrigger>
          <TabsTrigger value="Eastern">Eastern</TabsTrigger>
          <TabsTrigger value="Western">Western</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-8">
          {['Eastern', 'Western'].map(conference => (
            <div key={conference}>
              <h2 className="text-2xl font-bold mb-4">{conference} Conference</h2>
              {['Atlantic', 'Central', 'Southeast', 'Northwest', 'Pacific', 'Southwest'].map(division => {
                const divisionTeams = nbaTeams.filter(
                  team => team.conference === conference && team.division === division
                ).sort((a, b) => b.WIN_PCT - a.WIN_PCT);

                if (divisionTeams.length === 0) return null;

                return (
                  <div key={`${conference}-${division}`} className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-muted-foreground">{conference} {division}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {divisionTeams.map(team => (
                        <TeamCard key={team.TEAM_ID} team={team} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="Eastern" className="space-y-6">
          {['Atlantic', 'Central', 'Southeast'].map(division => {
            const divisionTeams = getDivisionTeams(division);
            if (divisionTeams.length === 0) return null;

            return (
              <div key={division}>
                <h3 className="text-lg font-semibold mb-3">Eastern {division}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {divisionTeams.map(team => (
                    <TeamCard key={team.TEAM_ID} team={team} />
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="Western" className="space-y-6">
          {['Northwest', 'Pacific', 'Southwest'].map(division => {
            const divisionTeams = getDivisionTeams(division);
            if (divisionTeams.length === 0) return null;

            return (
              <div key={division}>
                <h3 className="text-lg font-semibold mb-3">Western {division}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {divisionTeams.map(team => (
                    <TeamCard key={team.TEAM_ID} team={team} />
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
};

export default NBA;