import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import {
  AggregatedProfile,
  LifeCardProposal,
  NormalizedEvent,
  ServiceSource,
} from '../types/life';
import { downloadUnifiedJson } from '../modules/parser/takeoutParser';

interface Step3LifeCardProps {
  profile: AggregatedProfile;
  proposal: LifeCardProposal;
  normalizedEvents: NormalizedEvent[];
  onBackToStep2: () => void;
  onResetToStep1: () => void;
}

const SERVICE_LABEL: Record<ServiceSource, string> = {
  youtube: 'YouTube',
  chrome: 'Google検索',
  gemini: 'Gemini',
  maps: 'マップ',
  notebooklm: 'NotebookLM',
};

export const Step3LifeCard: React.FC<Step3LifeCardProps> = ({
  profile,
  proposal,
  normalizedEvents,
  onBackToStep2,
}) => {
  const [nickname, setNickname] = useState('YOUR NAME');
  const [inverted, setInverted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);

  const selectedDiscoveries = proposal.discoveries.filter(
    (d) => d.enabled ?? true
  );

  const handleDownloadPng = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
      });
      const link = document.createElement('a');
      link.download = `life-card-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsExporting(false);
    }
  };

  const uStats = profile.unconsciousStats;

  return (
    <div className="space-y-8">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackToStep2}
          className="text-xs text-neutral-500 hover:text-black cursor-pointer"
        >
          ← 2. 項目の選択へ戻る
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadUnifiedJson(normalizedEvents, profile)}
            className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs text-neutral-700 hover:border-black cursor-pointer"
          >
            JSON保存
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isExporting}
            className="px-4 py-1.5 rounded-lg bg-black text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {isExporting ? '保存中...' : 'PNG画像として保存'}
          </button>
        </div>
      </div>

      {/* Name & Theme Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border border-neutral-200 rounded-xl p-4">
        <div className="flex items-center gap-3 flex-1">
          <label className="text-xs font-bold text-neutral-500 shrink-0">
            表示名
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full max-w-xs px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-bold text-black focus:outline-none focus:border-black"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setInverted(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
              !inverted
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-neutral-300'
            }`}
          >
            白ベース
          </button>
          <button
            type="button"
            onClick={() => setInverted(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
              inverted
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-neutral-300'
            }`}
          >
            黒ベース
          </button>
        </div>
      </div>

      {/* Monochrome Life Card */}
      <div
        ref={cardRef}
        className={`rounded-2xl p-8 md:p-10 border transition-colors ${
          inverted
            ? 'bg-black text-white border-neutral-800'
            : 'bg-white text-black border-black'
        }`}
      >
        {/* Header */}
        <div
          className={`flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-6 border-b ${
            inverted ? 'border-neutral-800' : 'border-neutral-200'
          }`}
        >
          <div>
            <div className="text-[10px] font-mono-code uppercase tracking-widest opacity-50 mb-1">
              WHAT IS YOUR LIFE? // {profile.period.startDate} —{' '}
              {profile.period.endDate}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              {nickname}
            </h2>
          </div>
          <div className="text-xs font-mono-code opacity-80">
            TOTAL {profile.totalEvents.toLocaleString()} GOOGLE ACTIONS
          </div>
        </div>

        {/* Unconscious Google Dependency Bar */}
        {uStats && (
          <div
            className={`grid grid-cols-2 sm:grid-cols-4 gap-3 py-5 border-b ${
              inverted ? 'border-neutral-800' : 'border-neutral-200'
            }`}
          >
            <div>
              <div className="text-[10px] font-mono-code uppercase opacity-50">
                YOUTUBE TIME
              </div>
              <div className="text-base font-bold font-mono-code">
                {uStats.totalWatchHours.toLocaleString()} 時間{' '}
                <span className="text-[11px] font-normal opacity-70">
                  (丸{uStats.totalDaysEquivalent}日分)
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono-code uppercase opacity-50">
                15S RAPID SKIP
              </div>
              <div className="text-base font-bold font-mono-code">
                {uStats.rapidSkip15sCount.toLocaleString()} 回{' '}
                <span className="text-[11px] font-normal opacity-70">
                  ({uStats.rapidSkipRatioPct}%)
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono-code uppercase opacity-50">
                MAX SINGLE DAY
              </div>
              <div className="text-base font-bold font-mono-code">
                {uStats.maxSingleDayHours} 時間{' '}
                <span className="text-[11px] font-normal opacity-70">
                  ({uStats.maxSingleDayDate})
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono-code uppercase opacity-50">
                PEAK HOURS
              </div>
              <div className="text-base font-bold font-mono-code">
                12時 / 7時 / 19時{' '}
                <span className="text-[11px] font-normal opacity-70">
                  (深夜{profile.lateNightRatio}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Catchphrase */}
        <div
          className={`py-6 border-b ${
            inverted ? 'border-neutral-800' : 'border-neutral-200'
          }`}
        >
          <div className="text-[10px] font-mono-code uppercase tracking-widest opacity-50 mb-1">
            ACTION-DRIVEN IDENTITY
          </div>
          <p className="text-lg md:text-xl font-bold leading-snug">
            {proposal.catchphrase}
          </p>
        </div>

        {/* Selected Discoveries with Cross-Service Breakdown Chips */}
        <div className="py-6 space-y-4">
          <div className="text-[10px] font-mono-code uppercase tracking-widest opacity-50">
            CROSS-SERVICE & UNCONSCIOUS DATA ({selectedDiscoveries.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedDiscoveries.map((disc) => (
              <div
                key={disc.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                  inverted ? 'border-neutral-800' : 'border-neutral-200'
                }`}
              >
                <div>
                  <div className="text-[10px] font-mono-code opacity-60 mb-1">
                    {disc.categoryTag} • {disc.metricLabel}
                  </div>
                  <div className="text-sm font-bold mb-1.5 leading-snug">
                    {disc.headline}
                  </div>
                  <div className="text-xs opacity-80 leading-relaxed whitespace-pre-line">
                    {disc.factStatement}
                  </div>
                </div>

                {disc.serviceBreakdown && disc.serviceBreakdown.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2 border-t border-neutral-500/20">
                    {disc.serviceBreakdown.map((chip, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono-code border ${
                          inverted
                            ? 'bg-neutral-900 border-neutral-700 text-neutral-200'
                            : 'bg-neutral-100 border-neutral-300 text-black'
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

        {/* Service Counts Footer */}
        <div
          className={`pt-5 border-t flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono-code ${
            inverted ? 'border-neutral-800' : 'border-neutral-200'
          }`}
        >
          <div className="flex flex-wrap gap-3">
            {(Object.keys(profile.serviceCounts) as ServiceSource[]).map(
              (srv) => (
                <span key={srv}>
                  {SERVICE_LABEL[srv]}: {profile.serviceCounts[srv].toLocaleString()}
                </span>
              )
            )}
          </div>
          <div className="opacity-50">WHAT IS YOUR LIFE?</div>
        </div>
      </div>
    </div>
  );
};
