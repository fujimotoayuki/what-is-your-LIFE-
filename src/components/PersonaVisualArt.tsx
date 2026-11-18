import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, Play, TrendingUp, Cpu, MapPin } from 'lucide-react';
import { AggregatedProfile, LifeCardProposal } from '../types/life';

interface PersonaVisualArtProps {
  profile: AggregatedProfile;
  proposal: LifeCardProposal;
  inverted?: boolean;
  compact?: boolean;
}

const imageCache = new Map<string, string>();
const inFlightMap = new Map<string, Promise<string | null>>();

function translateThemeToEnglishVisuals(text: string): string {
  const parts: string[] = [];
  if (/書道|千字文|日展|書法|陶淵明|漢詩/.test(text)) {
    parts.push('traditional Japanese calligraphy scrolls and ink brushes');
  }
  if (/株価|投資|ビットコイン|SoFi|銘柄|決算/i.test(text)) {
    parts.push('glowing holographic stock market candlestick charts and financial graphs');
  }
  if (/aespa|雨来ズ|アイドル|せじゅ|超十代|YouTube/i.test(text)) {
    parts.push('floating neon concert stage video screens and media players');
  }
  if (/焙煎|コーヒー|珈琲|マンデリン|エチオピア|KOFFEE/i.test(text)) {
    parts.push('pour-over specialty coffee dripper with rising steam and roasting beans');
  }
  if (/古民家|建築|根太|漆喰|断熱|アアルト|北欧/.test(text)) {
    parts.push('wooden architectural timber models, blueprint drawings, and warm pendant lamps');
  }
  if (/ゲーム|シェーダー|GLSL|Godot|コヨーテタイム|桜井政博/i.test(text)) {
    parts.push('retro pixel art game screens, gamepad controller, and 3D shader prisms');
  }
  if (/音楽|ボカロ|和音|FM音源|初音ミク|シンセ/.test(text)) {
    parts.push('synthesizer keyboard and glowing audio spectrum waveforms');
  }
  if (/AI|Gemini|NotebookLM|論文|アルゴリズム/i.test(text)) {
    parts.push('a glowing 3D neural network brain hologram and floating research documents');
  }
  if (parts.length === 0) {
    parts.push(
      'floating holographic screens of search trends, video players, maps, and research notes'
    );
  }
  return parts.join(', ');
}

function buildDynamicScenePrompt(
  profile: AggregatedProfile,
  proposal: LifeCardProposal
): string {
  const d = profile.aiRawDigest;
  const combined = [
    proposal.catchphrase,
    ...proposal.discoveries.map((x) => `${x.headline} ${x.factStatement}`),
    ...(d?.googleSearchTopQueries?.slice(0, 15).map((q) => q.query) || []),
    ...(d?.youtubeTopChannels?.slice(0, 8).map((c) => c.name) || []),
    ...(d?.notebooks?.map((n) => n.title) || []),
  ].join(' ');

  const visualElements = translateThemeToEnglishVisuals(combined);

  return `Cinematic anime-style digital illustration of a mysterious gender-neutral featureless dark shadow silhouette person wearing a hoodie and headphones around neck, sitting in a contemplative pose with hand on chin at a wooden study desk with a laptop, open notebook, coffee mug, and hourglass. Surrounding the shadow figure in the room are ${visualElements}, a glowing circular 24-hour clock orbit ring above their head, and a stack of hardcover books on the desk. Warm dramatic lighting with glowing light trails swirling around the silhouette, masterpiece, no text.`;
}

