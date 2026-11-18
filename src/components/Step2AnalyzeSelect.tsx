import React, { useState } from 'react';
import {
  AggregatedProfile,
  DiscoveryItem,
  LifeCardProposal,
  NormalizedEvent,
  ServiceSource,
} from '../types/life';
import { AnalysisCustomOptions } from '../modules/analyzer/geminiAnalyzer';

interface Step2AnalyzeSelectProps {
  isAnalyzing: boolean;
  progressLogs: string[];
  normalizedEvents: NormalizedEvent[];
  profile: AggregatedProfile;
  proposal: LifeCardProposal | null;
  customOptions: AnalysisCustomOptions;
  onChangeCustomOptions: (opts: AnalysisCustomOptions) => void;
  onUpdateProposal: (updated: LifeCardProposal) => void;
  onReanalyze: (opts?: AnalysisCustomOptions) => void;
  onBack: () => void;
  onProceedToCard: () => void;
}

const SERVICE_LABEL: Record<ServiceSource, string> = {
  youtube: 'YouTube',
  chrome: 'Google検索',
  gemini: 'Gemini',
  maps: 'マップ',
  notebooklm: 'NotebookLM',
};

export const Step2AnalyzeSelect: React.FC<Step2AnalyzeSelectProps> = ({
  isAnalyzing,
  progressLogs,
  profile,
  proposal,
  customOptions,
  onChangeCustomOptions,
  onUpdateProposal,
  onReanalyze,
  onBack,
  onProceedToCard,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleDiscovery = (id: string) => {
    if (!proposal) return;
    const updated = proposal.discoveries.map((d) =>
      d.id === id ? { ...d, enabled: !(d.enabled ?? true) } : d
    );
    onUpdateProposal({ ...proposal, discoveries: updated });
  };

  const updateDiscoveryField = (
    id: string,
    field: keyof DiscoveryItem,
    value: string
  ) => {
    if (!proposal) return;
    const updated = proposal.discoveries.map((d) =>
      d.id === id ? { ...d, [field]: value } : d
    );
    onUpdateProposal({ ...proposal, discoveries: updated });
  };

  const enabledCount =
    proposal?.discoveries.filter((d) => d.enabled ?? true).length ?? 0;

  const uStats = profile.unconsciousStats;

  return (
    <div className="space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-neutral-500 hover:text-black cursor-pointer"
        >
          ← 1. 入力へ戻る
        </button>
        <div className="text-xs text-neutral-500 font-mono-code">
          Google横断集計: {profile.totalEvents.toLocaleString()} アクション
        </div>
      </div>

      {/* Google Dependency & Unconscious Time Summary Bar */}
      {uStats && (
        <div className="border border-black rounded-xl p-5 bg-white space-y-4">
          <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2.5">
            <span className="text-xs font-bold tracking-tight text-black">
              GOOGLE 依存度・無意識の累計投下時間サマリー
            </span>
            <span className="text-[11px] font-mono-code text-neutral-500">
              {profile.period.startDate} — {profile.period.endDate}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
              <div className="text-[11px] text-neutral-500">総記録アクション</div>
              <div className="text-lg font-bold font-mono-code text-black mt-0.5">
                {profile.totalEvents.toLocaleString()} 回
              </div>
              <div className="text-[10px] text-neutral-400">5サービス合計</div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
              <div className="text-[11px] text-neutral-500">YouTube 累計時間</div>
              <div className="text-lg font-bold font-mono-code text-black mt-0.5">
                {uStats.totalWatchHours.toLocaleString()} 時間
              </div>
              <div className="text-[10px] text-neutral-400">
                24時間換算で丸 {uStats.totalDaysEquivalent} 日分
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
              <div className="text-[11px] text-neutral-500">15秒以内即スキップ</div>
              <div className="text-lg font-bold font-mono-code text-black mt-0.5">
                {uStats.rapidSkip15sCount.toLocaleString()} 回
              </div>
              <div className="text-[10px] text-neutral-400">
                全視聴の {uStats.rapidSkipRatioPct}% を15秒で選別
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
              <div className="text-[11px] text-neutral-500">1日最大視聴記録</div>
              <div className="text-lg font-bold font-mono-code text-black mt-0.5">
                {uStats.maxSingleDayHours} 時間
              </div>
              <div className="text-[10px] text-neutral-400">
                {uStats.maxSingleDayDate}
              </div>
            </div>
          </div>

          {/* 5-Service Breakdown */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono-code">
            {(Object.keys(profile.serviceCounts) as ServiceSource[]).map(
              (srv) => (
                <span
                  key={srv}
                  className="px-2.5 py-1 rounded border border-neutral-300 bg-white text-black"
                >
                  {SERVICE_LABEL[srv]}: {profile.serviceCounts[srv].toLocaleString()}
                </span>
              )
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <div className="border border-neutral-200 rounded-xl p-6 space-y-2">
          <div className="text-sm font-bold text-black animate-pulse">
            行動履歴を横断集計・分析中...
          </div>
          <div className="space-y-1 text-xs text-neutral-500 font-mono-code">
            {progressLogs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {proposal && !isAnalyzing && (
        <div className="space-y-8">
          {/* Short Catchphrase */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label className="text-xs font-bold text-black">
                一言キャッチコピー（短く一言でわかるラベル）
              </label>
              <span className="text-[11px] text-neutral-400">
                クリックして直接編集できます
              </span>
            </div>
            <input
              type="text"
              value={proposal.catchphrase}
              onChange={(e) =>
                onUpdateProposal({ ...proposal, catchphrase: e.target.value })
              }
              className="w-full px-4 py-3 rounded-xl border border-black focus:outline-none text-base md:text-lg font-bold text-black"
            />
          </div>

          {/* Cross-Service & Unconscious Discoveries */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-black">
                意識の外にある横断データ ＆ 無意識の行動クセ（{enabledCount} /{' '}
                {proposal.discoveries.length} 選択中）
              </h3>
              <span className="text-[11px] text-neutral-400">
                ONの項目が名刺に載ります
              </span>
            </div>

            <div className="space-y-3">
              {proposal.discoveries.map((disc) => {
                const isOn = disc.enabled ?? true;
                const isEditing = editingId === disc.id;

                return (
                  <div
                    key={disc.id}
                    className={`p-5 rounded-xl border transition-opacity ${
                      isOn
                        ? 'bg-white border-black'
                        : 'bg-neutral-50 border-neutral-200 opacity-45'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-code">
                          <span className="px-2 py-0.5 rounded bg-black text-white font-bold">
                            {disc.categoryTag}
                          </span>
                          <span className="px-2 py-0.5 rounded border border-black text-black font-bold">
                            {disc.metricLabel}
                          </span>
                        </div>

                        {isEditing ? (
                          <div className="space-y-2 pt-2">
                            <input
                              type="text"
                              value={disc.headline}
                              onChange={(e) =>
                                updateDiscoveryField(
                                  disc.id,
                                  'headline',
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-1.5 rounded border border-neutral-300 text-sm font-bold"
                            />
                            <textarea
                              rows={5}
                              value={disc.factStatement}
                              onChange={(e) =>
                                updateDiscoveryField(
                                  disc.id,
                                  'factStatement',
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-1.5 rounded border border-neutral-300 text-xs leading-relaxed"
                            />
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 rounded bg-black text-white text-xs cursor-pointer"
                            >
                              完了
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm md:text-base font-bold text-black leading-snug">
                              {disc.headline}
                            </div>
                            <div className="text-xs md:text-[13px] text-neutral-700 leading-relaxed whitespace-pre-line">
                              {disc.factStatement}
                            </div>
                          </>
                        )}

                        {/* Cross-Service Breakdown Pills */}
                        {disc.serviceBreakdown &&
                          disc.serviceBreakdown.length > 0 && (
                            <div className="pt-1 flex flex-wrap gap-1.5">
                              {disc.serviceBreakdown.map((chip, idx) => (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1 rounded bg-neutral-100 border border-neutral-300 text-[11px] font-mono-code text-black"
                                >
                                  <strong className="font-bold">
                                    {chip.service}:
                                  </strong>{' '}
                                  {chip.stat}
                                </span>
                              ))}
                            </div>
                          )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingId(isEditing ? null : disc.id)
                          }
                          className="text-xs text-neutral-400 hover:text-black px-2 py-1 cursor-pointer"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleDiscovery(disc.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            isOn
                              ? 'bg-black text-white border-black'
                              : 'bg-white text-neutral-400 border-neutral-300'
                          }`}
                        >
                          {isOn ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optional Custom Instruction Bar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customOptions.customInstruction}
              onChange={(e) =>
                onChangeCustomOptions({
                  ...customOptions,
                  customInstruction: e.target.value,
                })
              }
              placeholder="追加リクエストがあれば入力（例：書道や上越の話を強調して）"
              className="flex-1 px-3.5 py-2 rounded-lg border border-neutral-300 text-xs text-black focus:outline-none focus:border-black"
            />
            <button
              type="button"
              onClick={() => onReanalyze(customOptions)}
              className="px-4 py-2 rounded-lg border border-black bg-white hover:bg-black hover:text-white text-xs font-bold shrink-0 cursor-pointer transition-colors"
            >
              再生成
            </button>
          </div>

          {/* Proceed Button */}
          <div className="flex justify-end pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onProceedToCard}
              className="px-6 py-3 rounded-lg bg-black hover:bg-neutral-800 text-white text-xs font-bold cursor-pointer"
            >
              3. 名刺カードを作成する →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
