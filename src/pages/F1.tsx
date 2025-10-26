import React, { useState, useEffect, useMemo } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Sun, Moon } from 'lucide-react';
import driverDataRaw from '../driver_standings_2025.json';
import raceResultsData from '../race_results_2025.json';

/* ============================================================================
 * TYPE DEFINITIONS
 * ============================================================================ */

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
  race_time: string;
  fastest_lap: string;
}

interface RaceResult {
  round: number;
  event_name: string;
  circuit_name: string;
  country: string;
  date: string;
  session_type: string; // "Sprint" or "Grand Prix"
  drivers: RaceDriver[];
}

/* ============================================================================
 * DATA PROCESSING
 * ============================================================================ */

// Filter out metadata entries and map to F1Driver interface
const driverData = driverDataRaw.filter(
  (d: any) => d.driver && typeof d.points === 'number'
);

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

// Sort drivers by points (descending)
const sortedDrivers = [...f1Drivers].sort((a, b) => b.points - a.points);

// Type cast race results data
const raceResults: RaceResult[] = raceResultsData as RaceResult[];

/* ============================================================================
 * TEAM COLORS CONFIGURATION
 * ============================================================================ */

const teamColors: Record<string, { primary: string; secondary: string }> = {
  'Red Bull Racing': { primary: '#001F3F', secondary: '#DC1E2D' },
  'Ferrari': { primary: '#ff0000ff', secondary: '#ff0000ff' },
  'Mercedes': { primary: '#00A19C', secondary: '#000000' },
  'McLaren': { primary: '#FF8700', secondary: '#000000' },
  'Aston Martin': { primary: '#00665E', secondary: '#000000ff' },
  'Alpine': { primary: '#0071C2', secondary: '#FF4F5E' },
  'Williams': { primary: '#00AEEF', secondary: '#002F6C' },
  'Racing Bulls': { primary: '#001F3F', secondary: '#000dffff' },
  'Haas F1 Team': { primary: '#da0202ff', secondary: '#000000ff' },
  'Kick Sauber': { primary: '#00FF00', secondary: '#000000' },
};

/* ============================================================================
 * UTILITY FUNCTIONS
 * ============================================================================ */

/**
 * Returns appropriate color class based on podium position
 */
const getPositionColor = (pos: number): string => {
  if (pos === 1) return 'text-yellow-500';
  if (pos === 2) return 'text-gray-400';
  if (pos === 3) return 'text-amber-700';
  return 'text-foreground';
};

/**
 * Finds the actual scrollable container element in the DOM
 * Required for proper scroll locking in modals
 */
const findScrollContainer = (): HTMLElement => {
  const candidates: (HTMLElement | null)[] = [
    document.querySelector('main'),
    document.getElementById('root'),
    document.body,
    document.scrollingElement as HTMLElement | null,
    document.documentElement,
  ];
  
  // Return first scrollable element
  for (const el of candidates) {
    if (el && el.scrollHeight > el.clientHeight) return el;
  }
  
  // Fallback to document element
  return (document.scrollingElement as HTMLElement) || document.documentElement;
};

/* ============================================================================
 * DARK MODE TOGGLE COMPONENT
 * ============================================================================ */

const DarkModeToggle = () => {
  const [darkMode, setDarkMode] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (!stored && prefersDark);
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  // Toggle theme and persist to localStorage
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




/* ============================================================================
 * DRIVER CARD COMPONENT
 * ============================================================================ */

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
            {/* Position and driver name */}
            <div className="flex items-center gap-3 mb-1">
              <span className={`text-xl font-bold ${getPositionColor(driver.position)}`}>
                P{driver.position}
              </span>
              <CardTitle className="text-xl font-bold">{driver.name}</CardTitle>
            </div>

            {/* Team badge with custom colors */}
            <Badge
              className="text-xs font-semibold text-white border-none"
              style={{
                backgroundColor: colors.primary,
                padding: '0.25rem 0.6rem',
                borderRadius: '0.4rem',
                letterSpacing: '0.3px',
              }}
            >
              {driver.team}
            </Badge>
          </div>

          {/* Championship points */}
          <div className="text-right">
            <div className="text-2xl font-bold">{driver.points}</div>
            <div className="text-xs text-muted-foreground">Points</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Driver statistics grid */}
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

/* ============================================================================
 * DRIVER RACE CARD COMPONENT
 * Individual race result card shown in driver modal
 * ============================================================================ */

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
            {/* Circuit identifier badge */}
            <Badge
              className="text-xs font-semibold bg-blue-600 text-white mb-1"
              style={{
                border: 'none',
                padding: '0.2rem 0.6rem',
                borderRadius: '0.4rem',
                letterSpacing: '0.3px',
              }}
            >
              {eventName.startsWith('Circuit') ? eventName : `Circuit ${round}`}
            </Badge>

            {/* Race event title */}
            <CardTitle className="text-lg font-bold">{eventName}</CardTitle>
          </div>
          
          {/* Finishing position */}
          <div className="text-right">
            <div className={`text-2xl font-bold ${getPositionColor(result.position)}`}>
              P{result.position}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Race statistics */}
        <div className="grid grid-cols-1 gap-2">
          <div className="space-y-2">
            <div className="flex justify-left text-sm gap-2">
              <span className="text-muted-foreground">Qualifying Position -</span>
              <span className="font-semibold">{result.grid_position}</span>
            </div>
            <div className="flex justify-left text-sm gap-2">
              <span className="text-muted-foreground">Points -</span>
              <span className="font-semibold">{result.points}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-left text-sm gap-2">
              <span className="text-muted-foreground">Status -</span>
              <span className="font-semibold">{result.status}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/* ============================================================================
 * DRIVER MODAL COMPONENT
 * Full-screen modal showing all race results for a selected driver
 * ============================================================================ */

