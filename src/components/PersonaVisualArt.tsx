import React from 'react';
import { AggregatedProfile, LifeCardProposal } from '../types/life';

interface PersonaVisualArtProps {
  profile: AggregatedProfile;
  proposal: LifeCardProposal;
  inverted?: boolean;
  compact?: boolean;
}

export const PersonaVisualArt: React.FC<PersonaVisualArtProps> = ({
  profile,
  proposal,
  inverted = false,
}) => {
  const items = proposal.discoveries.slice(0, 6);
  const leftItems = items.slice(0, 3);
  const rightItems = items.slice(3, 6);

  const titleMatch = proposal.catchphrase.match(/「([^」]+)」/);
  const mainNickname = titleMatch ? titleMatch[1] : 'PERSONA PROFILE';
  const subCatch = proposal.catchphrase
    .replace(/「[^」]+」\s*[—\-ー]?\s*/, '')
    .trim();

  const uStats = profile.unconsciousStats;

  return (
    <div
      className={`rounded-2xl border p-6 md:p-8 ${
        inverted
          ? 'bg-neutral-950 border-neutral-800 text-white'
          : 'bg-white border-black text-black'
      }`}
    >
      {/* Top Title Banner */}
      <div
        className={`pb-4 mb-6 border-b flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 ${
          inverted ? 'border-neutral-800' : 'border-neutral-200'
        }`}
      >
        <div>
          <div className="text-[10px] font-mono-code uppercase tracking-widest opacity-50">
            PERSONA OVERVIEW MAP // 人物像サマリー図解
          </div>
          <h3 className="text-base md:text-lg font-bold tracking-tight">
            {mainNickname}
          </h3>
        </div>
        <div className="text-xs opacity-75 font-medium">{subCatch}</div>
      </div>

      {/* Main Radial Layout: [Left 3 Traits] — [Center Black Silhouette Person] — [Right 3 Traits] */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Traits 1, 2, 3 */}
        <div className="lg:col-span-4 space-y-3.5 order-2 lg:order-1">
          {leftItems.map((disc, idx) => (
            <div
              key={disc.id}
              className={`relative p-3.5 rounded-xl border transition-all ${
                inverted
                  ? 'bg-neutral-900 border-neutral-700 text-white'
                  : 'bg-neutral-50 border-black text-black'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono-code font-bold ${
                    inverted ? 'bg-white text-black' : 'bg-black text-white'
                  }`}
                >
                  {disc.categoryTag}
                </span>
                <span className="text-[10px] font-mono-code opacity-70 truncate">
                  {disc.metricLabel}
                </span>
              </div>

              <div className="text-xs font-bold leading-snug mb-1.5">
                {disc.headline.replace(/^\d+\.\s*/, '')}
              </div>

              {disc.serviceBreakdown && disc.serviceBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {disc.serviceBreakdown.slice(0, 2).map((chip, cIdx) => (
                    <span
                      key={cIdx}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono-code border ${
                        inverted
                          ? 'bg-black border-neutral-700 text-neutral-300'
                          : 'bg-white border-neutral-300 text-neutral-700'
                      }`}
                    >
                      {chip.service}: {chip.stat}
                    </span>
                  ))}
                </div>
              )}

              {/* Connector Dot on Right Edge (Desktop) */}
              <div
                className={`hidden lg:block absolute top-1/2 -right-2 w-3 h-3 rounded-full border-2 -translate-y-1/2 ${
                  inverted
                    ? 'bg-white border-neutral-950'
                    : 'bg-black border-white'
                }`}
              />
              {idx < 3 && (
                <div className="hidden" />
              )}
            </div>
          ))}
        </div>

        {/* Center Column: Pitch-Black Silhouette Person (黒い影の人) + Radial Orbit Lines */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center order-1 lg:order-2 py-2">
          <div className="relative w-60 h-64 md:w-64 md:h-72 flex items-center justify-center">
            <svg
              viewBox="0 0 260 280"
              className="w-full h-full select-none overflow-visible"
            >
              {/* Outer Orbit Circles */}
              <circle
                cx="130"
                cy="130"
                r="112"
                fill="none"
                stroke={inverted ? '#404040' : '#d4d4d4'}
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <circle
                cx="130"
                cy="130"
                r="92"
                fill={inverted ? '#171717' : '#f5f5f5'}
                stroke={inverted ? '#525252' : '#000000'}
                strokeWidth="1.5"
              />

              {/* 6 Radial Leader Lines pointing to the 6 surrounding trait cards */}
              {[
                { x1: 38, y1: 68, x2: 2, y2: 45 },
                { x1: 24, y1: 130, x2: -8, y2: 130 },
                { x1: 38, y1: 192, x2: 2, y2: 215 },
                { x1: 222, y1: 68, x2: 258, y2: 45 },
                { x1: 236, y1: 130, x2: 268, y2: 130 },
                { x1: 222, y1: 192, x2: 258, y2: 215 },
              ].map((ln, idx) => (
                <g key={idx}>
                  <line
                    x1={ln.x1}
                    y1={ln.y1}
                    x2={ln.x2}
                    y2={ln.y2}
                    stroke={inverted ? '#a3a3a3' : '#000000'}
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={ln.x1}
                    cy={ln.y1}
                    r="3.5"
                    fill={inverted ? '#ffffff' : '#000000'}
                  />
                </g>
              ))}

              {/* 24-Hour Activity Ring Ticks around the Silhouette */}
              {profile.hourlyDistribution.map((cnt, hr) => {
                const maxCnt = Math.max(...profile.hourlyDistribution, 1);
                const angle = ((hr - 6) / 24) * Math.PI * 2;
                const r1 = 92;
                const r2 = 92 + 3 + (cnt / maxCnt) * 14;
                return (
                  <line
                    key={hr}
                    x1={130 + Math.cos(angle) * r1}
                    y1={130 + Math.sin(angle) * r1}
                    x2={130 + Math.cos(angle) * r2}
                    y2={130 + Math.sin(angle) * r2}
                    stroke={inverted ? '#ffffff' : '#000000'}
                    strokeWidth={cnt === maxCnt ? '2.5' : '1.2'}
                    opacity={cnt > 0 ? 0.35 + (cnt / maxCnt) * 0.65 : 0.15}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* THE BLACK SILHOUETTE PERSON (黒い影の人 — Gender-Neutral Anonymous Figure) */}
              <g>
                {/* Head Silhouette */}
                <circle
                  cx="130"
                  cy="92"
                  r="26"
                  fill={inverted ? '#ffffff' : '#000000'}
                />
                {/* Upper Body / Shoulders Silhouette (Clean Genderless Bust) */}
                <path
                  d="M 76 196 C 78 148, 98 126, 130 126 C 162 126, 182 148, 184 196 Z"
                  fill={inverted ? '#ffffff' : '#000000'}
                />
                {/* Subtle Collar / Thinking Hand Silhouette Accent */}
                <path
                  d="M 115 128 L 130 146 L 145 128"
                  fill="none"
                  stroke={inverted ? '#171717' : '#ffffff'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Laptop / Desk Silhouette in Front of Figure */}
                <rect
                  x="96"
                  y="174"
                  width="68"
                  height="26"
                  rx="4"
                  fill={inverted ? '#171717' : '#ffffff'}
                  stroke={inverted ? '#ffffff' : '#000000'}
                  strokeWidth="2.5"
                />
                <circle
                  cx="130"
                  cy="187"
                  r="3"
                  fill={inverted ? '#ffffff' : '#000000'}
                />
              </g>

              {/* Bottom Pill Label on Circle */}
              <rect
                x="45"
                y="210"
                width="170"
                height="24"
                rx="12"
                fill={inverted ? '#ffffff' : '#000000'}
              />
              <text
                x="130"
                y="226"
                textAnchor="middle"
                fill={inverted ? '#000000' : '#ffffff'}
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                TOTAL {profile.totalEvents.toLocaleString()} LOGS
              </text>

              {/* Sub-stats under badge */}
              <text
                x="130"
                y="252"
                textAnchor="middle"
                fill={inverted ? '#d4d4d4' : '#404040'}
                fontSize="10"
                fontFamily="monospace"
              >
                累計{uStats?.totalWatchHours || 0}h / ピーク{profile.peakHour}時台 / 即スキップ
                {uStats?.rapidSkipRatioPct || 0}%
              </text>
            </svg>
          </div>
        </div>

        {/* Right Column: Traits 4, 5, 6 */}
        <div className="lg:col-span-4 space-y-3.5 order-3">
          {rightItems.map((disc) => (
            <div
              key={disc.id}
              className={`relative p-3.5 rounded-xl border transition-all ${
                inverted
                  ? 'bg-neutral-900 border-neutral-700 text-white'
                  : 'bg-neutral-50 border-black text-black'
              }`}
            >
              {/* Connector Dot on Left Edge (Desktop) */}
              <div
                className={`hidden lg:block absolute top-1/2 -left-2 w-3 h-3 rounded-full border-2 -translate-y-1/2 ${
                  inverted
                    ? 'bg-white border-neutral-950'
                    : 'bg-black border-white'
                }`}
              />

              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono-code font-bold ${
                    inverted ? 'bg-white text-black' : 'bg-black text-white'
                  }`}
                >
                  {disc.categoryTag}
                </span>
                <span className="text-[10px] font-mono-code opacity-70 truncate">
                  {disc.metricLabel}
                </span>
              </div>

              <div className="text-xs font-bold leading-snug mb-1.5">
                {disc.headline.replace(/^\d+\.\s*/, '')}
              </div>

              {disc.serviceBreakdown && disc.serviceBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {disc.serviceBreakdown.slice(0, 2).map((chip, cIdx) => (
                    <span
                      key={cIdx}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono-code border ${
                        inverted
                          ? 'bg-black border-neutral-700 text-neutral-300'
                          : 'bg-white border-neutral-300 text-neutral-700'
                      }`}
                    >
                      {chip.service}: {chip.stat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
