import React, { useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { FrostedCard } from '@/components/ui/frosted_card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import '@/styles/driver_card.css';

const Playground = () => {
  const [accentStart, setAccentStart] = useState('#22c55e');
  const [accentEnd, setAccentEnd] = useState('#3b82f6');
  const [gradStart, setGradStart] = useState('#60a5fa');
  const [gradEnd, setGradEnd] = useState('#a78bfa');
  const [cardH, setCardH] = useState('72px');
  const [underStart, setUnderStart] = useState('#0ea5e9');
  const [underEnd, setUnderEnd] = useState('#22c55e');
  const [overlayColor, setOverlayColor] = useState('#222222ff');

  const driverGrad = `${gradStart}, ${gradEnd}`;


  const [cardWidth, setCardWidth] = useState(300);
  const [cardHeight, setCardHeight] = useState(320);
  const [borderSize, setBorderSize] = useState(7);

  return (
    <PageLayout title="UI Playground">
      <div className="space-y-8">
        {/* FrostedCard demo */}
        <section>
          <h2 className="text-xl font-semibold mb-3">FrostedCard</h2>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-sm">accentStart</label>
            <input type="color" aria-label="accentStart" className="h-8 w-10 p-0 bg-transparent border rounded" value={accentStart} onChange={(e) => setAccentStart(e.target.value)} />
            <label className="text-sm">accentEnd</label>
            <input type="color" aria-label="accentEnd" className="h-8 w-10 p-0 bg-transparent border rounded" value={accentEnd} onChange={(e) => setAccentEnd(e.target.value)} />
          </div>
          <FrostedCard className="w-full" accentStart={accentStart} accentEnd={accentEnd}>
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Sample Frosted Content</div>
              <Badge>Example</Badge>
            </div>
          </FrostedCard>
        </section>

        {/* Driver Card demo */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Driver Card</h2>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-sm">gradient start</label>
            <input type="color" aria-label="gradient-start" className="h-8 w-10 p-0 bg-transparent border rounded" value={gradStart} onChange={(e) => setGradStart(e.target.value)} />
            <label className="text-sm">gradient end</label>
            <input type="color" aria-label="gradient-end" className="h-8 w-10 p-0 bg-transparent border rounded" value={gradEnd} onChange={(e) => setGradEnd(e.target.value)} />
            <label className="text-sm">min-height</label>
            <input className="border rounded px-2 py-1 w-24 bg-background" value={cardH} onChange={(e) => setCardH(e.target.value)} />
          </div>

          <div
            className="driver-card"
            style={{ ['--grad' as any]: driverGrad, ['--card-h' as any]: cardH }}
          >
            <div className="title">
              <span className="mr-3 text-yellow-500">P1</span>
              <span className="font-bold name">Playground Driver</span>
              <Badge className="ml-3">Team</Badge>
            </div>
            <div className="content text-sm">
              <div className="stat"><span className="font-semibold" style={{ color: '#0a8f3a' }}>6</span><span className="muted">Wins</span></div>
              <div className="stat"><span className="font-semibold" style={{ color: '#2563eb' }}>12</span><span className="muted">Podiums</span></div>
              <div className="stat"><span className="font-semibold">68%</span><span className="muted">Podium Rate</span></div>
            </div>
            <div className="icon">
              <i>357</i>
              <span className="points-label">Points</span>
            </div>
          </div>
        </section>

{/* Gradient underlay + white card */}
        <section>
          <div className="w-full">
            {/* Gradient border/background */}
            <div
              className="rounded-xl shadow-lg"
              style={{
                backgroundImage: `linear-gradient(90deg, ${underStart}, ${underEnd})`,
                width: `${cardWidth}px`,
                height: `${cardHeight}px`,
                padding: `${borderSize}px`
              }}
            >
              {/* White overlay card inset at ~90% size */}
              <Card className="rounded-xl shadow-xl border-0 overflow-hidden h-full"
              style={{
                backgroundColor: overlayColor,
                opacity: 1
              }}>
                <CardHeader>
                </CardHeader>
                <CardContent>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
};
export default Playground;