const DriverModal = ({
  driver,
  onClose,
  resultsForDriver,
}: {
  driver: F1Driver;
  onClose: () => void;
  resultsForDriver: RaceResult[];
}) => {
  // Separate Grand Prix and Sprint results
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

    // Sort by round number
    gpArr.sort((a, b) => a.rr.round - b.rr.round);
    spArr.sort((a, b) => a.rr.round - b.rr.round);

    return { gp: gpArr, sprint: spArr };
  }, [resultsForDriver, driver.name]);

  // Lock scroll when modal opens, restore on close
  useEffect(() => {
    const scrollEl = findScrollContainer();
    const prevOverflow = scrollEl.style.overflow;
    const prevScrollTop = scrollEl.scrollTop;

    scrollEl.style.overflow = 'hidden';

    return () => {
      scrollEl.style.overflow = prevOverflow || '';
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
        {/* Modal header */}
        <div className="sticky top-0 bg-background border-b p-6 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge
                className="text-xs font-semibold text-white border-none"
                style={{
                  backgroundColor: colors.primary,
                  padding: '0.25rem 0.6rem',
                  borderRadius: '0.4rem',
                  letterSpacing: '0.3px',
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

        {/* Modal content with Grand Prix / Sprint tabs */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
          <Tabs defaultValue="gp" className="w-full">
            <TabsList className="grid w-full max-w-sm grid-cols-2 mb-6">
              <TabsTrigger value="gp">Grand Prix</TabsTrigger>
              <TabsTrigger value="sprint">Sprint</TabsTrigger>
            </TabsList>

            {/* Grand Prix results */}
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

            {/* Sprint results */}
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

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; } 
          to { opacity: 1; }
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

/* ============================================================================
 * RACE MODAL COMPONENT
 * Full-screen modal showing all drivers' results for a selected race
 * ============================================================================ */

const RaceModal = ({
  race,
  onClose,
}: {
  race: RaceResult;
  onClose: () => void;
}) => {
  const [tab, setTab] = useState<'gp' | 'sprint'>('gp');

  // Group all sessions (GP + Sprint) for this round
  const sessions = useMemo(() => {
    const allRaces = raceResults.filter((r) => r.round === race.round);
    return {
      gp: allRaces.filter((r) => r.session_type !== 'Sprint'),
      sprint: allRaces.filter((r) => r.session_type === 'Sprint'),
    };
  }, [race.round]);

  const hasGP = sessions.gp.length > 0;
  const hasSprint = sessions.sprint.length > 0;

  // Set default tab based on available sessions
  useEffect(() => {
    if (!hasGP && hasSprint) setTab('sprint');
    else setTab('gp');
  }, [hasGP, hasSprint]);

  // Lock scroll when modal opens
  useEffect(() => {
    const scrollEl = findScrollContainer();
    const prevOverflow = scrollEl.style.overflow;
    const prevScrollTop = scrollEl.scrollTop;

    scrollEl.style.overflow = 'hidden';

    return () => {
      scrollEl.style.overflow = prevOverflow || '';
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
        {/* Modal header */}
        <div className="sticky top-0 bg-background border-b p-6 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="default" className="text-sm">
                Circuit {race.round}
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

        {/* Tabs for GP / Sprint sessions */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as 'gp' | 'sprint')}
            className="w-full"
          >
            {/* Only show tabs if both GP and Sprint exist */}
            {(hasGP && hasSprint) && (
              <TabsList className="grid w-full max-w-sm grid-cols-2 mb-6">
                {hasGP && <TabsTrigger value="gp">Grand Prix</TabsTrigger>}
                {hasSprint && <TabsTrigger value="sprint">Sprint</TabsTrigger>}
              </TabsList>
            )}

            {/* Grand Prix session results */}
            {hasGP && (
              <TabsContent value="gp">
                {sessions.gp.map((r) => (
                  <div
                    key={`gp-${r.round}`}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
                  >
                    {r.drivers.map((d, i) => {
                      const colors = teamColors[d.team] || { primary: '#888', secondary: '#ccc' };
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
                                    className="text-xs font-semibold text-white border-none"
                                    style={{
                                      backgroundColor: colors.primary,
                                      padding: '0.25rem 0.6rem',
                                      borderRadius: '0.4rem',
                                      letterSpacing: '0.3px',
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
                                <div className="flex justify-left gap-1">
                                  <span className="text-muted-foreground">Qualifying -</span>
                                  <span className="font-semibold">
                                    {d.grid_position}
                                  </span>
                                </div>
                                <div className="flex justify-left gap-1">
                                  <span className="text-muted-foreground">Points -</span>
                                  <span className="font-semibold">{d.points}</span>
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-left gap-1">
                                  <span className="text-muted-foreground">Status -</span>
                                  <span className="font-semibold">{d.status}</span>
                                </div>
                                <div className="flex justify-left gap-1">
                                  <span className="text-muted-foreground">
                                    Fastest Lap -
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

            {/* Sprint session results */}
            {hasSprint && (
              <TabsContent value="sprint">
                {sessions.sprint.map((r) => (
                  <div
                    key={`sprint-${r.round}`}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
                  >
                    {r.drivers.map((d, i) => {
                      const colors = teamColors[d.team] || { primary: '#888', secondary: '#ccc' };
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
                                    className="text-xs font-semibold text-white border-none"
                                    style={{
                                      backgroundColor: colors.primary,
                                      padding: '0.25rem 0.6rem',
                                      borderRadius: '0.4rem',
                                      letterSpacing: '0.3px',
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

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

/* ============================================================================
 * MAIN F1 COMPONENT
 * ============================================================================ */

const F1 = () => {
  const [selectedTab, setSelectedTab] = useState<string>('standings');
  const [selectedDriver, setSelectedDriver] = useState<F1Driver | null>(null);
  const [selectedRace, setSelectedRace] = useState<RaceResult | null>(null);

  const resultsByDriver = useMemo(() => raceResults, []);

  return (
    <PageLayout title="F1 Driver Standings - 2025 Season">
      {/* Dark mode toggle */}
      <div className="flex justify-end">
        <DarkModeToggle />
      </div>

      <Tabs defaultValue="standings" className="w-full" onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
          <TabsTrigger value="standings">Championship</TabsTrigger>
          <TabsTrigger value="races">Race Results</TabsTrigger>
        </TabsList>

        {/* Championship Standings Tab */}
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

        {/* Race Results Tab */}
        <TabsContent value="races">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4">2025 Season Race Results</h2>

            {raceResults.length > 0 ? (
              // Group races by round number (combines GP + Sprint into one card)
              (() => {
                const grouped = Object.values(
                  raceResults.reduce((acc: any, race) => {
                    if (!acc[race.round]) acc[race.round] = [];
                    acc[race.round].push(race);
                    return acc;
                  }, {})
                );

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grouped.map((racesInRound: RaceResult[], index: number) => {
                      // Display main race (prefer Grand Prix over Sprint)
                      const mainRace =
                        racesInRound.find((r) => r.session_type !== 'Sprint') ||
                        racesInRound[0];

                      // Check if this round has a Sprint session
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
                                  <Badge variant="default" style={{ backgroundColor: "#00e5ffff", color: "#000000c4" }}>Circuit {mainRace.round}</Badge>
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
                         <NeonTrack circuitId={mainRace.round} />
                          <CardContent>
                            <div className="space-y-3">
                              <div className="text-sm font-semibold text-muted-foreground mb-2">
                                Podium
                              </div>
                              {/* Display top 3 finishers */}
                            {mainRace.drivers.slice(0, 3).map((driver, pos) => (
  <div
    key={driver.driver_code}
    className="flex items-start justify-start gap-3"
  >
    {/* Position Number */}
    <span
      className={`text-lg font-bold ${getPositionColor(pos + 1)}`}
    >
      {pos + 1}
    </span>

    {/* Name + Points + Team */}
    <div>
      {/* Top row → Name + Points */}
      <div className="flex items-center gap-2">
        <div className="font-semibold text-sm">{driver.driver_name}</div>
      </div>

      {/* Bottom row → Team */}
      <div className="text-xs text-muted-foreground">{driver.team}</div>
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

      {/* Render modals when driver or race is selected */}
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


const trackPaths: Record<string, string> = {
  1: `m14.303 54.81c-7.2586 16.136-7.0661 15.467-9.8782 34.322-2.5969 17.412-3.5275 15.26 14.18 32.841 8.8917 8.8279 14.803 15.25 14.648 15.914-0.14226 0.61248-2.8958 5.0125-6.1203 9.7766-9.859 14.567-9.4038 15.862 7.3215 20.846 25.015 7.4546 48.885 10.688 76.968 10.428 27.962-0.25946 34.415 2.1095 38.342 14.071 2.8101 8.5584-2.1545 8.1078 86.272 7.8144 63.777-0.2116 81.519-0.64863 83.567-2.0602 5.3008-3.6542 6.8644-8.4601 6.2506-19.219-0.78234-13.714-1.9355-13.524 28.794-4.762 10.39 2.9626 13.986 3.521 16.711 2.5957 6.4807-2.2009 21.472-29.916 25.06-46.326 0.97132-4.4429-4.053-8.2548-28.194-21.392-38.955-21.199-38.148-21.026-79.689-17.087-15.766 1.495-19.491 3.0793-28.331 12.05-11.014 11.176-45.853 15.005-66.093 7.2634-27.63-10.58-57.44-48.047-51.74-65.044 2.81-8.374-13.11-23.074-42.03-38.817-15.58-8.4808-32.6-6.3434-48.635 6.107-8.331 6.468-11.137 7.526-23.662 8.926-5.4498 0.42935-11.039 25.692-13.742 31.752z`,
  2 : 'm490.05 299.77c16.808-24.592 0.66497-57.836-34.045-51.106-11.377 2.206-14.444 8.6956-10.241 21.672 4.399 13.579 4.8848 13.383-29.629 11.999-15.386-0.61702-36.964-1.3708-47.95-1.6751-27.435-0.75994-87.181-3.7741-91.736-4.6278-4.338-0.81306-4.9747-1.9562-10.912-19.566-6.0748-18.017-3.1485-20.098 24.324-17.289 44.704 4.5716 57.606-20.625 31.837-62.181-17.295-27.89-17.268-47.174 0.0895-64.49 13.139-13.107 19.257-14.122 66.864-11.084 42.15 2.6897 56.859 1.5632 70.668-5.4123 21.398-10.809 15.882-15.451-33.644-28.321-44.524-11.57-42.802-11.381-67.703-7.4009-10.66 1.704-25.959 3.6865-33.999 4.4068-8.0398 0.72029-21.057 2.3314-28.926 3.5785-26.213 4.1539-34.42 1.8511-42.539-11.933-10.271-17.439 2.7058-28.334 16.173-13.577 11.201 12.273 18.447 12.455 26.19 0.66263 12.229-18.623-9.9568-43.345-34.793-38.772-16.038 2.9532-25.482 13.222-33.781 36.736-2.7239 7.7175-5.6328 15.738-6.464 17.824-0.83113 2.0862-14.984 41.244-31.451 87.017-50.781 141.15-51.54 143.21-53.474 145-2.8829 2.6772-2.1578 2.6053-55.675 5.4587-57.364 3.0585-61.411 3.8371-72.32 13.905-1.2497 1.1533-2.4682 2.3098-2.707 2.5708-0.59522 0.65072 1.4105 5.0164 3.2039 6.9734 1.9529 2.1311-1.4502 2.062 59.441 1.2134 48.318-0.67342 86.183-0.70049 132.01-0.0929 16.254 0.21548 32.574 0.22163 125.88 0.0461 146.88-0.27627 137.29 0.2191 150.45-7.7817 6.4561-3.9238 11.364-8.6537 14.852-13.758z',
  3 : 'm 356.47746,426.07244 c 42.46359,13.96485 84.86234,28.5396 126.23455,44.39894 6.67495,2.55873 11.74735,8.6103 16.32056,14.12356 14.2582,17.18906 25.61519,37.5607 40.17369,53.9834 2.59901,2.93181 7.5547,4.02341 11.29885,4.08014 3.16071,0.0479 7.16722,-1.56776 9.41571,-3.76629 2.45936,-2.40471 4.27349,-6.56855 4.70785,-10.04342 0.40259,-3.22075 -0.70247,-6.99901 -2.197,-10.04342 -4.1549,-8.46368 -10.0253,-16.21039 -14.75127,-24.48084 -6.99136,-12.23487 -13.96329,-24.50513 -20.40071,-37.03512 -5.2799,-10.27695 -10.95415,-20.53678 -14.75127,-31.3857 -3.52621,-10.07488 -5.99654,-20.81396 -7.21871,-31.3857 -0.87021,-7.52735 -0.0783,-15.37604 0.94157,-22.91156 0.8633,-6.37881 2.50383,-12.77036 4.70785,-18.83141 3.65465,-10.05028 7.59638,-20.21652 12.86814,-29.50256 6.13171,-10.80081 13.73015,-20.89965 21.34227,-30.75798 5.15139,-6.67147 10.86898,-12.98898 16.94828,-18.83142 10.03202,-9.64117 20.36719,-19.13949 31.38569,-27.61941 10.32378,-7.94526 21.18093,-15.52625 32.64113,-21.65613 11.03288,-5.90131 22.88502,-10.77714 34.83812,-14.43742 9.91227,-3.03534 20.42821,-4.51429 30.75798,-5.64943 8.71089,-0.95724 17.64297,-1.57163 26.36399,-0.62771 35.74205,3.86855 71.42677,11.94246 107.02522,15.06513 6.14452,0.53899 12.77137,-1.38845 18.2037,-4.08014 6.18038,-3.06235 12.21296,-7.81307 16.63442,-13.18199 5.8312,-7.08074 10.53859,-15.63372 14.12357,-24.16698 3.84297,-9.14735 6.81627,-19.10023 8.16028,-28.87484 0.95761,-6.96443 1.01054,-14.83993 -1.25543,-21.34228 -2.5465,-7.30735 -7.70465,-14.6095 -13.18199,-20.08684 -3.51989,-3.51989 -8.94717,-5.4124 -13.80971,-6.90486 -5.70398,-1.750726 -11.93621,-3.041996 -17.88985,-2.824709 -8.37916,0.30581 -16.96956,2.062731 -25.10855,4.393999 -12.68019,3.63202 -24.99345,8.75133 -37.34898,13.49585 -13.79922,5.2989 -27.58708,10.68856 -41.11526,16.63442 -12.41733,5.45761 -24.71498,11.26611 -36.72127,17.57599 -16.65931,8.75526 -33.46601,17.4459 -49.27554,27.61941 -18.81935,12.11034 -36.87615,25.54647 -54.61111,39.23212 -18.46321,14.24762 -35.93445,29.77825 -53.9834,44.56769 -20.76469,17.01474 -41.82698,33.6699 -62.45753,50.84483 -21.21705,17.66319 -42.27235,35.53139 -63.08525,53.66954 -31.28736,27.26649 -63.05016,54.26436 -93.21552,82.54438 -3.31272,3.10567 -5.92092,7.29505 -7.21871,11.6127 -4.1424,13.78143 -7.26331,28.31049 -9.10185,42.68455 -1.61388,12.61764 -2.6735,25.66298 -1.25543,38.29055 2.97593,26.49993 8.79863,52.90789 14.43742,79.09195 4.92773,22.88224 13.36877,45.15661 17.26213,68.10696 2.06992,12.20163 1.5234,25.25734 0.62772,37.34898 -0.15051,2.03192 -1.8921,4.26796 -3.76629,5.02171 -7.75075,3.11715 -17.63824,3.08453 -25.10855,6.591 -2.78235,1.306 -5.52681,4.8423 -5.64943,7.84642 -0.29586,7.24854 2.27126,15.19919 2.894,22.91156 0.73731,9.13129 0.94222,18.6285 -0.31386,27.61941 -0.73168,5.23728 -1.9704,10.17563 -4.14942,15.06514 -2.11036,4.73544 -4.37031,9.49117 -7.21871,13.80971 -3.63798,5.51564 -7.56443,11.07121 -12.24043,15.69284 -4.32123,4.27099 -9.47717,7.89216 -14.75127,10.985 -11.67417,6.84596 -23.73445,13.33129 -36.09355,18.83141 -7.62313,3.39249 -15.78725,5.66192 -23.85313,7.84643 -6.99925,1.89563 -14.1575,3.33713 -21.34228,4.394 -70.33789,10.3466 -140.885016,19.42373 -211.22573,29.81641 -45.786359,6.76483 -91.38624,14.77857 -137.15549,21.65613 -32.90422,4.94438 -65.85991,10.02512 -98.86494,13.8097 -6.22709,0.71404 -12.60683,0.29749 -18.83142,-0.31385 -5.49273,-0.53946 -11.13885,-1.32986 -16.32056,-3.13857 -5.9079,-2.06219 -11.85737,-4.83151 -16.94828,-8.47414 -7.04489,-5.04074 -13.71207,-11.06988 -19.45913,-17.57599 -5.34255,-6.04817 -10.35741,-12.91669 -13.80971,-20.08685 -1.98789,-4.12869 -2.51085,-9.1976 -2.51085,-13.8097 0,-5.22208 0.56161,-10.92803 2.51085,-15.69285 1.81704,-4.44165 5.35878,-8.44458 8.788,-11.92656 3.37101,-3.42287 7.36892,-6.58553 11.6127,-8.788 4.02112,-2.08691 8.66463,-3.4065 13.182,-4.08014 7.4092,-1.10488 15.05871,-0.98544 22.5977,-1.25543 30.4377,-1.09006 61.05671,-0.89222 91.33237,-2.82471 4.14399,-0.26451 8.257,-1.88563 11.92657,-3.76628 4.69995,-2.40873 9.37711,-5.45775 13.18199,-9.10186 3.62307,-3.46998 6.48174,-7.90369 9.10185,-12.24042 3.44779,-5.70669 5.30414,-12.49954 9.10185,-17.88984 2.68867,-3.81617 6.42891,-7.20765 10.35728,-9.72957 4.54577,-2.91827 9.84729,-5.22724 15.06514,-6.591 3.98862,-1.04248 8.38034,-0.77503 12.55428,-0.62771 4.71868,0.16654 9.52954,0.46671 14.12356,1.56928 13.714299,3.29143 27.094234,8.22276 40.801404,11.61271 5.751961,1.42253 11.747408,2.93468 17.57599,2.82471 5.261031,-0.0993 10.753541,-1.53718 15.692848,-3.45242 5.313354,-2.06028 10.522722,-5.03821 15.065134,-8.47414 3.617869,-2.73659 6.751829,-6.3257 9.4157091,-10.04342 6.8564477,-9.56889 12.139597,-20.38019 19.1452749,-29.81641 3.246983,-4.37349 7.241351,-8.42419 11.612707,-11.61271 4.521257,-3.29786 9.835697,-5.7659 15.065134,-7.84643 4.500129,-1.79037 9.329958,-3.08148 14.123564,-3.76628 5.459055,-0.77986 11.230826,-1.35945 16.634419,-0.62771 4.63983,0.62831 9.248651,2.64324 13.495849,4.70785 3.285369,1.59705 6.458044,3.74828 9.101852,6.27714 4.574901,4.37599 8.532692,9.49133 12.554275,14.43742 5.08027,6.24815 9.5771,12.9803 14.75128,19.14528 4.66001,5.55235 9.03983,11.75005 14.75128,16.0067 5.37816,4.00825 12.11653,6.59157 18.51756,8.788 4.2701,1.46523 8.97179,2.05561 13.49585,2.19699 5.51937,0.17248 11.37929,0.27733 16.63442,-1.25542 7.29915,-2.12892 14.37645,-5.85685 21.02841,-9.72957 8.62241,-5.0199 17.10624,-10.60396 24.7947,-16.94828 7.27206,-6.00072 13.88991,-12.96956 20.08685,-20.08684 4.36958,-5.01852 8.17878,-10.61281 11.61271,-16.32056 4.30787,-7.16039 8.58488,-14.53963 11.6127,-22.28385 2.41237,-6.17011 3.4702,-12.90984 4.70786,-19.45913 1.2732,-6.73732 2.31478,-13.56758 2.82471,-20.4007 0.53626,-7.18583 0.80239,-14.47472 0.31386,-21.65613 -0.55766,-8.19758 -1.43055,-16.53116 -3.45243,-24.48084 -2.58135,-10.1494 -6.75044,-19.93311 -10.35728,-29.81642 -9.67977,-26.5241 -21.22782,-52.7428 -29.50255,-79.40581 -1.14098,-3.67649 -0.23522,-8.0375 1.25542,-11.6127 11.90059,-28.54283 24.90784,-57.2885 38.91827,-84.74138 1.47318,-2.88663 4.66305,-5.0018 7.53256,-6.27714 2.77991,-1.23552 6.41341,-2.21541 9.41571,-1.25543 14.8986,4.76382 29.84977,9.56083 44.81142,14.42057',
  4: "m4.0167 271.88c0.64631 8.2948 35.488 7.0412 175.53 4.453 12.377-0.22874 23.86-0.27059 25.52-0.0932 13.322 1.4247 100.54 2.2285 145.19 1.3382l52.003-1.0371 10.787-5.1931c5.9327-2.8564 11.75-6.3558 12.928-7.7758 3.9507-4.7641 3.2062-6.3707-21.921-47.254-13.094-21.305-31.084-50.583-39.976-65.064-78.47-127.81-76.73-125.33-87.73-124.85-10.071 0.43333-18.612 11.049-30.86 38.362-6.0647 12.461-9.3595 17.392-9.4458 30.499-0.16791 25.024 10.566 36.802 43.884 48.15 27.605 9.4028 44.83 34.219 37.75 54.389-2.9794 8.4869-5.7122 8.9248-56.109 8.9963-116.27 0.16506-159.78-0.95414-191.07-4.9201-0.01764-0.002-0.0317-0.005-0.04921-0.008-1.3307-0.66808-2.43-1.5305-2.9028-2.6746 0.52921-1.7786 2.7076-4.7102 6.8088-9.6375 12.941-15.548 12.809-15.542 95.728-5.2995 57.897 7.1518 61.142 0.92171 16.441-31.574-40.6-29.52-40.53-29.42-36.96-49.77 3.4-19.413-0.73-26.128-20.45-33.214-14.94-5.372-30.31-18.671-50.912-44.055-23.312-28.723-35.64-28.862-40.096-0.451-16.672 106.31-23.197 153.18-23.266 178.19-0.10452 1.6859-0.07039 3.3487 0.08572 4.9912 0.31161 8.3078 1.4916 13.926 3.3599 18.797 7.4095 19.318 7.6168 17.58-3.5718 30.076-5.9649 6.6621-10.949 11.37-10.696 14.616z",
  5: "m501.11 113.99c-9.1344 5.9216-27.403 17.765-38.302 24.82-10.898 7.0556-14.426 9.3234-18.521 12.284-4.0948 2.9609-8.7564 6.6146-24.884 19.97-16.127 13.355-43.719 36.411-57.895 48.313-14.176 11.901-14.936 12.648-15.495 13.294s-0.91463 1.1917-1.1262 1.7151c-0.21159 0.52348-0.2784 1.0246-0.26165 1.4924 0.0168 0.46777 0.11698 0.90208 0.32865 1.3364 0.21166 0.43431 0.53461 0.86862 1.0469 1.4031s1.2139 1.1693 1.7818 1.7484 1.0022 1.1025 1.2973 1.5424c0.29505 0.4399 0.45096 0.79625 0.53442 1.147 0.0835 0.35077 0.0946 0.69599 0.0256 1.1513s-0.21806 1.0208-0.44614 1.5476c-0.22809 0.52682-0.53518 1.015-0.8671 1.4115-0.33191 0.39651-0.68868 0.70139-1.2067 1.0153-0.518 0.31391-1.1973 0.63685-2.0659 0.92083-0.8686 0.28399-1.9265 0.52898-3.0346 0.72387-1.108 0.1949-2.2662 0.33967-3.2626 0.4466-0.99641 0.10692-1.8311 0.176-3.0359 0.20268-1.2048 0.0267-2.7796 0.011-4.4806 0.0425s-3.5278 0.11024-4.8428 0.24409-2.1183 0.32283-2.9294 0.54331c-0.8111 0.22049-1.63 0.47247-2.6931 0.86619-1.0631 0.39373-2.3702 0.92919-3.7326 1.5513-1.3623 0.62209-2.7797 1.3308-4.2444 2.1182s-2.9766 1.6536-4.6302 2.6695-3.449 2.1812-5.1736 3.2443-3.3781 2.0237-4.9924 2.9766c-1.6143 0.95282-3.1892 1.8977-4.6617 2.7797s-2.8427 1.7009-4.142 2.4596c-1.2994 0.75875-2.5279 1.4573-3.7881 2.1741s-2.552 1.4518-3.8215 2.1979c-1.2696 0.74614-2.5168 1.5034-3.7752 2.205-1.2584 0.70159-2.5279 1.3475-3.764 1.96s-2.4388 1.1916-3.3854 1.6148-1.637 0.69044-2.1549 0.93823-0.8631 0.47609-1.1944 0.70438c-0.33131 0.2283-0.64869 0.45659-0.94384 0.72667-0.29514 0.27008-0.56797 0.58188-0.71832 0.8799-0.15034 0.29801-0.17817 0.58197-0.16701 1.1722 0.0112 0.59026 0.0613 1.4867 0.0807 2.4027 0.0195 0.91596 8e-3 1.8514-0.0306 2.8481-0.039 0.99671-0.1058 2.0546-0.21419 2.9995-0.10838 0.94493-0.25832 1.7768-0.43173 2.4408s-0.37025 1.1601-0.63012 1.7428c-0.25987 0.58272-0.58271 1.252-1.0079 1.9607s-0.9528 1.4568-1.3386 2.0001-0.62995 0.88194-1.0336 1.3355c-0.40363 0.45361-0.96679 1.0222-1.5992 1.6072-0.63238 0.58499-1.334 1.1863-2.0745 1.7543-0.74056 0.56795-1.5201 1.1025-2.2996 1.5925s-1.559 0.93544-2.411 1.3308c-0.8519 0.39533-1.7762 0.74054-2.7951 1.0301-1.019 0.28955-2.1326 0.52341-3.2547 0.646-1.1222 0.12258-2.2529 0.13385-3.2592 0.108-1.0063-0.0259-1.8883-0.0888-2.7387-0.23056-0.85044-0.14172-1.6694-0.3622-2.512-0.59843s-1.7088-0.48821-2.5513-0.70871c-0.84259-0.22049-1.6615-0.40948-2.5356-0.55912-0.87408-0.14963-1.8032-0.25987-2.6695-0.29927-0.86622-0.0394-1.6694-8e-3 -2.512 0.10234-0.84262 0.11024-1.7245 0.29922-2.5356 0.52758-0.81111 0.22836-1.5513 0.49608-2.3152 0.81107-0.76385 0.31499-1.5513 0.67721-2.3073 1.0788-0.75599 0.40161-1.4804 0.84257-2.2459 1.3636-0.76547 0.52104-1.5719 1.1221-2.4651 1.7568-0.8932 0.63463-1.8732 1.3028-2.7307 1.9487-0.85751 0.64591-1.5925 1.2695-2.2718 1.96-0.67934 0.69048-1.303 1.4477-1.8709 2.2718-0.56797 0.82412-1.0802 1.715-1.4589 2.528-0.37863 0.81299-0.62363 1.548-0.83521 2.3498-0.21159 0.80184-0.38976 1.6704-0.55681 2.5725-0.16704 0.90205-0.32295 1.8375-0.47886 2.6059-0.15592 0.76839-0.31182 1.3697-0.47887 1.9042s-0.34523 1.0022-0.57908 1.4142c-0.23384 0.41198-0.52339 0.76835-0.90201 1.2027-0.37863 0.4343-0.84634 0.94655-1.4365 1.4254-0.59019 0.47884-1.3029 0.92428-2.1715 1.3697s-1.8931 0.89088-2.9622 1.3363c-1.0691 0.44545-2.1827 0.89089-4.4301 1.744s-5.6285 2.1137-7.6813 2.87c-2.0528 0.75632-2.7773 1.0083-3.4466 1.1658-0.6693 0.1575-1.2835 0.2205-2.0631 0.24414-0.77957 0.0236-1.7245 8e-3 -2.5907-0.0236-0.8662-0.0315-1.6536-0.0787-2.2442-0.15745-0.59058-0.0787-0.9843-0.18896-1.441-0.3543s-0.97643-0.38583-1.4962-0.63779c-0.51973-0.25197-1.0394-0.53543-1.6379-0.92127-0.59847-0.38583-1.2757-0.87404-1.8702-1.4056-0.59456-0.5315-1.1064-1.1063-1.6182-1.7048s-1.0237-1.2206-1.5277-1.819c-0.50396-0.59847-1-1.1733-1.4922-1.6852-0.49214-0.51187-0.98035-0.96071-1.4371-1.3505-0.45672-0.38981-0.88193-0.72052-1.378-1.0631-0.49609-0.34256-1.063-0.69691-1.6103-0.98436-0.54728-0.28746-1.0749-0.50794-1.5906-0.68908-0.51579-0.18113-1.0198-0.32287-1.6025-0.42133-0.58273-0.0985-1.2442-0.15358-1.8505-0.17329-0.60636-0.0197-1.1576-4e-3 -1.8112 0.0905s-1.4096 0.26771-2.2206 0.47638c-0.81109 0.20868-1.6773 0.45279-2.449 0.67328-0.77171 0.22048-1.4489 0.41734-2.1891 0.61814-0.74021 0.20081-1.5434 0.40555-2.5828 0.61817-1.0394 0.21263-2.3151 0.43311-3.5907 0.59061-1.2757 0.15749-2.5513 0.25198-4.1656 0.28349-1.6143 0.0315-3.5671 0-5.583-8e-3 -2.0159-8e-3 -4.0947 8e-3 -5.4649 0.0552-1.3702 0.0472-2.0316 0.12599-2.9249 0.24704s-2.0184 0.2844-3.2381 0.52198-2.5337 0.54939-3.8923 0.90575c-1.3586 0.35636-2.7618 0.75725-4.3209 1.2472-1.5591 0.49-3.274 1.0691-4.9779 1.6816s-3.3965 1.2584-5.1227 1.9154c-1.7261 0.65704-3.4856 1.3252-5.2897 2.0491-1.8041 0.72387-3.6527 1.5034-10.109 4.3317-6.4566 2.8283-17.521 7.7051-26.518 11.656s-15.926 6.9742-19.517 8.5648c-3.5908 1.5907-3.8428 1.7482-4.1814 1.9923-0.33862 0.24411-0.76384 0.57484-1.2048 0.97646-0.441 0.40163-0.8977 0.87408-1.3466 1.3781s-0.88983 1.0394-1.2914 1.5986c-0.40162 0.55912-0.76384 1.1418-1.071 1.7876-0.30711 0.64576-0.55909 1.3544-0.71657 1.9136-0.15748 0.55912-0.22047 0.96859-0.25195 1.7718-0.03148 0.80323-0.03148 2.0001 0.12607 3.079s0.47252 2.0395 0.80328 2.8506 0.67724 1.4725 1.1025 2.1104c0.42526 0.63782 0.92921 1.252 1.4962 1.8268 0.567 0.57482 1.197 1.1103 1.9057 1.5985 0.70873 0.48818 1.4962 0.92915 2.1419 1.252s1.1497 0.52756 1.9844 0.6535c0.83469 0.12593 2.0001 0.17317 3.0946 0.17316 1.0946-1e-5 2.1182-0.0473 3.1419-0.17326 1.0237-0.12601 2.0473-0.33074 3.0238-0.57486s1.9056-0.5276 2.8663-0.91346c0.96067-0.38585 1.9528-0.87406 2.9529-1.4489 1-0.57484 2.008-1.2363 2.831-1.8556 0.82305-0.61934 1.4612-1.1966 2.1144-1.8304 0.65318-0.63385 1.3213-1.3243 2.0452-2.1484s1.5034-1.7818 2.205-2.7172c0.70158-0.93544 1.3252-1.8486 1.882-2.6727 0.55681-0.82408 1.0468-1.559 1.5702-2.3052 0.52341-0.74614 1.0802-1.5034 1.715-2.2496 0.63478-0.74615 1.3475-1.4811 1.9734-2.1502 0.62592-0.66901 1.165-1.272 1.8677-1.983s1.5688-1.5299 2.5296-2.3646c0.96071-0.83472 2.0159-1.6852 3.1183-2.512 1.1025-0.82683 2.2521-1.63 3.5436-2.4175 1.2915-0.78747 2.7246-1.5592 4.3704-2.3466s3.5042-1.5906 5.2366-2.2206c1.7324-0.62997 3.3388-1.0867 4.8822-1.4568 1.5434-0.3701 3.0238-0.65358 4.4019-0.88193 1.3781-0.22836 2.6537-0.4016 3.701-0.49607 1.0473-0.0945 1.8663-0.11021 3.079-0.11808 1.2127-8e-3 2.819-8e-3 3.9766 0.0158 1.1576 0.0236 1.8662 0.0709 2.6616 0.16538 0.79534 0.0945 1.6773 0.23624 2.6773 0.38585 1.0001 0.14961 2.1182 0.3071 3.1026 0.44097 0.98432 0.13386 1.8348 0.2441 2.7797 0.29921 0.94494 0.0551 1.9844 0.0551 3.0474 0.0315 1.0631-0.0236 2.1497-0.0709 3.386-0.17325 1.2363-0.10238 2.6222-0.25986 3.8034-0.44886s2.1576-0.40948 3.0868-0.68509c0.92917-0.27562 1.8111-0.60634 2.9293-1.008 1.1182-0.4016 2.4726-0.87405 3.575-1.2127 1.1025-0.3386 1.9529-0.54334 2.6616-0.65356 0.70875-0.11022 1.2757-0.12595 1.9293-0.0708 0.65362 0.0552 1.3938 0.18114 1.945 0.33869 0.55123 0.15755 0.91345 0.34654 1.4568 0.68517s1.2678 0.82684 1.9134 1.4163c0.64567 0.58944 1.2126 1.28 1.7355 1.9538 0.5229 0.67382 1.0018 1.3309 1.4584 1.9322 0.45659 0.60136 0.89089 1.147 1.3698 1.676 0.47888 0.52897 1.0023 1.0412 1.5925 1.5201 0.59023 0.47883 1.2473 0.92428 1.9489 1.3419 0.7016 0.41759 1.4477 0.80735 2.0825 1.1192 0.63477 0.31181 1.1582 0.54566 1.715 0.70151 0.55681 0.15586 1.147 0.23381 1.9433 0.30062 0.79625 0.0668 1.7985 0.12249 2.7339 0.15033 0.93544 0.0278 1.804 0.0278 2.7729-0.0501 0.96885-0.078 2.0379-0.23388 3.2406-0.49003 1.2027-0.25614 2.539-0.61249 4.009-1.0579 1.47-0.44546 3.0736-0.97999 4.6326-1.5591 1.5591-0.57909 3.0736-1.2027 4.5102-1.8264 1.4366-0.62364 2.7952-1.2472 4.087-1.8932 1.2918-0.64591 2.5168-1.3141 3.7418-2.0379 1.225-0.72386 2.45-1.5034 3.5413-2.2606 1.0913-0.75726 2.049-1.4922 3.0147-2.2996s1.9392-1.687 3.1347-2.8198c1.1955-1.1328 2.6129-2.5187 3.9201-3.8258s2.5041-2.5356 3.8742-3.9373c1.3702-1.4017 2.9136-2.9765 4.457-4.457s3.0868-2.8663 4.52-4.142c1.4332-1.2757 2.756-2.4411 3.9058-3.3703 1.1497-0.92921 2.1261-1.6222 3.2916-2.4096 1.1654-0.78746 2.5198-1.6694 3.6066-2.2994s1.9056-1.008 2.8191-1.4174c0.91345-0.40948 1.9214-0.85044 3.0711-1.3229 1.1497-0.47247 2.4411-0.97642 3.9373-1.5119s3.197-1.1024 4.9137-1.6379c1.7167-0.53547 3.449-1.0394 5.1499-1.6536s3.3702-1.3387 4.9609-2.1261c1.5906-0.78746 3.1025-1.6379 4.474-2.4413 1.3715-0.80343 2.6026-1.5598 3.9643-2.506s2.8539-2.082 4.2348-3.1845c1.3809-1.1025 2.6504-2.1716 3.8197-3.2295 1.1693-1.0579 2.2384-2.1047 3.3854-3.3742 1.147-1.2695 2.372-2.7617 3.4003-4.1279 1.0283-1.3662 1.8598-2.6063 2.6851-3.8248s1.6442-2.4154 2.5104-3.5652 1.7796-2.2521 2.8663-3.512c1.0867-1.2599 2.3466-2.6773 3.5908-3.953 1.2442-1.2757 2.4726-2.4096 3.575-3.3546 1.1025-0.94496 2.0789-1.7009 3.2443-2.5671s2.5198-1.8426 3.9845-2.8191c1.4647-0.97645 3.0396-1.9529 4.9452-3.0238 1.9057-1.071 4.142-2.2364 6.3447-3.2933 2.2027-1.0569 4.3717-2.0053 6.4029-2.8025s3.9243-1.443 5.8843-2.0333c1.96-0.59022 3.9868-1.1248 6.2252-1.637 2.2384-0.51226 4.6884-1.0022 6.8933-1.3809 2.205-0.37863 4.165-0.64589 5.7129-0.81293 1.548-0.16703 2.6838-0.23385 3.5747-0.31181 0.8909-0.078 1.5368-0.16705 2.1604-0.35638s1.2249-0.47887 1.7595-0.74614c0.53453-0.26727 1.0022-0.51227 1.4811-0.89088 0.47881-0.3786 0.96879-0.89086 1.5145-1.5368s1.147-1.4254 1.637-2.1715c0.48999-0.7461 0.86861-1.4588 1.147-2.1047 0.2784-0.64587 0.45657-1.2249 0.62362-1.8931s0.32296-1.4254 0.51228-2.1716c0.18931-0.74615 0.41203-1.4811 0.70158-2.3386 0.28954-0.85751 0.6459-1.8375 1.0691-2.7507 0.42318-0.91321 0.91316-1.7595 1.4923-2.5837 0.57911-0.82413 1.2473-1.6259 1.8932-2.3052s1.2695-1.2361 2.0714-1.8375 1.7818-1.2473 3.7195-2.5391 4.8331-3.2295 6.5926-4.3988c1.7595-1.1693 2.3831-1.5702 3.2407-1.9822 0.85754-0.41206 1.9489-0.83523 2.8398-1.1804 0.89091-0.34523 1.5813-0.61249 2.5725-0.76838 0.99119-0.15589 2.283-0.20043 3.7196-0.16701 1.4366 0.0334 3.0179 0.14479 5.4201 0.43069 2.4021 0.28591 5.625 0.74631 8.7011 1.1498 3.0761 0.40345 6.0054 0.74992 8.982 1.0964s6.0003 0.69295 8.7092 0.88193c2.7088 0.18897 5.1026 0.22047 7.15 0.20472 2.0474-0.0158 3.7482-0.0787 5.6066-0.29926 1.8584-0.2205 3.8742-0.59847 5.7956-1.0552 1.9214-0.45673 3.7482-0.99218 5.52-1.5828 1.7718-0.59059 3.4884-1.2363 5.1972-1.945 1.7088-0.70871 3.4096-1.4804 5.1893-2.4175 1.7796-0.93708 3.638-2.0395 5.7169-3.3939 2.0789-1.3544 4.3782-2.9608 6.717-4.6144 2.3387-1.6537 4.7168-3.3545 6.8508-4.9137s4.0238-2.9766 5.8192-4.394c1.7954-1.4174 3.4962-2.8348 5.0869-4.2207 1.5906-1.3859 3.071-2.7403 4.5357-4.142 1.4647-1.4017 2.9136-2.8505 4.5042-4.5987 1.5907-1.7482 3.323-3.7955 4.9294-5.8114 1.6064-2.0159 3.0868-4.0002 4.583-6.1578 1.4962-2.1576 3.008-4.4884 4.2302-6.4547 1.2222-1.9663 2.1546-3.5679 3.1776-5.5047 1.023-1.9368 2.1366-4.2085 3.1612-6.5026s1.96-4.6104 2.7618-6.7262c0.80182-2.1159 1.47-4.0313 2.205-6.4145s1.5368-5.234 2.3386-8.1294c0.80181-2.8954 1.6036-5.8354 2.2914-8.3736 0.68784-2.5382 1.2617-4.6746 1.8321-6.798 0.57042-2.1234 1.1374-4.2337 1.5154-5.7771s0.56697-2.5198 0.61425-3.4647c0.0473-0.9449-0.0472-1.8583-0.40937-2.8663-0.36216-1.0079-0.99211-2.1103-1.6063-2.9608s-1.2126-1.4489-1.8898-1.9372-1.4331-0.86625-2.3781-1.0868c-0.94496-0.22055-2.0789-0.28355-3.1026-0.15759-1.0238 0.12596-1.9372 0.44093-3.3074 1.2914-1.3702 0.85047-3.1971 2.2364-4.1106 2.9293-0.91347 0.69297-0.91348 0.69278-10.048 6.6144z",
  6 : "M316.8,101.5c15.4,9.2,159,93,165.6,97c8.1,5,10.4,9.9,10.4,14.7c0,3.6-4.3,10.7-12.4,15.1   c-8.1,4.4-17.8,9.4-18.7,18.9s4.6,34.7-8.3,45c-13,10.3-28.3,22.8-69.8,22.8c-16.9,0-43.5-11.2-57.5-19.5   c-14-8.3-76.4-44.8-83-48.3s-14.7-6.6-23-6.4s-21.7,4.6-30.3,11.2c-8.6,6.6-17.8,13.2-34.2,13.2c-13.8,0-26.1-14.3-29.2-17.8   c-3.1-3.5-15.4-15.1-30.5-15.1s-34.2,5.9-43,14c-8.8,8.1-14.9,14.3-14.9,31.4s14.5,20.4,23.3,20.4c5.9,0,13-2,29.6-2   s41.7,13.6,69.6,13.6S285,308,292.6,308c7.7,0,22.4,1.3,36.7,7c14.3,5.7,51.8,27,99.2,27c16.7,0,48.5-1.5,65.9-6.4   s101-33.8,114.4-38.9c4.2-1.6,36.5-15.3,64.1-29c22.2-11,31.9-15.2,41.5-22.4c2.9-2.2,4.8-4.1,4.8-7.9s-5.2-6.4-7.6-8.1   c-2.4-1.7-12.8-7.8-15.8-9.8c-3-2-11.2-7.4-11.2-19c0-11.6,7.4-21.4,19.5-21.4s19.1,0,22.9,0s11.6,0.8,18.4-8.6   s10.6-15.7,11.1-17.4s1.9-5-0.9-6.8c-2.8-1.8-5.3-3.4-6.1-3.9s-2.5-2.7-1.3-7.8c1.2-5.1,6.7-23.3,7.1-26.9c0.4-3.6,1.2-10.9-6.2-11   c-7.4-0.1-472.7-18.4-493.1-19.3c-20.4-0.9-117.2-4.6-122.5-4.6s-10.2,2-10.2,8.4c0,6.4,3.4,8.3,6.3,10.7   c2.9,2.4,26,17.6,28.8,19.5s8.4,4.8,16,4.8c4.2,0,6.8,0,9.2,0c7.1,0,14.1-2.8,19.2-5.3c5.1-2.5,31.6-15.8,36.9-18   c5.3-2.2,12.6-2.9,20.3-2.9c7.7,0,18.4,0,23.2,0s17,2.8,22.1,5.3S316.8,101.5,316.8,101.5z",
  7 : "M576.1,84.5c-21.8,0.8-83,1.9-97.6,2.4C464,87.4,447,83.1,431,80.6c-16-2.4-48.5-10.2-73.8-10.2   s-83.5,7.8-97.1,10.2c-13.6,2.4-35,9.7-41.7,12.1c-6.8,2.4-6.3,7.3-7.8,14.6c-1.5,7.3-2.9,14.1-14.1,19.4   c-11.2,5.3-21.8,9.7-26.7,13.1c-4.9,3.4-10.7,8.7-15,21.8c-4.4,13.1-47.1,131.1-50,137.9c-2.9,6.8-0.5,16,1.5,20.4   c1.9,4.4,9.2,17.5-0.5,25.7s-58.5,54.8-65.5,59.7c-8.5,5.9-6.2,26.3,8.3,24.8c12.2-1.3,94.7-15.5,104.4-17   c9.7-1.5,31.1-5.3,52.4-2.9s39.3,5.8,48.5,7.3c9.2,1.5,21.4,3.4,28.6-11.2s9.7-19.9,12.1-29.1c2.4-9.2,6.3-22.8,1.9-41.3   c-4.4-18.4-14.1-52.9-15.5-59.2c-1.5-6.3-1-14.6,2.9-19.9c3.9-5.3,12.9-19.4,14.5-22c1.5-2.6,4.8-8.1,14-3.5   c3.1,1.5,8.3,5.5,13.6,5.7s163.5-6.4,166.4-6.4c2.9,0,6.6-1.1,8.8,4.4c2.2,5.5,4.4,7.9,9,6.1c4.6-1.8,38.6-17.8,49.4-22.4   c10.8-4.6,32.3-16,45.9-28.8c13.6-12.7,62.1-64.1,65.9-67.8c3.7-3.7,14.3-11.6,27.7-17.8c13.4-6.1,34.9-15.8,38.6-17.8   c3.7-2,9.9-5.7,6.4-14s-10.8-24.4-14-29.6c-3.3-5.3-9.9-11.4-22.6-5.7s-78.1,33.6-86.9,37.5c-8.8,4-20.4,7.2-26.3,8.1   C588.1,83.8,581,84.3,576.1,84.5z",
  8 : "M167.2,123.7c8.6-12.2,23.1-29.3,31.9-38s24.9-25.2,39.5-30.7s14.6-7.6,17.9-10.2c3.2-2.6,4.8-4.2,6.7-5.8   s4.9-3.7,9.1,0s19,14.8,23.5,18.5c4.5,3.7,14.7,11.9,22,15.9s37.2,22.1,44.2,26.8c7,4.7,15.6,12.6,20.7,15.7   c12.4,7.5,34.6,13.1,42.6,17.5c8,4.4,32,23.8,38.2,27.7s16.6,7.9,30.1,5.6c15.4-2.6,25.6-16,27.9-30.5c1.2-7.7,0-15.1,0.1-20.1   c0.1-4.9,2.4-15.4,21.7-18.5c19.3-3.2,79.2-10.8,84.6-11.1s10,0.9,11.3,7.2c1.3,6.4-2.7,10.6-5.9,14.3c-3.2,3.6-6,7.2-6.1,11.1   c-0.1,3.8-1.2,13.2-3.7,17.8c-2.5,4.6-3.1,8.5,0,10.2s9.3,1.3,9.1-5.7c-0.2-7,0.8-13.1,0.9-15.1s-0.2-8.8,3-10.9   c3.2-2.1,6.4-3.5,11.3-1.4c4.9,2.1,17.8,8.5,20.9,10.5c3.1,2.1,4.6,3.1,6.8,5.6s1.8,7-0.8,9.1c-2.5,2.1-38.4,32.7-43.2,36.8   c-4.8,4.1-21.5,15-31.1,19.3c-9.5,4.3-28.5,12.6-39.8,14.6c-11.3,2-24.6,2.7-34.9-0.9c-10.3-3.6-59.5-20.3-65.2-22.4   s-35.6-17.7-43.7-24.5c-8.1-6.8-23.8-17.8-25.2-19c-1.4-1.2-4.1-1.4-5.3-0.1c-1.2,1.3-2.9,3.3-3.6,4.2c-0.8,0.9-2.5,1.3-4.2,0   c-1.6-1.3-5.3-4-6.3-5c-1-1.1-1.6-1.8-1.8-4.5s-0.9-4.6-2.2-5.8c-1.3-1.2-83-64.9-84.4-65.9c-1.4-1-4.7-1.8-12.3,0.1   c-7.6,1.9-18.5,6-22.1,8.2c-3.5,2.2-21.2,10.3-33.9,30.7c-1.1,1.8-0.1,7.4,0.2,10.8c0.3,3.4,0.1,9.2-1.9,11.4   c-2,2.2-31.7,44.6-32.7,45.9c-1,1.3-3.6,4-7.6,2c-4-2-8.8-4.4-11-0.2c-2.2,4.2-13.1,25.2-15,31.8s-4.7,19.8-3.2,29.4   c1.5,9.7,3.8,12.5,4.9,15.4c1.1,2.9,1,7.1-0.7,9.8c-1.6,2.6-3.7,4.3-7.7,2.5c-4-1.8-17.3-7.8-27.3-20.1c-2-2.5-2-5.9,2.4-9.1   s6-8,6.3-13.5s2.6-16.1,5.8-23.7c1.6-3.8,9.2-21.1,18-37.8C155,142.7,165.2,126.7,167.2,123.7z",
  9 : "M701.1,301.8c0,0-526,0-540,0c-16.7,0-28.1-6.1-28.1-22.4c0-15.4,0.9-34.2-18-42.1   c-18.9-7.9-43-16.7-52.7-22.4c-9.7-5.7-25-22.4-25-51.4c0-13.2,8-32.1,22.8-46.1c17.8-16.8,48.3-27.7,70.7-27.7   c31.2,0,117.2,0,127.3,0c12.7,0,29.4,10.1,29.4,26.8c0,31.2-29.9,50-55.8,50c-28.1,0-83,0-91.8,0c-8.8,0-19.8,4.4-19.8,18   c0,12.7,7,15.8,12.3,18.9c5.3,3.1,41.3,27.7,47.4,31.6c6.1,4,34.2,24.1,65.4,24.1s39.1,0,47.9,0c8.8,0,23.7-4,23.7-19.8   c0-5.3,0-11,0-15.4c0-4.4,1.3-17.6,9.2-29c7.9-11.4,51.7-73.1,56.2-79.9c6.1-9.2,34.7-21.5,54-11C460,117.2,652.8,233.8,662,238.6   s18.4,5.3,25-1.8c6.6-7,6.6-22.8-0.9-41.3c-7.5-18.4-24.1-24.6-32.9-27.7c-8.8-3.1-28.1-6.6-33.4-19.3c-5.3-12.7-2.6-27.7,4.8-36   c7.5-8.3,21.5-11,30.3-8.3c8.8,2.6,65.9,22.4,72.9,24.6s10.5,5.3,10.1,14s-4,48.7-4,54s1.3,7.9,6.6,9.2c5.3,1.3,7.5,1.8,10.1,2.2   s6.1,1.3,6.1,6.6c0,5.3,0,27.7,0,42.6C756.9,272.4,746.3,301.8,701.1,301.8z",
  10 : "M352.9,103.8c19.4,3.6,92.9,19.7,105.7,23.3c12.8,3.6,24.6,10.5,34.5,16.1c9.8,5.6,12.2,7.5,14.2,8.7   s4.9,1.9,7.8-1.2s3.9-4,6.1-6c2.3-2.2,7.2-2.1,10.1,0.7c2.7,2.6,2.7,9.4-0.2,13.3c-3.9,5.3-15.3,19-25.2,25.8   c-9.9,6.8-36.4,18.2-40.1,19.7c-3.7,1.5-6.3,0.5-8.5-1.8s-3.7-3.8-4.9-4.7c-1.2-0.9-3.1-1.8-7-1c-3.9,0.8-26,7-29,7.7   s-8.1,4.1-11,5.9c-2.9,1.8-7.7,4.2-16.3,4.2s-20-5.9-28.3-9.8c-8.3-4-14.9-7.5-17.6-8.5c-2.8-1-7.2-1.7-9.3-0.3c-2,1.4-4,4.4-4,8.2   s-1.1,6.3-5.4,9.3c-4.3,3-12.7,4.2-23.1,1.6c-10.4-2.6-49.3-17.1-62.7-23.9c-13.4-6.7-38.3-24.3-51.9-35.8   c-13.5-11.5-13.5-11.4-14.5-12.2c-1-0.8-2.7-2.6-0.8-6.1c1.8-3.4,4-10.1-1.2-15.4c-5.1-5.3-25.5-22.5-36.1-30.1   S96.9,63.5,67.7,56.9c-19.1-4.4-24.1-5.2-27-5.8c-6.7-1.3-6.7-10.7,2.9-9.1c5.6,0.9,15.8,4.9,18.1,5.7c2.3,0.8,7.2,1.3,17.3,1.4   c16.5,0.2,65.9,2.3,72.5,2.6c6.6,0.3,16.1,1.5,28.8,4.5c12.6,3,153.2,33.9,157.2,35s5.2,0.4,5.3,5c0.1,4.6,0.9,5.8,5.2,6.6   C352.1,103.6,352.9,103.8,352.9,103.8z",
  11 : "M462.2,303.7c0,0-194,46.1-198,47c-4,0.9-8.8,3.5-13.6-5.7c-4.8-9.2-16.2-28.1-28.5-46.1   c-12.3-18-49.6-76.8-56.6-97c-7-20.2-18-52.2-31.6-74.2s-40-49.2-48.3-58.8S62.2,45.1,59.1,41.1S54.8,31,63.5,29.7   c8.8-1.3,40-3.1,61.5-2.2c21.5,0.9,61.5,9.2,75.5,13.2s61.9,15.4,74.2,17.1c12.3,1.8,81.7,7,90.4,7.9c8.8,0.9,11,4,12.6,7.5   c1.6,3.5-0.9,11.1-5.7,18.3s-11,13-18.7,18.9c-7.8,5.9-24.1,13.2-40.1,14.9c-16,1.8-34.5-2.6-48.4-6.4c-13.9-3.8-27.2-6.4-35.1-7   c-9.8-0.7-24.1,0.8-30.4,11.1c-5,8-7.9,15.5-7.6,23.4c0.3,7.9,6.4,16.2,10.2,23.6c3.8,7.3,19.5,37,22,41.3   c2.5,4.2,9.7,14.9,25.2,14.9s21.4-5.4,28.2-14.8c6.9-9.4,24.9-28.7,55-30c30.1-1.3,176.3,2,180.4,2.3c4.1,0.3,6.6,1,8.2,1.8   s8,3.8,9.7,5.1c1.6,1.3,4,2.3,6,9.4c2,7,16.2,56.5,17,59.9c0.7,3.4,1,6.3-0.9,9.8c-1.9,3.5-9.5,8.5-14.9,11.4   c-5.4,2.9-20.9,9.7-43.5,15.1C479.5,299.6,462.2,303.7,462.2,303.7z",
  12 : "M387.7,272.6c0,0-89.9-52.7-96.9-57.7c-7-5-7.8-15.7-7.6-25.8c0.1-10.1,3.7-30-7-41.4   c-10.7-11.4-32.3-32.8-35.1-36.1c-2.8-3.4-4.2-7.9,0.4-10.2c4.7-2.3,16.7-7.2,20.5-9.2c3.8-2,6.9-4.5,6.6-6.7   c-0.3-2.2-3.8-6.6-10.2-8c-6.4-1.5-29.4-2.6-33.1-2.3c-3.7,0.3-6.7,3.1-7.9,4.8c-1.2,1.8-87.5,123.5-91.5,128.8   c-4,5.3-4.7,16.1-1.2,21.4c3.5,5.3,8.2,6,14.3,5.4c6.1-0.6,11.7-0.7,15.4,0.4c3.7,1.2,9.2,3.1,9.5,13.9c0.3,10.8-11.4,13.9-18.1,12   c-6.7-1.9-28.5-10-35.6-13.2c-7-3.2-18.1-14.2-20.9-17.7c-2.8-3.5-7.9-12.4-10-22.2c-2-9.8-19.2-90-20-96.9   c-0.9-6.9,1.3-18.3,15.1-24.9c13.8-6.6,41.1-16.5,52.5-18.9c11.4-2.3,41.6-6.4,48.1-7.5c6.6-1,15.7-5.3,20.3-9.8s9.2-9.1,19.6-6.3   c10.4,2.8,15.1,4,19.3,5.1c5.6,1.5,17.1-0.2,20.9-4.2c5.1-5.4,11.3-13.5,19.9-13.5c8.6,0,15.1,5.6,19,12.3   c4,6.7,9.7,12.9,12.1,14.8s6.4,4.1,10.5,5.6c4.1,1.5,115.2,45.4,121.6,48c6.4,2.6,31.9,13.9,38,17.3c6.1,3.4,19.9,8.2,20.9,23.7   c1,15.5-11,22-15.7,24.7c-4.7,2.8-20,13.9-27.5,22.7c-7.5,8.8-27.4,30.3-29.9,33.4s-2.5,6.7,2,10.1c4.5,3.4,6.9,4.8,6.7,9.4   c-0.1,4.5-4.2,7.6-6.9,10.5s-11.6,10.8-19.3,12.6c-7.8,1.8-9.5,1.3-12.7-0.4C391.1,274.6,387.7,272.6,387.7,272.6z",
  13 : "M155.8,217.6c0,0-104.8,60.2-109.1,62.4c-4.2,2.2-7-0.9-4.2-6.5c2.8-5.5,12.4-24.5,16.6-33s19.9-28.1,32.7-38   c12.7-10,34-27.3,39.3-31.6c12-9.8,7.8-15.7,21-25.8c13.3-10.2,24.2-2,38.8-13.3c7.6-5.9,33.8-21,40.1-25.3   c6.3-4.2,14.8-8.5,25.1-11.6c10.3-3.1,159.5-45,163-45.8c3.5-0.7,10.2-2.2,14.8,5.7c4.6,7.9,7.4,9.2,16.1,7.4s12.7-3.7,15.9-4.2   c3.1-0.6,10-3.5,16.6,6.1c6.6,9.6,33.4,49.7,37.3,55.2c8.1,11.3-9.8,26.4-18.6,13.1c-6.4-9.6-12-19.2-14-22.7s-6.3-10.7-16.2-7.2   c-10,3.5-34.1,11.6-47.6,14.2c-13.5,2.6-44.1,7.2-52.4,8.7s-15.3,8.9-16.6,16.6c-1.3,7.8-1.5,11.8-2,19.2   c-0.6,7.4,6.6,25.3,18.6,30.1c12,4.8,60.5,24.7,68.3,27.7c7.8,3,17.2,13.4,9.8,25.5c-7.6,12.4-9.8,22,0.9,29   c10.7,7,30.8,19.6,35.8,23.1s9.8,10.2,5.4,17s-12,17.4-16.4,22.7s-9.2,8.7-17.2,8.9c-7.9,0.2-29.2-8.7-36-13.1   s-32.3-26.6-43.2-48.9c-7.2-14.7-20.3-46.9-39.9-57.6c-16.5-9-34.2-16.5-39.3-18.6c-6.5-2.8-15.5-4.1-24-0.7   c-8.5,3.3-38.2,15-44.3,17c-6.1,2-16.4,3.9-29.9,5c-13.5,1.1-31.6,2.4-34.7,2.6c-3.1,0.2-4.1-2.4-3.5-6.3   C163,220.3,163.4,212,155.8,217.6z",
  14 : "M284.4,322.9c0,0-224.9,0-231.8,0s-9.1-3.6-9.1-7s0.8-5.5,4.7-8.8c4-3.3,14-10.3,18.2-13.1s19-9.2,33.8-9.2   s60.6,0,65.4,0c4.8,0,14.7-4.3,14.7-14.5c0-10.2-9.1-13.9-12.2-15.5s-21.2-8.6-24-10c-2.9-1.4-8.5-3.4-10-12.6   c-1.5-9.2-18.9-90.8-19.9-96.4s-2-13.9-1.8-20.5c0.2-6.6,0.3-10,0.3-13.1s0.1-5-2.4-6.9c-2.5-1.9-35.9-25.8-40.4-29.7   s-8.5-9.1-6.5-20c2-10.9,11.7-13.3,25.2-14c13.5-0.8,26.1,1.9,32.7,2.7c6.6,0.9,23.5,3.5,26.5,4.1c3,0.5,4.5,1.1,5.9,2.7   c1.4,1.6,0.7,3.8,0.7,5.9s-0.9,5.7,1.8,7.9s30.1,22.9,33.5,25c3.4,2.1,8.7,4.4,13.6,1.6s20-11.6,22.4-12.8s10.3-1.6,13.8,1.9   c3.5,3.5,17.5,27.2,19.3,31.4s7.8,13,10.8,15.5s12.5,6.6,21.2,9.3s14.3,4.1,18.3,5.6c4.1,1.5,13.2,6.5,13.1,18   c-0.1,11.5-5.6,106.2-5.8,109.6s-2.7,8-11.1,6.8c-8.3-1.2-31.9-5.4-49.5-5.5c-10.5-0.1-15.5,6-15.3,12.6   c0.2,5.5,4.1,11.6,12.5,11.6c18.5,0,30.7,0,40.8,0c10.1,0,16.5,10.1,16.5,18.4c0,9.8-6.5,18.8-17.1,18.8   C290.9,322.9,284.4,322.9,284.4,322.9z",
  15 : "M97.2,258.9c0,0,128.7-217.9,133.9-227.2s13.8-10.8,23.5-4.5c9.7,6.3,6,19.4,4.1,22.4   c-6.1,9.2-20.3,33.4-23.9,40.3c-3.7,6.9-8.5,19.6-9.8,31c-1.3,11.4-1.5,11.9-1.8,14.3c-0.3,2.5-3.2,9.4-13,11.6s-22.2,5.1-28,6.7   s-9.2,7.3-7.8,15.7s11.7,11.9,21.8,9.5c10.1-2.3,32.6-7.8,58.2-5.9s49.9,19.9,70.8,19.6c18.6-0.3,35.9-10.4,42.3-13.8   c6.4-3.4,20.6-8.8,39.5-5.4c18.9,3.4,40.7,8,49.6,10s24,12.4,27.8,29.6c4.7,21-11,36.9-15.4,41.3s-18.7,18.4-25.6,29   c-6.9,10.5-16.7,25.5-19,28.2c-2.3,2.8-5.7,6.4-12.4,5.9c-6.7-0.6-29.4-5.1-41.6-13.6c-12.1-8.5-21.4-20.5-23.1-23.6   c-1.8-3.1-1.3-9.4,3.5-12.9c4.8-3.5,10.7-8.2,28.4-8.2c17.7,0,22.5-0.6,33.4-3.5c10.8-2.9,17.1-7.9,18.1-15.8   c1.3-9.7-0.9-18.9-14.5-22.1c-13.6-3.2-39.1-8.9-53.9-10.2c-14.8-1.3-42.6-1-61,1.5c-18.4,2.5-46.7,8-57.5,11.4   c-10.8,3.4-20,7.2-21.8,8c-1.8,0.9-5.9,1.5-7.5-3.2s-5-16.4-17.3-14.8c-12.3,1.6-11.9,11.1-11.9,16.5c0,5.4,2.9,81.5,2.9,88.1   c0,8.9-2.3,26.5-21.4,26.5s-36.6-4.7-44.3-7.2C115,331.7,90,314.9,90,289.4C90,280,91.7,268.2,97.2,258.9z",
  16 : "M419.3,301.7c-22,0-193.8,0-199,0c-5.3,0-4.4-3.3-4.4-5s0.5-5.8-1.9-5.8s-4.8,0.7-7.9,2   c-3.1,1.3-16.5,7.8-38.3,9.1c-11.5,0.7-31.2,0.9-47.2-7.2c-22.4-11.4-38.2-36.5-41.6-59.3c-1.6-10.4-13-81.5-13.6-84   c-0.6-2.5-1.8-3.7-4.5-3.8c-2.8-0.1-6.1-0.7-6.9-6.4s-2-10.7-5.1-16.7c-3.1-6-15.2-35.9-17.3-40.2s-4.2-19.6,10-22.5   c14.2-2.9,46.5-8.8,50.8-9.4c4.2-0.6,8.3-0.6,12,5.1s27.5,41.1,31.6,48c4.1,6.9,16.7,22.4,31.3,37.2c14.6,14.8,81.5,78.9,83.9,81.2   s3.8,5.7,10.8,3.7c7-2,11.3-2.8,18.3,0.1c7,2.9,9.4,7,11.1,8.8c1.8,1.8,3.7,3.5,7,3.5s202.8,4.1,210.1,4.2   c7.3,0.1,16.7,6.9,16.7,17.3c0,10.4-6.4,22-17.1,27.8c-18.7,10.2-47.4,12.4-71.1,12.4C424.7,301.7,419.3,301.7,419.3,301.7z",
  17 : "M265.4,178c0,0,195.2,113.9,198.7,115.6s6.4,2.3,8.8-2.3c2.3-4.7,28.4-51.2,29.9-53.6c1.5-2.3,3.5-3.2-2.3-7.3   c-5.9-4.1-53.3-34-63.5-39.2c-10.2-5.3-85.5-47.4-87.2-48.3c-1.8-0.9-2.3-1.5-5,2.3c-2.6,3.8-19.9,30.7-21.1,33.7   c-1.2,2.9-4.1,3.8-7.3,2c-3.2-1.8-23.7-14-28.1-16.1c-4.4-2-24-9.1-26.6-10.2c-2.6-1.2-6.7-1.2-8.8,2.9c-2,4.1-1.5,7-6.1,5.6   c-4.7-1.5-61.5-17.9-65.9-18.7c-4.4-0.9-6-1-7.6-0.8c-1.6,0.1-4.7-3.1-1.6-7.1c0,0,19.2-27.8,20.1-29.1c0.9-1.3,1.5-3.8,0.2-5.2   c-1.3-1.3-1.3-3.1-1.4-4c-0.1-0.9-0.2-2.7-1.5-4.2c-1.3-1.4-2.5-3.7-3.4-4.5c-0.9-0.8-1.6-4.1,0.1-5.8c1.8-1.8,3.5-4.9,4.2-5.9   c0.7-1,1.3-3.2-0.4-4.6c-1.8-1.4-19.3-13.5-31.6-19.9c-12.3-6.4-32.6-14.7-34.7-15.6c-2.1-0.9-8.8-1.5-12.6-0.2s-30.7,11.3-32.7,12   c-2,0.7-4,1.4-5.8,3.3C70,54.6,55.9,68,52.8,70.3c-3.1,2.3-12.1,8.5-13.6,9.3c-1.5,0.9-3,0.9-2.3,4.7s6.7,32.9,7.4,39.3   c0.7,6.4,3.5,22.9,3.7,25.5c0.2,2.5,0.7,7.1,6.6,6.1s25.6-5.2,28.9-5.6s9.9-2.2,19.3,0s28,6.5,31.7,7.2c3.7,0.8,10.9,0,14.9-1.6   c4.1-1.6,13.5-4.8,15.5-5.6c2-0.8,7.7-2,12.5-0.7c4.8,1.3,58,15.7,61.5,16.8c3.5,1.1,9.4,3.1,11.9,4.2   C253.1,171.1,263.9,177.3,265.4,178z",
  18 : "M509.4,232.3c0,0-21.1-155.9-21.9-161.9c-0.9-6-3.7-7.5-8.8-6.9c-5.2,0.6-11.4,0.9-17.2-2.6s-6.2-6-7.7-9   c-1.5-3-3.5-5.8-8.1-5.8s-7.3,4.5-7.8,8.5s-2,20.8-2,25.5c0,4.7,2.4,12.6,4.3,17.7s13,32,14.5,40.3c1.5,8.3,1.8,24.4,1.8,27.2   c0,4.5-5.9,11.2-17.8,11.2s-123.8-7-128-7.2s-15.7-3.9-22-7.6c-6.4-3.7-82.9-49.6-85.6-51s-5.7-0.4-7.1,1.4   c-1.4,1.9-18.9,25.6-21.3,29.6c-2.4,4.1-9.7,18.3-10.9,21c-2,4.4-5.1,6.6-8.9,1.9c-4.5-5.6-11.5-15-16-19   c-4.5-4-16.9-15.1-20.6-17.1c-3.7-2-7.7-1.6-9.8-0.3c-2.1,1.3-8.7,7.4-10.6,10.8c-2,3.4-44.7,82.1-47,86.2   c-2.3,4.1-8.7,13.6-10.4,15.6c-1.8,2-2.4,3.7-1.9,6.5c0.5,2.7,4.9,12.7,6.4,14.3s9.7,7.9,11.7,9.1s4.7,2.7,7.5,2.9   c2.7,0.1,4.7,0.5,6.3,1.9c1.5,1.3,1.3,3.6,1.3,5.9s0.2,11.2,0.4,14c0.2,2.9,2,7,5.2,9.5c3.2,2.5,21.4,17.1,24.4,20   c4.7,4.6,9.5,10.6,11.6,15.8c2.8,6.6,9.4,3.7,9.7-0.4c0.2-2.7,11.5-64.9,12.7-73.5c1.2-8.7,4.7-24.3,11.6-43.8   c6.9-19.5,14.6-40.8,15.5-43s3.4-3.8,6.7-1.4c3.3,2.4,49,39.9,53.5,43c6.3,4.5,10.6,8.5,22.8,8.5c8.9,0,10.9,0,12.8,0   c2,0,5.7,1.2,5.7,6c0,4.8,0,11.1,0,14.2s2.5,12.3,13.2,12.7c13.6,0.5,53.7,2.9,56,3c2.3,0.1,4.8-1.5,5.4-5.5c0.5-4,4-17,4.6-20.2   s2.9-4,7.4-4s34.5,2,36.8,2.3s4.5,1.8,4.5,6.6c0,3,0,4.9,0,7.4c0,2.4,1.6,6.3,4.7,9.1c3.1,2.9,9,4.2,13.6,4.2   c6.5,0,72.1,3.7,76.5,4c4.2,0.2,5.8-0.4,8.7-4c2.9-3.5,11.5-18,12.7-19.9c1.2-1.9,1.8-3.8,1.6-5.9   C509.7,237.6,509.4,232.3,509.4,232.3z",
  19 : "M40.4,221.2c0,0,137.1,109.6,143.1,114.7c6,5.1,17.2,12.1,21.6,8.9c4.5-3.2-11.1-39.8-12.4-45.5   c-1.3-5.7-2.9-21,12.1-31.2s29.6-18.1,36.6-21.9c7-3.8,10.5-9.5,13.7-17.5c3.2-8,4.5-12.1,14.3-15.6c9.9-3.5,14.9-6.4,16.2-19.7   c1.3-13.4,6.7-18.1,13.7-22.9s15.6-8.3,22.7-4.8c7.1,3.5,21.8,10.6,23.8,11.5c7.5,3.6,15.1-1.8,23.5-11.7c7.8-9.3,8.2-13,16.7-13.6   s11.9,4.4,14,8.2c2.2,3.8,4.2,6.6,9.1,5.7c4.9-0.9,40.2-8.1,42.7-8.6c4.1-0.8,6.3-2.6,8.8-5.5s56.3-69.3,59-72.3   c3.7-4,1.6-10.9-3.2-9.3c-3.4,1.1-69.1,21.3-83.1,24.7c-7.3,1.8-25.3,6.1-44.3,10c-17.2,3.5-35.2,6.6-46.8,8.8   c-23.8,4.6-66.4,9.9-86.3,11.3c-3.2,0.2-39.4,4.3-41.4,4.6c-2,0.3-4.5,1.4-2.7,4.5c1.8,3.1,12.1,15.9,16,21.5   c4,5.6,10.1,14.5,12.2,18.1c2.1,3.6,1.6,9.8-3.8,10.2c-5.5,0.4-15.1-0.4-17.3-1.2s-4.6-2.1-5.4-6.6c-0.8-4.5-2-7.1-3.8-9.4   c-1.9-2.3-8.6-10.6-11-12.4c-2.4-1.8-6.1-2.4-8.1-2.4s-5.5,0-6.9,0.3c-1.4,0.3-2.7,2.1-1.8,5.2s22.2,38.3,23.3,41.3   c1.1,3,1.1,10.2,1.1,12.2s-5.3,13.9-6.4,15.9c-1.1,2-2.7,2.5-4.4,3.4c-1.6,0.9-13.4,6.5-15.7,7.6c-2.3,1.1-8,2.2-14.9,1   c-6.9-1.2-19-3.1-25.6-15.4c-3.5-6.6-24.9-34.9-26.8-37.2c-1.9-2.3-4.3-4.4-9.7-2.7c-5.4,1.6-62.1,26.1-65,27.7s-3.5,4.8-1.8,6.6   C38,219.3,40.4,221.2,40.4,221.2z",
  20 : "M94.7,36.2c0,0,79,9.1,99.8,10.5c20.8,1.5,75.5,5,95.7,5.9c20.2,0.9,59.1,3.5,79.9,5.6   c20.8,2,79.9,7.9,92.2,9.1c12.3,1.2,26.9,3.4,32.3,4.8c5.5,1.3,5,4.9,4.6,8.6c-0.4,3.6-1.5,16.6-1.8,18.2c-0.2,1.6-0.7,3.8,3.4,5.8   c4.1,2,6.9,2.9,8.3,3.5c1.4,0.7,4,1.5,3.6,6.1c-0.3,4.6-1.8,16.2-2.7,21.2c-1,4.9-7.9,22.4-11.1,28.6c-3.2,6.3-71.3,130.7-74,135.9   c-2.6,5.2-6.4,9.8-7.9,12.4c-1.5,2.6-2.2,6.6,2,9s9.9,4.6,13,7c3.1,2.4,3.7,6.6,1.1,8.6c-2.6,2-26.3,20-29.2,22.2   c-2.9,2.2-12.1,0.2-11.4-7.5c0.7-7.7,8.1-90,8.3-95.5c0.2-5.5-2-9-6.6-10.8c-4.6-1.8-18.4-5-23.9-14.9c-5.5-9.9-8.8-20.2-15.6-24.1   c-6.8-4-10.5-4.2-16.5-4.6s-34.5-2.9-38.9-3.5c-4.4-0.7-9.2-4.6-10.5-10.8c-1.3-6.1-2.6-9.7-4-14c-1.3-4.4-4.8-5.9-7.7-7.5   c-2.9-1.5-40.6-20.2-43.7-21.3c-3.1-1.1-7-2.2-11.4-2.6c-4.4-0.4-113.7-11-116.3-11.2c-2.6-0.2-5.9-2-6.8-9.2   c-0.9-7.2-5.7-40.4-6.1-43.9c-0.7-5-6.1-6.5-8.8-4.6C80.4,75.7,78,86,70.6,85c-7.5-1.1-8.6-4.8-11.4-5s-19.8-1.8-21.3-2   c-1.5-0.2-5-2.2-4-7.7c1.1-5.5,5-19.1,16.7-27.9s20-8.1,29.9-7.5S94.7,36.2,94.7,36.2z",
  21 : "M418.1,224.6c15.1,8.9,33.1,19.5,34.9,20.3c2.9,1.5,9.3,1,11.2-0.7c2-1.7,4.6-4.4,6.4-8.1c1.7-3.7,10-29.8,11.2-34.2s1.2-12.7,0.5-17.8c-0.7-5.1-11-43.5-18.1-56.7s-18.1-30.8-24.7-34.7S420,82,413.4,80.7s-96.5-19.8-105.1-21c-8.6-1.2-28.8-1.7-46.7,2.4s-97,26.9-97,26.9 M299.5,326.6c24.9,6,42.7,10.4,45.5,11c10,2.2,22.7-0.5,25.4-14.9c2.7-14.4,3.9-21,4.9-31.5c1-10.5,3.9-33.5-19.8-50.8s-105.6-73.6-112.7-78.7c-7.1-5.1-14.2-13-14.2-29.8s11-35.4,21.8-38.4s34-7.8,41.8-8.8s18.3-2.7,23.5,5.6c5.1,8.3-4.9,18.3-7.3,21.8s-10,13.7,0,25.7s24.4,4.2,30.3-2.2s12.2-13.4,17.6-18.8s12.2-11.2,21.5-13.7c9.3-2.4,21-4.9,25.9-5.9c4.9-1,8.8,2,11,5.9s-1,11-6.1,15.2c-5.1,4.2-22.2,20-27.1,24.7c-4.9,4.6-10.8,10.5-10.8,33s22.7,34.2,26.9,36.7c1.7,1,10.5,6.2,20.6,12.2 M164.6,89c-20.8,5.9-78.7,22.2-95.3,26.9s-31,13-29.6,23.7c1.5,10.8,12.7,16.9,16.1,19.3c3.4,2.4,7.3,4.6,7.3,12.2c0,13.4-14.2,12.8-14.2,50.7c0,33.7,32.3,52.2,51.3,56.6c22.9,5.3,134.7,32.6,199.1,48.2",
  22 : "m172.21 11.465c0.0557 1.5369 0.16705 4.6105 0.24503 6.2587 0.078 1.6482 0.12253 1.8709 0.30076 2.283 0.17823 0.41205 0.49004 1.0134 1.1638 2.0992 0.67377 1.0858 1.7094 2.656 2.3553 3.636 0.6459 0.97999 0.90203 1.3698 1.1804 1.8765 0.27839 0.50671 0.57906 1.1303 0.82402 1.7818 0.24497 0.65147 0.43428 1.3308 0.56232 1.9655 0.12804 0.63476 0.19486 1.225 0.22268 1.7428 0.0278 0.51782 0.0167 0.96326-0.0446 1.4031-0.0613 0.43985-0.17263 0.87415-0.36195 1.3196s-0.45659 0.90198-0.76283 1.3418c-0.30624 0.43986-0.65145 0.86302-1.069 1.2973-0.41759 0.4343-0.90757 0.87974-1.4532 1.3085-0.54567 0.42874-1.147 0.84077-1.7873 1.2138-0.64032 0.37306-1.3196 0.70714-1.9711 0.98555-0.65145 0.27841-1.2751 0.50113-1.9432 0.68488-0.66815 0.18376-1.3808 0.32852-2.1715 0.45103-0.79066 0.12251-1.6593 0.22273-5.4457 0.37236-3.7864 0.14962-10.49 0.34862-22.252 0.62136-11.762 0.27274-28.582 0.61922-39.701 0.77671-11.119 0.15749-16.536 0.126-19.375 0.08665-2.8387-0.03935-3.0986-0.08659-3.3348-0.19281-0.23624-0.10622-0.44885-0.27158-0.61425-0.43691s-0.28352-0.33069-0.36237-0.9843c-0.07885-0.65361-0.11822-1.7954-0.18122-4.9098-0.063-3.1144-0.14962-8.2012-0.22047-10.942-0.07085-2.7403-0.12597-3.134-0.21651-3.5829-0.090519-0.44884-0.21651-0.9528-0.41729-1.5473-0.20078-0.59453-0.47638-1.2796-0.78346-1.9056-0.30708-0.62603-0.64568-1.193-0.98033-1.697-0.33465-0.50398-0.66537-0.94494-1.0827-1.4253-0.41733-0.48036-0.92129-1.0001-1.4922-1.4923-0.57089-0.49219-1.2087-0.95677-1.8387-1.3623-0.62996-0.40556-1.252-0.75203-1.9411-1.0907-0.68902-0.33862-1.445-0.66935-2.2757-0.96467-0.83077-0.29532-1.7363-0.55517-2.4844-0.71663-0.7481-0.16146-1.3387-0.22445-2.075-0.25203-0.73629-0.02758-1.6182-0.0197-2.3033 0.01179-0.6851 0.03149-1.1733 0.08661-1.7757 0.1811-0.60242 0.09449-1.319 0.22835-2.1459 0.4764-0.82686 0.24804-1.7639 0.61026-2.6183 1.0197-0.85442 0.40948-1.6261 0.8662-2.4136 1.4332-0.78748 0.56698-1.5907 1.2442-2.2443 1.9372s-1.1576 1.4017-1.6143 2.1262c-0.45673 0.72448-0.8662 1.4647-1.1812 2.1143-0.31498 0.64968-0.53547 1.2088-0.70476 1.8624-0.16929 0.65363-0.28741 1.4017-0.37009 1.9884-0.08268 0.58666-0.12992 1.0119-0.20041 4.6837-0.07049 3.6718-0.16423 10.59-0.25566 14.806-0.09142 4.2164-0.18051 5.7309-0.31416 6.9336-0.13365 1.2027-0.31183 2.0936-0.50115 2.8731-0.18932 0.77952-0.38977 1.4477-0.63477 2.1047-0.245 0.65702-0.53454 1.3029-0.9577 1.9488-0.42316 0.64586-0.97996 1.2917-1.5702 1.9488-0.59022 0.65704-1.2138 1.3252-2.1158 2.0268-0.90201 0.70156-2.0824 1.4365-3.0735 2.0268-0.99112 0.59022-1.7929 1.0357-2.784 1.5591-0.99113 0.52341-2.1715 1.1248-3.2629 1.6036s-2.0936 0.83521-3.2072 1.2584c-1.1136 0.42318-2.3386 0.91317-3.3743 1.4254-1.0357 0.51228-1.882 1.0468-2.695 1.5368-0.81294 0.49-1.5925 0.93544-2.1939 1.4143-0.60142 0.4789-1.0246 0.99116-1.4812 1.5925-0.4566 0.60138-0.94658 1.2918-1.3141 2.1271-0.3675 0.8353-0.61249 1.8153-1.1916 4.0982-0.57909 2.283-1.4922 5.8688-1.9469 7.7304-0.45468 1.8617-0.45093 1.999-0.42342 2.1563 0.02751 0.15729 0.078696 0.33447 0.16933 0.49391 0.090639 0.15944 0.22056 0.30117 0.41549 0.44484 0.19493 0.14366 0.45478 0.28934 0.96466 0.4645s1.2698 0.3799 2.0198 0.65554c0.75006 0.27564 1.4902 0.62211 2.7502 1.3308 1.2599 0.70874 3.0395 1.7796 5.0712 3.1341s4.3152 2.9923 6.0712 4.2522c1.756 1.2599 2.9844 2.1418 3.9294 2.7797 0.94495 0.63782 1.6064 1.0315 2.6301 1.6536 1.0237 0.62209 2.4096 1.4725 4.9531 2.9372 2.5435 1.4647 6.2444 3.5435 9.1817 5.1263 2.9372 1.5828 5.1105 2.6694 6.9296 3.5671 1.819 0.89769 3.2837 1.6064 4.5751 2.1733s2.4096 0.99217 3.7483 1.4883c1.3387 0.4961 2.8978 1.063 4.394 1.5434 1.4962 0.48033 2.9293 0.87404 4.3625 1.1732 1.4332 0.29922 2.8663 0.50395 4.2443 0.63781 1.378 0.13385 2.7009 0.19684 5.8035 0.26771 3.1026 0.0709 7.9847 0.14961 15.151 0.19685 7.1659 0.0472 16.615 0.063 32.923-4e-5 16.308-0.063 39.475-0.20475 51.062-0.28342 11.587-0.0787 11.595-0.0944 11.634-0.16137 0.0394-0.0669 0.11024-0.18506 0.17128-0.39368 0.061-0.20861 0.11221-0.50782 0.13979-0.88184 0.0276-0.37402 0.0315-0.82286 0.0649-1.2363 0.0335-0.41345 0.0965-0.79141 0.19881-1.1458 0.10236-0.3544 0.2441-0.68512 0.44493-0.96867 0.20084-0.28355 0.4607-0.51979 0.77177-0.74817 0.31108-0.22838 0.6733-0.44886 0.94494-0.64177s0.45275-0.35827 0.59053-0.53147c0.13778-0.17319 0.23226-0.35429 0.28739-0.59439 0.0551-0.24009 0.0709-0.53932 0.19592-11.987 0.12505-11.448 0.35941-34.043 0.47659-46.165 0.11718-12.122 0.11718-13.77 0.0671-14.828-0.0501-1.0579-0.15031-1.5256-0.27837-2.088-0.12807-0.56239-0.28397-1.2194-0.4844-1.8709-0.20044-0.65147-0.44543-1.2974-0.80733-2.0101s-0.84075-1.4923-1.8708-3.0124-2.6114-3.7807-4.2874-6.1305c-1.676-2.3498-3.4466-4.7886-4.9278-6.871-1.4811-2.0825-2.6727-3.8086-3.8977-5.557-1.225-1.7484-2.4834-3.519-3.3242-4.7162-0.8408-1.1971-1.264-1.8208-1.6092-2.2551s-0.61245-0.67933-0.84577-0.84201-0.43274-0.24291-0.65058-0.29489c-0.21785-0.05198-0.45408-0.075602-0.63917-0.071703-0.1851 0.0039-0.31897 0.035397-0.4549 0.11613-0.13593 0.080732-0.27373 0.21066-0.384 0.3623-0.11028 0.15164-0.19296 0.32489-0.23461 0.4855-0.0417 0.16061-0.0423 0.30843-0.0426 0.38221-3.3e-4 0.07378-2.4e-4 0.073787 0.0554 1.6107z",
  23 : "M466.6,356.7c0,0-351.7,0-368.3,0c-22,0-23.2-18.9-23.2-22c0-3.1,0.2-14.4,14.3-22c14-7.6,39.3-20.4,47.5-25.7   s10.8-8.3,10.8-19.9c0-11.5-9.5-18.1-17.1-21.5c-7.6-3.4-36.1-18-39.8-20.1c-3.7-2.1-9.2-8.1-11.7-15.4   C76.4,203,41.5,105.1,39.7,98.8c-1.8-6.4-1.1-18.3,8.9-22.4c10-4.1,27.2-10.4,34.1-12.6s18,1.6,21.6,10.6s23.7,63,25.8,72.3   c2.9,12.8,21.3,13.4,23.4-0.4c1.5-9.8,9.9-90.4,11.1-99.1c1.2-8.7,7.2-19.4,22.9-18.5c15.7,0.9,18.7,9.3,19,15.5s3,22,10.8,34.8   s25.9,28.4,30.2,32.4c4.3,4,8.1,9.1,5.9,19.3c-2.2,10.2-11,39.8-12.6,46.4c-1.6,6.6-2.5,13.8,3.7,19.2c7,6.1,27.8,3.6,41-3.6   c13.3-7.2,42-18.8,63.3-70.5c4.6-11.2,20.3-53.5,23.4-60.8c3.1-7.4,12.8-16.9,25.8-16.9c13,0,34.9,0,40.6,0s11.7,2.3,16,9   s23.4,40.6,25.5,44.8c3.4,6.9,4.7,13.9,0.5,20.1c-4.2,6.1-55,68.2-58.5,72.4c-4.3,5.3-7.7,13.4-2.3,22.2   c5.4,8.8,69.7,103.3,72.5,108.1c2.9,4.8,3.6,9.3,3.6,13.6C496.2,340.5,493.2,356.7,466.6,356.7z",
  24 : "M235,123.9c0,0,15.7,134.9,16.5,142.3c0.9,7.4,3.4,13.1,12.8,12c9.4-1.1,44.1-8.5,50.7-10.2   c6.5-1.7,13.1-5.7,16.5-17.6c3.4-12,8.9-31.1,24.5-36.2c8.8-2.8,15.9-4.3,26.5-0.3s30.2,10.8,52.1,8.8s61.8-5.7,74.6-7.4   c12.8-1.7,11.7-10,11.7-12.2s-2.6-6.5-8.3-8.8c-5.7-2.3-40.1-11.7-58.1-18.5c-17.9-6.8-99.4-37-111-41.3   c-11.7-4.3-43.3-15.7-63.2-21.6S208,86.8,205.1,85.4c-2.8-1.4-7.1-1.4-6.5,3.1c0.6,4.6,1.4,10,1.6,12.1c0.2,2.1-1.2,4.6-4.2,5   s-20.2,3.4-33.1,8.7c-13,5.3-25.8,10.2-53.3,44.5c-13.5,16.9-35.1,42.7-43,52.4s-12.9,19.3-15.5,24.6s-24.6,49.5-26.6,53.9   s-0.4,13.8,7,20.2c8.5,7.3,36.3,9.4,38.6-22c0.8-10.2,5-46.8,5.3-50c0.3-3.2,2.5-8,4.5-11.4c2-3.4,13-19.6,15.1-22.7   c2-3.1,3.7-5,9.1-5.9c5.4-0.9,24.9-5,28.4-5.3c3.5-0.3,4.4,1.2,5,5.4c0.6,4.2,2.3,17.3,2.8,20.5c0.4,3.2,5.7,9.1,13.2,9.4   c7.5,0.3,11.7,0.1,16.1-0.1c4.4-0.3,11.1-7.2,9.5-19.3s-5.6-48.7-6-53.4s0.7-14.6,10.1-19.8c9.4-5.1,24.6-13.3,27.7-15.1   c3.1-1.8,5.6-2.8,9.5-3.4c4-0.6,6.1-0.9,8.6-0.9C231.4,116,234.1,115.8,235,123.9z"
};


const trackStyles: Record<number, React.CSSProperties & { orbSize?; orbSpeed?: string }> = {
  1: {
    transform: "scale(0.9) translate(8%, 3%) rotate(-5deg)",
    transformOrigin: "center",
     orbSize: 6 / 0.9
  },
  2: {
    transform: "scale(0.7) translate(-20%, 15%) rotate(-35deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.7
  },
  3: {
    transform: "scale(0.3) translate(210%, -150%) rotate(39deg)",
    strokeWidth: 12,
    orbSize: 6 / 0.3

  },
  4: {
    transform: "scale(0.8) translate(-12%, 0%) rotate(-35deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.8
  },
  5: {
    transform: "scale(0.73) translate(14%, -100%) rotate(32deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.73
  },
  6: {
    transform: "scale(0.51) translate(-37%, 0%) rotate(2deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.51
  },
  7: {
    transform: "scale(0.5) translate(-10%, -50%) rotate(23deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.5
  },
  8: {
    transform: "scale(0.65) translate(-40%, -20%) rotate(0deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.65
  },
  9: {
    transform: "scale(0.52) translate(-42%, -20%) rotate(0deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.52
  },
  10: {
    transform: "scale(0.78) translate(-19%, 40%) rotate(-12deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.78
  },
   11: {
    transform: "scale(0.71) translate(-30%, 23%) rotate(-20deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.71
  },
  12: {
    transform: "scale(0.8) translate(-20%, 23%) rotate(-20deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.8
  },
  13: {
    transform: "scale(0.68) translate(-15%, -54%) rotate(0deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.68
  },
   14: {
    transform: "scale(0.9) translate(10%, -75%) rotate(0deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.9
  },
  15: {
    transform: "scale(0.87) translate(-15%, -70%) rotate(-5deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.87
  },
  16: {
    transform: "scale(0.8) translate(-22%, -3%) rotate(-20deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.8
  },
  17: {
    transform: "scale(0.8) translate(-18%, -3%) rotate(-20deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.8
  },
   18: {
    transform: "scale(0.71) translate(-20%, -3%) rotate(-20deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.71
  },
  19: {
    transform: "scale(0.8) translate(-5%, -20%) rotate(17deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.8
  },
   20: {
    transform: "scale(0.7) translate(-20%, 60%) rotate(-40deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.7
  },
  21: {
    transform: "scale(0.75) translate(-9%, -40%) rotate(0deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.75
  },
   22: {
    transform: "scale(1.7) translate(25%, 15%) rotate(0deg)",
    transformOrigin: "center",
    strokeWidth: 3,
    orbSize: 6 / 1.7
  },
  23: {
    transform: "scale(0.7) translate(-20%, 40%) rotate(-35deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.7
  },
   24: {
    transform: "scale(0.75) translate(-2%, -43%) rotate(1deg)",
    transformOrigin: "center",
    orbSize: 6 / 0.75
  },
};




interface NeonTrackProps {
  circuitName?: string;
  circuitId?: number;
}

interface NeonTrackProps {
  circuitName?: string;
  circuitId?: number;
}

const NeonTrack = ({ circuitId }: NeonTrackProps) => {
  const id = circuitId ?? null;
  const path = (id && trackPaths[id]) || trackPaths[1]; // fallback (e.g., Bahrain)
  const customStyle = (id && trackStyles[id]) || {};

  // Optionally define per-track orb color/speed in trackStyles, else default
  const orbColor = (customStyle as any).orbColor || "#00fff7";
  const orbSpeed = (customStyle as any).orbSpeed || "30s";
  const orbSize = (customStyle as any).orbSize || 8;

  return (
    <div className="flex justify-center w-full overflow-visible">
      <svg
        viewBox="0 0 400 120"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-32 overflow-visible"
        style={{
          overflow: "visible",
          width: "100%",
          height: "auto",
          transform: "scale(0.9) rotate(-55deg)",
          transformOrigin: "center",
          transformBox: "fill-box",
        }}
      >
        <defs>
          <linearGradient id={`neonGradient-${id ?? "default"}`}>
            <stop offset="0%" stopColor="#ffffffff" />
            <stop offset="50%" stopColor="#000000ff" />
            <stop offset="100%" stopColor="#ffffffff" />
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="-1 0"
              to="1 0"
              dur="3s"
              repeatCount="indefinite"
            />
          </linearGradient>
        </defs>

        <g style={customStyle}>
          {/* === Main neon track === */}
          <path
            id={`track-${id ?? "default"}`}
            d={path}
            stroke={`url(#neonGradient-${id ?? "default"})`}
            strokeWidth={(customStyle as any).strokeWidth || 6}
            fill="none"
            style={{
              filter:
                "drop-shadow(0 0 1px #ea00ffff) drop-shadow(0 0 2px #5dffe4ff) drop-shadow(0 0 2px #ffffffff)",
            }}
          />

         {/* === Trail orb with smooth easing === */}
<circle
  r={orbSize}
  fill={`url(#trailGradient-${id ?? "default"})`}
  filter={`url(#motionBlur-${id ?? "default"})`}
  opacity={0.4}
>
  <animateMotion 
    dur={orbSpeed} 
    repeatCount="indefinite" 
    rotate="auto"
    calcMode="linear"
  >
    <mpath href={`#track-${id ?? "default"}`} />
  </animateMotion>
</circle>

{/* === Main bright orb with smooth easing === */}
<circle
  r={orbSize}
  fill={orbColor}
  style={{
    filter: `drop-shadow(0 0 4px ${orbColor}) drop-shadow(0 0 1px ${orbColor})`,
    willChange: 'transform',
  }}
>
  <animateMotion 
    dur={orbSpeed} 
    repeatCount="indefinite" 
    rotate="auto"
    calcMode="linear"
  >
    <mpath href={`#track-${id ?? "default"}`} />
  </animateMotion>
</circle>
        </g>


        
      </svg>
    </div>
  );
};





export default F1;