import React, { useState, useEffect, useMemo } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X } from 'lucide-react';
import driverDataRaw from '../driver_standings_2025.json';
import raceResultsData from '../race_results_2025.json';

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

interface RaceDriver {
  driver_code: string;
  driver_name: string;
  team: string;
  nationality: string;
  position: number;
  grid_position: number;
  points: number;
  status: string;
  race_time: string;   // present in JSON but not used in cards per request
  fastest_lap: string; // present in JSON but not used in cards per request
}

interface RaceResult {
  round: number;
  event_name: string;
  circuit_name: string;
  country: string;
  date: string;
  session_type: string; // "Sprint" or main race (e.g. "Race" / "Grand Prix")
  drivers: RaceDriver[];
}

// Find the real scroll container (PageLayout/main usually has overflow-y-auto)
const findScrollContainer = (): HTMLElement => {
  const candidates: (HTMLElement | null)[] = [
    document.querySelector('main'),
    document.getElementById('root'),
    document.body,
    document.scrollingElement as HTMLElement | null,
    document.documentElement,
  ];
  // pick the first element that is actually scrollable
  for (const el of candidates) {
    if (el && el.scrollHeight > el.clientHeight) return el;
  }
  // fallback
  return (document.scrollingElement as HTMLElement) || document.documentElement;
};


/* ------------ Data prep ------------ */

// Filter out metadata from driver standings
const driverData = driverDataRaw.filter((d: any) => d.driver && typeof d.points === 'number');

// Map JSON to F1Driver
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

// Sort by points descending
const sortedDrivers = [...f1Drivers].sort((a, b) => b.points - a.points);

// Type cast race results
const raceResults: RaceResult[] = raceResultsData as RaceResult[];

/* ------------ Team colors for badges (adjust as needed) ------------ */
const teamColors: Record<string, { primary: string; secondary: string }> = {
  'Red Bull Racing': { primary: '#001F3F', secondary: '#DC1E2D' },
  'Ferrari': { primary: '#ff0000ff', secondary: '#ff0000ff' },
  'Mercedes': { primary: '#00A19C', secondary: '#000000' },
  'McLaren': { primary: '#FF8700', secondary: '#000000' },
  'Aston Martin': { primary: '#00665E', secondary: '#000000ff' },
  'Alpine': { primary: '#0071C2', secondary: '#FF4F5E' },
  'Williams': { primary: '#00AEEF', secondary: '#002F6C' },

  // ✅ Racing Bulls (your JSON)
  'Racing Bulls': { primary: '#001F3F', secondary: '#000dffff' },

  'Haas F1 Team': { primary: '#FFFFFF', secondary: '#D0021B' },

  // ✅ Kick Sauber (your JSON)
  'Kick Sauber': { primary: '#00FF00', secondary: '#000000' },
};


/* ------------ UI helpers ------------ */
const getPositionColor = (pos: number) => {
  if (pos === 1) return 'text-yellow-500';
  if (pos === 2) return 'text-gray-400';
  if (pos === 3) return 'text-amber-700';
  return 'text-foreground';
};

