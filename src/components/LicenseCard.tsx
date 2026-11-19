import React, { useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, RotateCcw, Sparkles } from 'lucide-react';
import { AggregatedProfile, LifeCardProposal, ServiceSource } from '../types/life';
import { PersonaVisualArt } from './PersonaVisualArt';
import { traitSignature } from '../modules/analyzer/personaImage';

interface LicenseCardProps {
  profile: AggregatedProfile;
  proposal: LifeCardProposal;
  apiKey?: string;
  onReanalyze: () => void;
  onRestart: () => void;
}

const SERVICE_LABEL: Record<ServiceSource, string> = {
  youtube: 'YouTube',
  chrome: 'Google検索',
  gemini: 'Gemini',
  maps: 'マップ',
  notebooklm: 'NotebookLM',
};

function hourSlot(h: number): string {
  if (h >= 5 && h <= 10) return `朝 ${h}時台`;
  if (h >= 11 && h <= 16) return `昼 ${h}時台`;
  if (h >= 17 && h <= 22) return `夜 ${h}時台`;
  return `深夜 ${h}時台`;
}

function licenseNumber(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = (h >>> 0).toString().padStart(10, '0');
  return `第 ${n.slice(0, 4)} ${n.slice(4, 8)} ${n.slice(8)} 号`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

export const LicenseCard: React.FC<LicenseCardProps> = ({
  profile,
  proposal,
  apiKey,
  onReanalyze,
  onRestart,
}) => {
  const [holderName, setHolderName] = useState('あなた');
  const [isExporting, setIsExporting] = useState(false);
  // Opt-in: the holder chooses what appears on the card (everything starts ON).
  const [hiddenTraits, setHiddenTraits] = useState<Set<string>>(new Set());
  const [hiddenStats, setHiddenStats] = useState<Set<string>>(new Set());
  const [showPeriod, setShowPeriod] = useState(true);
  const toggle = (set: Set<string>, key: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    update(next);
  };
  const cardRef = useRef<HTMLDivElement | null>(null);

  const number = useMemo(() => licenseNumber(traitSignature(proposal)), [proposal]);
  // Local date (toISOString would give the UTC date, a day early in Japan mornings).
  const issuedAt = useMemo(() => new Date().toLocaleDateString('sv-SE'), [proposal]);
  const u = profile.unconsciousStats;

  const handleDownloadPng = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        filter: (node) =>
          !(node instanceof HTMLElement && node.dataset.exportIgnore === 'true'),
      });
      const link = document.createElement('a');
      link.download = `life-license-${issuedAt.slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsExporting(false);
    }
  };

  const stats = [
    { label: 'YouTube累計', value: u ? `${u.totalWatchHours.toLocaleString()}時間` : '—' },
    { label: '総アクション', value: `${profile.totalEvents.toLocaleString()}回` },
    { label: 'ピーク', value: hourSlot(profile.peakHour) },
    { label: '深夜率', value: `${profile.lateNightRatio}%` },
  ];

  const shownStats = stats.filter((s) => !hiddenStats.has(s.label));
  const shownTraits = proposal.discoveries.filter((d) => !hiddenTraits.has(d.id));

  return (
    <div className="space-y-8">
      {/* Controls (not part of the card) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="holder" className="text-xs font-bold text-neutral-500">
            氏名欄
          </label>
          <input
            id="holder"
            type="text"
            value={holderName}
            maxLength={16}
            onChange={(e) => setHolderName(e.target.value)}
            className="w-40 px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-bold focus:outline-none focus:border-black"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReanalyze}
            className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs text-neutral-700 hover:border-black flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            もう一度分析する
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isExporting}
            className="px-4 py-1.5 rounded-lg bg-black text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? '保存中...' : '免許証を画像で保存'}
          </button>
        </div>
      </div>

      {/* ===== The license card (exported as PNG) ===== */}
      <div className="overflow-x-auto -mx-6 px-6">
        <div
          ref={cardRef}
          className="min-w-[680px] rounded-2xl p-5 text-neutral-900 shadow-sm border border-emerald-900/20"
          style={{
            background:
              'linear-gradient(135deg, #f3f8f1 0%, #e3efe6 45%, #dce9f2 100%)',
          }}
        >
          {/* Title band */}
          <div className="flex items-end justify-between border-b border-emerald-900/25 pb-2 mb-3">
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-black tracking-[0.3em]">人生免許証</span>
              <span className="text-[10px] font-mono-code tracking-widest text-emerald-900/70">
                WHAT IS YOUR LIFE? LICENSE
              </span>
            </div>
            <span className="text-[10px] font-mono-code text-emerald-900/60">
              Google Takeout {profile.totalEvents.toLocaleString()} actions
            </span>
          </div>

          <div className="grid grid-cols-[1fr_190px] gap-5">
            {/* Left: fields */}
            <div className="space-y-2 text-[12px]">
              <Row label="氏名">
                <span className="text-lg font-bold tracking-wider">{holderName || 'あなた'}</span>
              </Row>
              <Row label="二つ名">
                <span className="text-xl font-black leading-tight">{proposal.nickname}</span>
              </Row>
              <Row label="ひとこと">
                <span className="font-bold leading-snug">{proposal.catchphrase}</span>
              </Row>
              {showPeriod && (
                <Row label="履歴期間">
                  {fmtDate(profile.period.startDate)} 〜 {fmtDate(profile.period.endDate)}
                  <span className="text-emerald-900/60">（{profile.period.totalDays}日）</span>
                </Row>
              )}
              <Row label="交付">{fmtDate(issuedAt)}</Row>
              <Row label="番号">
                <span className="font-mono-code tracking-wider">{number}</span>
              </Row>

              {/* Stats strip */}
              {shownStats.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5 pt-2">
                {shownStats.map((s) => (
                  <div key={s.label} className="bg-white/60 rounded px-2 py-1.5 border border-emerald-900/10">
                    <div className="text-[9px] text-emerald-900/60">{s.label}</div>
                    <div className="text-[12px] font-bold">{s.value}</div>
                  </div>
                ))}
              </div>
              )}
            </div>

            {/* Right: photo */}
            <div className="space-y-1.5">
              <PersonaVisualArt profile={profile} proposal={proposal} apiKey={apiKey} />
              <div className="text-[9px] text-center text-emerald-900/60">
                行動履歴から生成した人物像
              </div>
            </div>
          </div>

          {/* License types = the traits the holder chose to show */}
          {shownTraits.length > 0 && (
          <div className="mt-4 pt-3 border-t border-emerald-900/25">
            <div className="text-[10px] font-bold text-emerald-900/70 mb-1.5">種類（特徴）</div>
            <div className="grid grid-cols-3 gap-1.5">
              {shownTraits.map((d) => (
                <div key={d.id} className="bg-white/70 rounded border border-emerald-900/15 px-2.5 py-2">
                  <div className="text-[9px] text-emerald-900/60">{d.categoryTag}</div>
                  <div className="text-[11px] font-bold leading-snug">{d.headline}</div>
                </div>
              ))}
            </div>
          </div>
          )}

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-mono-code text-emerald-900/60">
            {(Object.keys(profile.serviceCounts) as ServiceSource[])
              .filter((s) => profile.serviceCounts[s] > 0)
              .map((s) => (
                <span key={s}>
                  {SERVICE_LABEL[s]} {profile.serviceCounts[s].toLocaleString()}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Opt-in: what goes on the card */}
      <section className="border border-neutral-200 rounded-xl p-4 space-y-2">
        <h3 className="text-xs font-bold">免許証に載せる数字（チェックを外すと非表示）</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          <Check checked={showPeriod} onChange={() => setShowPeriod((v) => !v)} label="履歴期間" />
          {stats.map((s) => (
            <Check
              key={s.label}
              checked={!hiddenStats.has(s.label)}
              onChange={() => toggle(hiddenStats, s.label, setHiddenStats)}
              label={s.label}
            />
          ))}
        </div>
      </section>

      {/* Full analysis (below the card) */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-bold">6つの特徴の解説</h3>
          <span className="text-[11px] text-neutral-500">分析: {proposal.analysisModel}</span>
        </div>
        {proposal.discoveries.map((d, i) => (
          <article key={d.id} className="border border-neutral-200 rounded-xl p-5 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[11px] text-neutral-500">
                {i + 1}. {d.categoryTag} ・ {d.metricLabel}
              </div>
              <Check
                checked={!hiddenTraits.has(d.id)}
                onChange={() => toggle(hiddenTraits, d.id, setHiddenTraits)}
                label="免許証に載せる"
              />
            </div>
            <h4 className="text-sm font-bold leading-snug">{d.headline}</h4>
            <p className="text-xs leading-relaxed text-neutral-700 whitespace-pre-line">
              {d.factStatement}
            </p>
            {d.serviceBreakdown && d.serviceBreakdown.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {d.serviceBreakdown.map((c, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-neutral-100 text-[10px]">
                    {c.service}: {c.stat}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onRestart}
          className="text-xs text-neutral-500 hover:text-black flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          別のZIPファイルで最初から
        </button>
      </div>
    </div>
  );
};

const Check: React.FC<{ checked: boolean; onChange: () => void; label: string }> = ({
  checked,
  onChange,
  label,
}) => (
  <label className="flex items-center gap-1.5 cursor-pointer shrink-0 text-xs">
    <input type="checkbox" checked={checked} onChange={onChange} className="accent-black" />
    {label}
  </label>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-[64px_1fr] items-baseline gap-2 border-b border-emerald-900/10 pb-1.5">
    <span className="text-[10px] font-bold text-emerald-900/60 tracking-widest">{label}</span>
    <span>{children}</span>
  </div>
);
