import React from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import driverDataRaw from '../driver_standings_2025.json';

interface F1Driver {
  id: string;
  name: string;
  team: string;
  points: number;
  position: number;
  wins: number;
  podiums: number;
  nationality: string;
  podium_pct: number;
}

// 🔧 Step 1: Filter out metadata (like _processed_rounds)
const driverData = driverDataRaw.filter((d: any) => d.driver && typeof d.points === 'number');

// 🔧 Step 2: Map JSON → F1Driver
const f1Drivers: F1Driver[] = driverData.map((d: any, i: number) => ({
  id: d.code ?? i.toString(),
  name: d.driver,
  team: d.team,
  points: d.points,
  position: d.position,
  wins: d.wins ?? 0,
  podiums: d.podiums ?? 0,
  nationality: d.nationality ?? '-',
  podium_pct: d.podium_pct ?? 0,
}));

// 🔧 Step 3: Sort by points descending
const sortedDrivers = [...f1Drivers].sort((a, b) => b.points - a.points);

const DriverCard = ({ driver }: { driver: F1Driver }) => {
  const getPositionColor = (pos: number) => {
    if (pos === 1) return 'text-yellow-500';
    if (pos === 2) return 'text-gray-400';
    if (pos === 3) return 'text-amber-700';
    return 'text-foreground';
  };

  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-2xl font-bold ${getPositionColor(driver.position)}`}>
                P{driver.position}
              </span>
            </div>
            <CardTitle className="text-lg font-bold">{driver.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{driver.team}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{driver.points}</div>
            <div className="text-xs text-muted-foreground">Points</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-success">{driver.wins}</div>
            <div className="text-xs text-muted-foreground">Wins</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{driver.podiums}</div>
            <div className="text-xs text-muted-foreground">Podiums</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{driver.podium_pct.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">Podium Rate</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const F1 = () => {
  return (
    <PageLayout title="F1 Driver Standings - 2025 Season">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-4">Drivers' Championship</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedDrivers.map(driver => (
              <DriverCard key={driver.id} driver={driver} />
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default F1;
