import React, { useState, useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface NFLTeam {
  name: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  ties: number;
  win_pct: number;
  points_for: number;
  points_against: number;
  point_diff: number;
  mov: number;
}

import nflTeamData from '../nfl_team_stats.json';

const TeamCard = ({ team }: { team: NFLTeam }) => {
  const totalGames = team.wins + team.losses + team.ties;

  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-bold">{team.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{team.division} Division</p>
          </div>
          <Badge variant={team.win_pct >= 0.5 ? "default" : "secondary"}>
            {team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Win %</span>
              <span className="font-semibold">{(team.win_pct * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Points For (PF)</span>
              <span className="font-semibold">{team.points_for}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Points Against (PA)</span>
              <span className="font-semibold">{team.points_against}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Point Diff (PD)</span>
              <span className={`font-semibold ${team.point_diff >= 0 ? 'text-success' : 'text-danger'}`}>
                {team.point_diff >= 0 ? '+' : ''}{team.point_diff}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">MoV</span>
              <span className={`font-semibold ${team.mov >= 0 ? 'text-success' : 'text-danger'}`}>
                {team.mov >= 0 ? '+' : ''}{team.mov.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">PPG</span>
              <span className="font-semibold">{totalGames > 0 ? (team.points_for / totalGames).toFixed(1) : '0.0'}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const NFL = () => {
  const [teams, setTeams] = useState<NFLTeam[]>([]);

  useEffect(() => {
    setTeams(nflTeamData);
  }, []);

  return (
    <PageLayout title="NFL Teams & Standings - 2024-25 Season">
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
          <TabsTrigger value="all">All Teams</TabsTrigger>
          <TabsTrigger value="AFC">AFC</TabsTrigger>
          <TabsTrigger value="NFC">NFC</TabsTrigger>
        </TabsList>

        {['all', 'AFC', 'NFC'].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-8">
            {['AFC', 'NFC'].map(conference => {
              if (tab !== 'all' && tab !== conference) return null;
              return (
                <div key={conference}>
                  <h2 className="text-2xl font-bold mb-4">{conference}</h2>
                  {['East', 'North', 'South', 'West'].map(division => {
                    const divisionTeams = teams
                      .filter(team => team.conference === conference)
                      .filter(team => team.division.endsWith(division))
                      .sort((a, b) => b.wins - a.wins);

                    if (divisionTeams.length === 0) return null;

                    return (
                      <div key={`${conference}-${division}`} className="mb-6">
                        <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
                          {conference} {division}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {divisionTeams.map(team => (
                            <TeamCard key={team.name} team={team} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </PageLayout>
  );
};

export default NFL;