const DriverCard = ({ driver, onClick }: { driver: F1Driver; onClick: () => void }) => {
  const colors = teamColors[driver.team] || { primary: '#888', secondary: '#ccc' };

  return (
    <Card
      className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* === Row: Position + Name === */}
            <div className="flex items-center gap-3 mb-1">
              <span className={`text-xl font-bold ${getPositionColor(driver.position)}`}>
                P{driver.position}
              </span>
              <CardTitle className="text-xl font-bold">{driver.name}</CardTitle>
            </div>

            {/* === Team Badge Below === */}
            <Badge
              variant="outline"
              className="text-xs font-semibold border"
              style={{
                backgroundColor: 'transparent',
                color: colors.secondary,
                borderColor: colors.primary,
                borderWidth: '2px',
                padding: '0.2rem 0.55rem',
                letterSpacing: '0.4px',
              }}
            >
              {driver.team}
            </Badge>
          </div>

          {/* === Points Section === */}
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


const DriverRaceCard = ({
  round,
  eventName,
  result,
  index,
  team,
}: {
  round: number;
  eventName: string;
  result: RaceDriver;
  index: number;
  team: string;
}) => {
  const colors = teamColors[team] || { primary: '#888', secondary: '#ccc' };
  return (
    <Card
      className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm"
      style={{ animation: `slideUp 0.4s ease-out ${index * 0.05}s both` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
            </div>
            <CardTitle className="text-lg font-bold">{eventName}</CardTitle>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getPositionColor(result.position)}`}>
              P{result.position}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2">
          <div className="space-y-2">
            <div className="flex justify-left text-sm gap-3">
              <span className="text-muted-foreground">Qualifying Grid Position</span>
              <span className="font-semibold">{result.grid_position}</span>
            </div>
            <div className="flex justify-left text-sm gap-3">
              <span className="text-muted-foreground">Points</span>
              <span className="font-semibold">{result.points}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-left text-sm gap-3">
              <span className="text-muted-foreground">Status</span>
              <span className="font-semibold">{result.status}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/* ------------ Driver Modal ------------ */
const DriverModal = ({
  driver,
  onClose,
  resultsForDriver,
}: {
  driver: F1Driver;
  onClose: () => void;
  resultsForDriver: RaceResult[];
}) => {
  // Split results into GP vs Sprint for this driver
  const { gp, sprint } = useMemo(() => {
    const gpArr: Array<{ rr: RaceResult; dr: RaceDriver }> = [];
    const spArr: Array<{ rr: RaceResult; dr: RaceDriver }> = [];

    for (const rr of resultsForDriver) {
      const dr = rr.drivers.find((d) => d.driver_name === driver.name);
      if (!dr) continue;
      if (rr.session_type === 'Sprint') {
        spArr.push({ rr, dr });
      } else {
        gpArr.push({ rr, dr });
      }
    }

    // Sort by round number (ascending)
    gpArr.sort((a, b) => a.rr.round - b.rr.round);
    spArr.sort((a, b) => a.rr.round - b.rr.round);

    return { gp: gpArr, sprint: spArr };
  }, [resultsForDriver, driver.name]);

  useEffect(() => {
  const scrollEl = findScrollContainer();
  const prevOverflow = scrollEl.style.overflow;
  const prevScrollTop = scrollEl.scrollTop;

  // lock scrolling but keep position
  scrollEl.style.overflow = 'hidden';

  return () => {
    // restore
    scrollEl.style.overflow = prevOverflow || '';
    // put the user back exactly where they were
    scrollEl.scrollTop = prevScrollTop;
  };
}, []);


  const colors = teamColors[driver.team] || { primary: '#888', secondary: '#ccc' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
      onClick={onClose}
      style={{ animation: 'fadeIn 0.2s ease-out' }}
    >
      <div
        className="relative bg-background rounded-2xl shadow-2xl max-w-6xl w-full max-h-[85vh] overflow-hidden border"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'scaleIn 0.25s ease-out' }}
      >
        <div className="sticky top-0 bg-background border-b p-6 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className="text-xs font-semibold border"
                style={{
                  backgroundColor: 'transparent',
                  color: colors.secondary,
                  borderColor: colors.primary,
                  borderWidth: '2px',
                  padding: '0.2rem 0.5rem',
                }}
              >
                {driver.team}
              </Badge>
              <Badge variant="default" className="text-xs">
                P{driver.position}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {driver.points} pts
              </Badge>
            </div>
            <h2 className="text-3xl font-bold">{driver.name}</h2>
            <p className="text-muted-foreground mt-1">
              Wins: {driver.wins} • Podiums: {driver.podiums} • Podium Rate: {driver.podium_pct.toFixed(0)}%
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal content with tabs */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
          <Tabs defaultValue="gp" className="w-full">
            <TabsList className="grid w-full max-w-sm grid-cols-2 mb-6">
              <TabsTrigger value="gp">Grand Prix</TabsTrigger>
              <TabsTrigger value="sprint">Sprint</TabsTrigger>
            </TabsList>

           <TabsContent value="gp">
  <div className="min-h-[60vh]">
    {gp.length > 0 ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gp.map(({ rr, dr }, index) => (
          <DriverRaceCard
            key={`gp-${rr.round}-${driver.id}`}
            round={rr.round}
            eventName={rr.event_name}
            result={dr}
            index={index}
            team={dr.team || driver.team}
          />
        ))}
      </div>
    ) : (
      <div className="text-center py-8 text-muted-foreground">
        No GP results available
      </div>
    )}
  </div>
</TabsContent>

<TabsContent value="sprint">
  <div className="min-h-[60vh]">
    {sprint.length > 0 ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sprint.map(({ rr, dr }, index) => (
          <DriverRaceCard
            key={`sp-${rr.round}-${driver.id}`}
            round={rr.round}
            eventName={rr.event_name}
            result={dr}
            index={index}
            team={dr.team || driver.team}
          />
        ))}
      </div>
    ) : (
      <div className="text-center py-8 text-muted-foreground">
        No Sprint results available
      </div>
    )}
  </div>
</TabsContent>

          </Tabs>
        </div>
      </div>

      {/* animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};


// === New RaceModal Component ===
// === Updated RaceModal Component ===
const RaceModal = ({
  race,
  onClose,
}: {
  race: RaceResult;
  onClose: () => void;
}) => {
  const [tab, setTab] = useState<'gp' | 'sprint'>('gp');

  // Group sessions for this round (GP + Sprint)
  const sessions = useMemo(() => {
    const allRaces = raceResults.filter((r) => r.round === race.round);
    return {
      gp: allRaces.filter((r) => r.session_type !== 'Sprint'),
      sprint: allRaces.filter((r) => r.session_type === 'Sprint'),
    };
  }, [race.round]);

  const hasGP = sessions.gp.length > 0;
  const hasSprint = sessions.sprint.length > 0;

  // pick default tab intelligently
  useEffect(() => {
    if (!hasGP && hasSprint) setTab('sprint');
    else setTab('gp');
  }, [hasGP, hasSprint]);

 useEffect(() => {
  const scrollEl = findScrollContainer();
  const prevOverflow = scrollEl.style.overflow;
  const prevScrollTop = scrollEl.scrollTop;

  // lock scrolling but keep position
  scrollEl.style.overflow = 'hidden';

  return () => {
    // restore
    scrollEl.style.overflow = prevOverflow || '';
    // put the user back exactly where they were
    scrollEl.scrollTop = prevScrollTop;
  };
}, []);


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
      onClick={onClose}
    >
      <div
        className="relative bg-background rounded-2xl shadow-2xl max-w-6xl w-full max-h-[85vh] overflow-hidden border"
        style={{ animation: 'scaleIn 0.25s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-6 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="default" className="text-sm">
                Race {race.round}
              </Badge>
            </div>
            <h2 className="text-3xl font-bold">{race.event_name}</h2>
            <p className="text-muted-foreground mt-1">
              {race.circuit_name} • {race.country} • {race.date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as 'gp' | 'sprint')}
            className="w-full"
          >
            {/* Only render the tab list if more than one tab exists */}
            {(hasGP && hasSprint) && (
              <TabsList className="grid w-full max-w-sm grid-cols-2 mb-6">
                {hasGP && <TabsTrigger value="gp">Grand Prix</TabsTrigger>}
                {hasSprint && <TabsTrigger value="sprint">Sprint</TabsTrigger>}
              </TabsList>
            )}

            {/* GP Section */}
            {hasGP && (
              <TabsContent value="gp">
                {sessions.gp.map((r) => (
                  <div
                    key={`gp-${r.round}`}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
                  >
                    {r.drivers.map((d, i) => {
                      const colors =
                        teamColors[d.team] || { primary: '#888', secondary: '#ccc' };
                      return (
                        <Card
                          key={d.driver_code}
                          className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm"
                          style={{
                            animation: `slideUp 0.4s ease-out ${i * 0.05}s both`,
                          }}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-semibold border"
                                    style={{
                                      backgroundColor: 'transparent',
                                      color: colors.secondary,
                                      borderColor: colors.primary,
                                      borderWidth: '2px',
                                      padding: '0.2rem 0.5rem',
                                    }}
                                  >
                                    {d.team}
                                  </Badge>
                                </div>
                                <CardTitle className="text-sm font-bold">
                                  {d.driver_name}
                                </CardTitle>
                              </div>
                              <div className="text-right">
                                <div
                                  className={`text-2xl font-bold ${getPositionColor(
                                    d.position
                                  )}`}
                                >
                                  P{d.position}
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Grid</span>
                                  <span className="font-semibold">
                                    {d.grid_position}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Points</span>
                                  <span className="font-semibold">{d.points}</span>
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Status</span>
                                  <span className="font-semibold">{d.status}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Fastest Lap
                                  </span>
                                  <span className="font-semibold">
                                    {d.fastest_lap}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ))}
              </TabsContent>
            )}

            {/* Sprint Section */}
            {hasSprint && (
              <TabsContent value="sprint">
                {sessions.sprint.map((r) => (
                  <div
                    key={`sprint-${r.round}`}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
                  >
                    {r.drivers.map((d, i) => {
                      const colors =
                        teamColors[d.team] || { primary: '#888', secondary: '#ccc' };
                      return (
                        <Card
                          key={d.driver_code}
                          className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm"
                          style={{
                            animation: `slideUp 0.4s ease-out ${i * 0.05}s both`,
                          }}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-semibold border"
                                    style={{
                                      backgroundColor: 'transparent',
                                      color: colors.secondary,
                                      borderColor: colors.primary,
                                      borderWidth: '2px',
                                      padding: '0.2rem 0.5rem',
                                    }}
                                  >
                                    {d.team}
                                  </Badge>
                                </div>
                                <CardTitle className="text-sm font-bold">
                                  {d.driver_name}
                                </CardTitle>
                              </div>
                              <div className="text-right">
                                <div
                                  className={`text-2xl font-bold ${getPositionColor(
                                    d.position
                                  )}`}
                                >
                                  P{d.position}
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Grid</span>
                                  <span className="font-semibold">
                                    {d.grid_position}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Points</span>
                                  <span className="font-semibold">{d.points}</span>
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Status</span>
                                  <span className="font-semibold">{d.status}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Fastest Lap
                                  </span>
                                  <span className="font-semibold">
                                    {d.fastest_lap}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ))}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};



/* ------------ Main page ------------ */
/* ------------ Main page ------------ */
const F1 = () => {
  const [selectedTab, setSelectedTab] = useState<string>('standings');
  const [selectedDriver, setSelectedDriver] = useState<F1Driver | null>(null);
  const [selectedRace, setSelectedRace] = useState<RaceResult | null>(null);

  const resultsByDriver = useMemo(() => raceResults, []);

  return (
    <PageLayout title="F1 Driver Standings - 2025 Season">
      <Tabs defaultValue="standings" className="w-full" onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
          <TabsTrigger value="standings">Championship</TabsTrigger>
          <TabsTrigger value="races">Race Results</TabsTrigger>
        </TabsList>

        {/* === Championship Standings === */}
        <TabsContent value="standings">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4">Drivers' Championship</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedDrivers.map((driver) => (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  onClick={() => setSelectedDriver(driver)}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        {/* === Race Results === */}
<TabsContent value="races">
  <div className="space-y-6">
    <h2 className="text-2xl font-bold mb-4">2025 Season Race Results</h2>

    {raceResults.length > 0 ? (
      // ✅ Step 1: Group by round
      (() => {
        const grouped = Object.values(
          raceResults.reduce((acc: any, race) => {
            if (!acc[race.round]) acc[race.round] = [];
            acc[race.round].push(race);
            return acc;
          }, {})
        );

        // ✅ Step 2: Render only one card per round
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.map((racesInRound: RaceResult[], index: number) => {
              // pick main race for display (prefer Grand Prix if it exists)
              const mainRace =
                racesInRound.find((r) => r.session_type !== 'Sprint') ||
                racesInRound[0];

              // check if this round also has a Sprint
              const hasSprint = racesInRound.some(
                (r) => r.session_type === 'Sprint'
              );

              return (
                <Card
                  key={`round-${mainRace.round}`}
                  onClick={() => setSelectedRace(mainRace)}
                  className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm cursor-pointer"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="default">Race {mainRace.round}</Badge>
                          {hasSprint && (
                            <Badge variant="secondary">Sprint</Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg font-bold">
                          {mainRace.event_name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {mainRace.circuit_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {mainRace.country} • {mainRace.date}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-muted-foreground mb-2">
                        Podium
                      </div>
                      {mainRace.drivers.slice(0, 3).map((driver, pos) => (
                        <div
                          key={driver.driver_code}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-lg font-bold ${getPositionColor(
                                pos + 1
                              )}`}
                            >
                              {pos + 1}
                            </span>
                            <div>
                              <div className="font-semibold text-sm">
                                {driver.driver_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {driver.team}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">
                              {driver.points} pts
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })()
    ) : (
      <div className="text-center py-8 text-muted-foreground">
        No race results available yet
      </div>
    )}
  </div>
</TabsContent>

      </Tabs>

      {/* === Modals === */}
      {selectedDriver && (
        <DriverModal
          driver={selectedDriver}
          onClose={() => setSelectedDriver(null)}
          resultsForDriver={resultsByDriver}
        />
      )}

      {selectedRace && (
        <RaceModal race={selectedRace} onClose={() => setSelectedRace(null)} />
      )}
    </PageLayout>
  );
};

export default F1;