async function fetchPollinationsWithRetry(
  prompt: string,
  seed: number
): Promise<string | null> {
  const cacheKey = `${prompt}|${seed}`;
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }
  if (inFlightMap.has(cacheKey)) {
    return inFlightMap.get(cacheKey)!;
  }

  const task = (async () => {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=768&height=896&nologo=true&seed=${seed}`;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          imageCache.set(cacheKey, dataUrl);
          return dataUrl;
        }
        if (res.status === 402 || res.status === 429 || res.status === 503) {
          // Wait for rate-limit window if needed on first attempt
          await new Promise((r) => setTimeout(r, 6000));
        }
      } catch {
        // retry
      }
    }
    return null;
  })();

  inFlightMap.set(cacheKey, task);
  const result = await task;
  inFlightMap.delete(cacheKey);
  return result;
}

export const PersonaVisualArt: React.FC<PersonaVisualArtProps> = ({
  profile,
  proposal,
  inverted = false,
  compact = false,
}) => {
  const d = profile.aiRawDigest;
  const prompt = buildDynamicScenePrompt(profile, proposal);

  const [seed, setSeed] = useState<number>(() => {
    let h = 101;
    for (let i = 0; i < prompt.length; i++) {
      h = (h * 31 + prompt.charCodeAt(i)) % 999999;
    }
    return h;
  });
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    setIsLoadingAi(true);
    fetchPollinationsWithRetry(prompt, seed).then((url) => {
      if (mounted) {
        if (url) setAiImageUrl(url);
        setIsLoadingAi(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [prompt, seed]);

  // Extract dynamic data from the current user's profile & proposal
  const topChs = d?.youtubeTopChannels?.slice(0, 3) || profile.topChannels.slice(0, 3);
  const topQs = d?.googleSearchTopQueries?.slice(0, 5) || [];
  const topNbs = d?.notebooks?.slice(0, 3) || [];
  const topPlaces = d?.mapsTopPlaces?.slice(0, 2) || [];
  const slots = d?.timeOfDayBreakdown || [];

  const morningSlot = slots.find((s) => s.slot.includes('朝'));
  const daySlot = slots.find((s) => s.slot.includes('昼'));
  const eveningSlot = slots.find((s) => s.slot.includes('夜') && !s.slot.includes('深'));
  const nightSlot = slots.find((s) => s.slot.includes('深夜'));

  // Dynamic Book Spines on the Desk (from the 6 discoveries)
  const bookTitles = proposal.discoveries.slice(0, 6).map((disc) => {
    const m = disc.headline.match(/「([^」]{2,14})」/);
    if (m) return m[1];
    return disc.categoryTag.replace(/^\d+\.\s*/, '').slice(0, 12);
  });

  // Dynamic Stance Formula at bottom center (from Feature 6)
  const disc6 = proposal.discoveries[5];
  const leftStance =
    disc6 && disc6.headline.includes('妄想')
      ? { jp: '発想・妄想', en: '(Imagining Big)' }
      : { jp: '直感・仮説', en: '(Intuition & Vision)' };
  const rightStance =
    disc6 && disc6.headline.includes('根拠')
      ? { jp: '検証・構造化', en: '(Evidence & Structure)' }
      : { jp: '論理・実践', en: '(Logic & Execution)' };

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        inverted
          ? 'bg-neutral-950 border-neutral-800 text-white'
          : 'bg-white border-black text-black'
      }`}
    >
      {/* Header Bar */}
      <div
        className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
          inverted ? 'border-neutral-800' : 'border-neutral-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-bold">
            履歴データから自動合成した「あなたの脳内・世界観イメージ図」
          </span>
        </div>

        {!compact && (
          <button
            type="button"
            onClick={() => setSeed((s) => s + 173)}
            disabled={isLoadingAi}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              inverted ? 'bg-white text-black' : 'bg-black text-white'
            }`}
          >
            <RefreshCw
              className={`w-3 h-3 ${isLoadingAi ? 'animate-spin' : ''}`}
            />
            {isLoadingAi ? 'AI背景を描画中...' : 'AI背景を別パターンで再生成'}
          </button>
        )}
      </div>

      {/* Dynamic Multi-Layer Scene Canvas (Tailored 100% to the uploaded person's data) */}
      <div
        className={`relative w-full ${
          compact ? 'min-h-[480px]' : 'min-h-[560px]'
        } bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 text-white overflow-hidden select-none flex flex-col justify-between p-4 md:p-6`}
      >
        {/* Optional AI-Generated Scene Background Layer */}
        {aiImageUrl && (
          <img
            src={aiImageUrl}
            alt="AI Generated Persona Studio"
            className="absolute inset-0 w-full h-full object-cover object-center opacity-55 mix-blend-luminosity pointer-events-none"
          />
        )}

        {/* Ambient Studio Window & Radial Light Glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 38%, rgba(255,245,220,0.18) 0%, rgba(20,24,34,0.65) 55%, rgba(8,10,15,0.94) 100%)',
          }}
        />

        {/* TOP ROW: Left Media Screens + Center 24h Life-Cycle Orbit Ring + Right Market/Research Hologram */}
        <div className="relative z-10 grid grid-cols-12 gap-3 items-start">
          {/* Top-Left: Floating Video / Media Hologram Panels */}
          <div className="col-span-4 space-y-2">
            <div className="p-2.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/25 shadow-lg space-y-1.5">
              <div className="flex items-center justify-between text-[9px] font-mono-code text-neutral-300">
                <span className="flex items-center gap-1 font-bold text-white">
                  <Play className="w-2.5 h-2.5 fill-white" /> MEDIA &amp; CHANNELS
                </span>
                <span>{d?.overview?.youtubeWatchCount.toLocaleString() || 0} plays</span>
              </div>
              <div className="space-y-1">
                {topChs.slice(0, 3).map((ch, i) => (
                  <div
                    key={i}
                    className="px-2 py-1 rounded bg-white/10 border border-white/15 flex items-center justify-between text-[10px]"
                  >
                    <span className="truncate font-bold">{ch.name}</span>
                    <span className="font-mono-code text-[9px] text-neutral-300 shrink-0 ml-1">
                      {ch.count}回
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Middle-Left: Hobby / Classical / Search Scroll Panel */}
            <div className="p-2.5 rounded-xl bg-amber-950/40 backdrop-blur-md border border-amber-200/30 shadow-lg space-y-1">
              <div className="text-[9px] font-mono-code text-amber-200/80 uppercase">
                DEEP SEARCH KEYWORDS ({d?.overview?.googleSearchCount || 0})
              </div>
              <div className="flex flex-wrap gap-1">
                {topQs.slice(0, 5).map((q, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded bg-black/50 border border-amber-100/25 text-[10px] text-amber-50 font-serif"
                  >
                    {q.query} ({q.count})
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Top-Center: Glowing 24-Hour Life-Cycle Orbit Ring */}
          <div className="col-span-4 flex flex-col items-center justify-center pt-1">
            <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-full border border-white/35 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center p-3 text-center shadow-[0_0_30px_rgba(255,255,255,0.12)]">
              <div className="absolute inset-1.5 rounded-full border border-dashed border-white/20 pointer-events-none" />
              <div className="text-[8px] font-mono-code uppercase tracking-widest text-amber-200/90">
                ☀ Morning ({morningSlot?.ratioPct ?? 25}%)
              </div>
              <div className="text-[9px] text-neutral-300 truncate max-w-[120px] mb-1">
                {morningSlot?.topSearches?.[0]?.replace(/\(.*\)/, '') || 'Research'}
              </div>

              <div className="my-1 px-2.5 py-1 rounded-full bg-white/15 border border-white/30 text-[10px] font-mono-code font-bold">
                PEAK {profile.peakHour}:00
              </div>

              <div className="grid grid-cols-2 gap-2 w-full text-[8px] font-mono-code text-neutral-300 mt-1">
                <div>
                  <div className="text-white font-bold">
                    昼 ({daySlot?.ratioPct ?? 35}%)
                  </div>
                  <div className="truncate">
                    {daySlot?.topSearches?.[0]?.replace(/\(.*\)/, '') || 'Deep Work'}
                  </div>
                </div>
                <div>
                  <div className="text-white font-bold">
                    夜 ({eveningSlot?.ratioPct ?? 30}%)
                  </div>
                  <div className="truncate">
                    {eveningSlot?.topSearches?.[0]?.replace(/\(.*\)/, '') || 'Create'}
                  </div>
                </div>
              </div>
              <div className="text-[8px] font-mono-code text-neutral-400 mt-1">
                ☾ Late Night {nightSlot?.ratioPct ?? profile.lateNightRatio}%
              </div>
            </div>
          </div>

          {/* Top-Right: Research / Analytics / AI & NotebookLM Hologram Panels */}
          <div className="col-span-4 space-y-2">
            <div className="p-2.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/25 shadow-lg space-y-1.5">
              <div className="flex items-center justify-between text-[9px] font-mono-code text-neutral-300">
                <span className="flex items-center gap-1 font-bold text-white">
                  <TrendingUp className="w-2.5 h-2.5" /> RESEARCH &amp; NOTEBOOKS
                </span>
                <span>{d?.overview?.notebookLmCount || 0} notes</span>
              </div>
              {/* Mini Candlestick / Trend Bars */}
              <div className="flex items-end gap-1 h-7 px-1 pt-1">
                {[40, 65, 50, 80, 60, 95, 75, 100, 85, 110].map((v, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 rounded-t ${
                      idx % 2 === 0 ? 'bg-emerald-400/80' : 'bg-white/70'
                    }`}
                    style={{ height: `${Math.min(v, 100)}%` }}
                  />
                ))}
              </div>
              <div className="space-y-1">
                {topNbs.slice(0, 2).map((nb, i) => (
                  <div
                    key={i}
                    className="px-2 py-1 rounded bg-white/10 border border-white/15 flex items-center justify-between text-[10px]"
                  >
                    <span className="truncate">{nb.title}</span>
                    <span className="font-mono-code text-[9px] text-amber-200 shrink-0 ml-1">
                      資料{nb.sourceCount}件
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Middle-Right: AI Brain & Maps Hologram */}
            <div className="p-2.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/25 shadow-lg space-y-1">
              <div className="flex items-center justify-between text-[9px] font-mono-code text-neutral-300">
                <span className="flex items-center gap-1 font-bold text-white">
                  <Cpu className="w-2.5 h-2.5" /> AI DIALOGUE ({d?.overview?.geminiPromptCount || 0})
                </span>
                {topPlaces[0] && (
                  <span className="flex items-center gap-0.5 text-[9px]">
                    <MapPin className="w-2.5 h-2.5" />
                    {topPlaces[0].place.slice(0, 8)}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-neutral-200 line-clamp-2 leading-snug">
                {d?.geminiPromptsChronological?.[0]?.prompt ||
                  '仮説検証・構造化・システム設計の壁打ち'}
              </div>
            </div>
          </div>
        </div>

        {/* CENTER: Mysterious Gender-Neutral Shadow Silhouette Person (影の人) at the Desk */}
        <div className="relative z-10 flex flex-col items-center justify-center my-auto py-2">
          <svg
            viewBox="0 0 360 220"
            className="w-64 md:w-80 h-44 md:h-52 drop-shadow-[0_0_25px_rgba(255,255,255,0.22)]"
          >
            <defs>
              <radialGradient id="haloGrad" cx="50%" cy="40%" r="55%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <linearGradient id="silGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#17191e" />
                <stop offset="100%" stopColor="#050608" />
              </linearGradient>
            </defs>

            {/* Backlit Halo */}
            <circle cx="180" cy="95" r="88" fill="url(#haloGrad)" />

            {/* Swirling Light Orbit Trails around the Shadow Figure */}
            <ellipse
              cx="180"
              cy="145"
              rx="145"
              ry="32"
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="1.5"
              strokeDasharray="180 40"
              transform="rotate(-6 180 145)"
            />
            <ellipse
              cx="180"
              cy="152"
              rx="130"
              ry="26"
              fill="none"
              stroke="rgba(255,230,180,0.4)"
              strokeWidth="1.2"
              transform="rotate(5 180 152)"
            />

            {/* Shadow Silhouette Head & Contemplative Pose (Genderless Silhouette) */}
            <circle
              cx="180"
              cy="64"
              r="30"
              fill="url(#silGrad)"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="1.5"
            />
            {/* Hoodie & Jacket Shoulders */}
            <path
              d="M 102 195 C 106 132, 134 102, 180 102 C 226 102, 254 132, 258 195 Z"
              fill="url(#silGrad)"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1.6"
            />
            {/* Headphones around neck */}
            <ellipse
              cx="154"
              cy="108"
              rx="9"
              ry="12"
              fill="#111"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="1.4"
              transform="rotate(-18 154 108)"
            />
            <ellipse
              cx="206"
              cy="108"
              rx="9"
              ry="12"
              fill="#111"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="1.4"
              transform="rotate(18 206 108)"
            />
            {/* Contemplative Arm & Hand near Chin */}
            <path
              d="M 225 182 L 204 118 L 188 94"
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 225 182 L 204 118 L 188 94"
              fill="none"
              stroke="#0a0b0e"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Laptop & Hourglass & Notebook on Desk Foreground */}
            <polygon
              points="245,198 312,198 326,142 262,142"
              fill="#181a20"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="1.5"
            />
            {/* Hourglass on Left of Desk */}
            <polygon
              points="52,156 76,156 64,176 76,196 52,196 64,176"
              fill="rgba(255,245,220,0.2)"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        {/* BOTTOM ROW: Glowing Stance Formula + Desk Stack of Books with Dynamic Spines */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-2 border-t border-white/15">
          {/* Bottom-Left & Center: Glowing Brushstroke Stance Formula */}
          <div className="md:col-span-7 flex flex-col items-center md:items-start justify-end space-y-2">
            <div className="flex items-center gap-4 md:gap-5 px-4 py-2 rounded-2xl bg-black/65 backdrop-blur-md border border-white/25 shadow-xl">
              <div className="text-center">
                <div className="text-sm md:text-lg font-serif font-bold tracking-wider text-white">
                  {leftStance.jp}
                </div>
                <div className="text-[9px] font-mono-code text-neutral-300">
                  {leftStance.en}
                </div>
              </div>
              <span className="text-lg md:text-2xl font-light text-amber-200">
                ×
              </span>
              <div className="text-center">
                <div className="text-sm md:text-lg font-serif font-bold tracking-wider text-white">
                  {rightStance.jp}
                </div>
                <div className="text-[9px] font-mono-code text-neutral-300">
                  {rightStance.en}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-neutral-300 font-medium">
              {proposal.catchphrase}
            </div>
          </div>

          {/* Bottom-Right: Stack of Books on the Desk (Dynamically labeled with the person's themes) */}
          <div className="md:col-span-5 space-y-1">
            <div className="text-[9px] font-mono-code text-neutral-400 uppercase tracking-wider text-right">
              DESK BOOKSTACK // あなたの6大構成テーマ
            </div>
            <div className="flex flex-col gap-1">
              {bookTitles.map((bt, idx) => (
                <div
                  key={idx}
                  className="px-3 py-1 rounded border border-white/25 bg-gradient-to-r from-neutral-900/90 via-neutral-800/90 to-neutral-900/90 flex items-center justify-between text-[10px] shadow"
                >
                  <span className="font-mono-code text-[9px] text-amber-200/80">
                    VOL.{idx + 1}
                  </span>
                  <span className="font-serif font-bold tracking-wide text-white truncate ml-2">
                    {bt}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
