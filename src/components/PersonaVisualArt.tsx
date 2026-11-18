import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { AggregatedProfile, LifeCardProposal } from '../types/life';

interface PersonaVisualArtProps {
  profile: AggregatedProfile;
  proposal: LifeCardProposal;
  inverted?: boolean;
  compact?: boolean;
}

type MotifKey =
  | 'shodo_ink'
  | 'market_chart'
  | 'music_idol'
  | 'video_creator'
  | 'blueprint_ui'
  | 'ai_brain'
  | 'coffee_roast'
  | 'architecture_home'
  | 'game_shader'
  | 'gourmet_bowl'
  | 'map_compass';

interface DetectedMotif {
  key: MotifKey;
  label: string;
  enLabel: string;
  promptFragment: string;
}

const aiImageCache = new Map<string, string>();

function detectPersonMotifs(
  profile: AggregatedProfile,
  proposal: LifeCardProposal
): DetectedMotif[] {
  const d = profile.aiRawDigest;
  const fullText = [
    proposal.catchphrase,
    ...proposal.discoveries.map((x) => `${x.headline} ${x.factStatement}`),
    ...(d?.googleSearchTopQueries?.slice(0, 25).map((q) => q.query) || []),
    ...(d?.youtubeTopChannels?.slice(0, 10).map((c) => c.name) || []),
    ...(d?.notebooks?.map((n) => n.title) || []),
  ].join(' ');

  const rules: {
    key: MotifKey;
    label: string;
    enLabel: string;
    promptFragment: string;
    rx: RegExp;
  }[] = [
    {
      key: 'shodo_ink',
      label: '書道・古典墨蹟',
      enLabel: 'CALLIGRAPHY & CLASSICS',
      promptFragment:
        'a traditional Japanese calligraphy brush sweeping bold sumi ink strokes and classical kanji scrolls',
      rx: /書道|千字文|日展|書法|陶淵明|漢詩|隷書|揮毫|高木聖雨|武田双雲/,
    },
    {
      key: 'coffee_roast',
      label: '自家焙煎・抽出科学',
      enLabel: 'ROASTING THERMODYNAMICS',
      promptFragment:
        'a pour-over V60 coffee dripper with aromatic steam curves and roasting coffee beans',
      rx: /焙煎|コーヒー|珈琲|マンデリン|エチオピア|1ハゼ|ROR|粕谷哲|KOFFEE/i,
    },
    {
      key: 'architecture_home',
      label: '古民家・空間建築',
      enLabel: 'ARCHITECTURAL RETROFIT',
      promptFragment:
        'traditional Japanese timber folk house architecture joinery and Nordic pendant lamp',
      rx: /古民家|根太|漆喰|断熱|セルロース|アアルト|北欧照明|モルタル|週末縄文人/,
    },
    {
      key: 'game_shader',
      label: 'ゲーム設計・シェーダー',
      enLabel: 'GAME FEEL & SHADERS',
      promptFragment:
        'an indie game controller surrounded by geometric shader prisms and pixel art grids',
      rx: /コヨーテタイム|シェーダー|GLSL|Godot|Game Feel|桜井政博|ヒットストップ/i,
    },
    {
      key: 'market_chart',
      label: '市場構造・クオンツ投資',
      enLabel: 'MARKET & ALGORITHMS',
      promptFragment:
        'rising financial stock market candlestick charts and algorithmic geometric waves',
      rx: /株価|投資|銘柄|ビットコイン|SoFi|空売り|機関投資家|うねり取り|メタプラ|決算/i,
    },
    {
      key: 'ai_brain',
      label: 'AI検証・思考構造',
      enLabel: 'CRITICAL AI & LOGIC',
      promptFragment:
        'a glowing geometric neural network constellation and analytical magnifying glass over research books',
      rx: /LLM|ソース|根拠|論文|思考放棄|Gemini|Claude|NotebookLM|アルゴリズム/i,
    },
    {
      key: 'blueprint_ui',
      label: 'UI配色・システム設計',
      enLabel: 'SYSTEM & UI BLUEPRINT',
      promptFragment:
        'architectural blueprint grids, golden ratio compass, and minimalist UI wireframe cards',
      rx: /#[0-9A-Fa-f]{6}|設計書|仕様書|企画書|UI|エディタ|スライド|3要素/,
    },
    {
      key: 'music_idol',
      label: 'K-POP・音楽理論',
      enLabel: 'SOUND & POP CULTURE',
      promptFragment:
        'futuristic stage spotlights, vinyl synthesizer soundwaves, and musical notes',
      rx: /aespa|エスパ|ウィンター|カリナ|ボカロ|音楽理論|借用和音|FM音源|初音ミク/i,
    },
    {
      key: 'video_creator',
      label: '動画フック・エンタメ解剖',
      enLabel: 'VIDEO HOOKS & MEDIA',
      promptFragment:
        'cinema film strips, camera lens, and dynamic lightning spark icons',
      rx: /雨来ズ|ショート動画|ジェニー・ホヨス|せじゅ|超十代|Hooks/i,
    },
    {
      key: 'gourmet_bowl',
      label: '麻辣湯・スパイス探求',
      enLabel: 'SPICE & GASTRONOMY',
      promptFragment:
        'a steaming bowl of noodle soup with star anise spices and chopsticks',
      rx: /麻辣湯|マーラータン|楊国福|七宝麻辣湯|ラーメン|Malatang/i,
    },
    {
      key: 'map_compass',
      label: '街歩き・フィールド調査',
      enLabel: 'FIELDWORK & MAPPING',
      promptFragment:
        'topographic map contour lines, a vintage compass, and city location pins',
      rx: /上越|新潟|松本市|万代|朱鷺メッセ|秋葉原|下北沢|清澄白河/,
    },
  ];

  const matched: DetectedMotif[] = [];
  for (const r of rules) {
    if (r.rx.test(fullText)) {
      matched.push({
        key: r.key,
        label: r.label,
        enLabel: r.enLabel,
        promptFragment: r.promptFragment,
      });
    }
  }

  if (matched.length === 0) {
    return [
      {
        key: 'ai_brain',
        label: '知識探求',
        enLabel: 'DEEP RESEARCH',
        promptFragment:
          'an owl and astronomical compass surrounded by books and geometric constellations',
      },
      {
        key: 'blueprint_ui',
        label: '構造設計',
        enLabel: 'ARCHITECTURE',
        promptFragment: 'architectural blueprint grids and drafting compass',
      },
      {
        key: 'map_compass',
        label: '行動ログ',
        enLabel: 'FIELD LOGS',
        promptFragment: 'topographic map lines and stars',
      },
    ];
  }

  return matched.slice(0, 4);
}

function buildAiImagePrompt(
  proposal: LifeCardProposal,
  motifs: DetectedMotif[]
): string {
  if (proposal.visualImagePrompt && proposal.visualImagePrompt.trim().length > 20) {
    return `${proposal.visualImagePrompt.trim()}, minimalist black and white ink woodcut tarot card illustration, high contrast monochrome line art on white background, no text, no letters`;
  }
  const fragments = motifs
    .slice(0, 3)
    .map((m) => m.promptFragment)
    .join(' harmoniously combined with ');
  return `Minimalist black and white editorial ink and woodcut tarot card illustration featuring ${fragments}, intricate monochrome line art on pure white background, stylish magazine cover illustration style, high contrast, no text, no words`;
}

function renderMotifIllustration(key: MotifKey, strokeColor: string) {
  switch (key) {
    case 'shodo_ink':
      return (
        <g>
          <path
            d="M 55 155 C 35 105, 65 48, 120 46 C 175 44, 205 92, 185 145 C 168 185, 112 195, 78 172"
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="320 18"
          />
          <line
            x1="168"
            y1="36"
            x2="98"
            y2="126"
            stroke={strokeColor}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M 98 126 C 85 135, 74 152, 68 164 C 84 160, 96 146, 104 132 Z"
            fill={strokeColor}
          />
        </g>
      );
    case 'coffee_roast':
      return (
        <g>
          <polygon
            points="78,72 162,72 136,122 104,122"
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M 92 122 L 148 122 L 156 168 L 84 168 Z"
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </g>
      );
    default:
      return (
        <g>
          <circle
            cx="120"
            cy="110"
            r="52"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
          />
          <polygon
            points="120,58 166,136 74,136"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
          />
        </g>
      );
  }
}

export const PersonaVisualArt: React.FC<PersonaVisualArtProps> = ({
  profile,
  proposal,
  inverted = false,
}) => {
  const motifs = detectPersonMotifs(profile, proposal);
  const primaryMotif = motifs[0];
  const promptText = buildAiImagePrompt(proposal, motifs);

  const [seed, setSeed] = useState<number>(() => {
    let h = 42;
    for (let i = 0; i < promptText.length; i++) {
      h = (h * 31 + promptText.charCodeAt(i)) % 99999;
    }
    return h;
  });
  const [aiDataUrl, setAiDataUrl] = useState<string | null>(null);
  const [isLoadingAiImage, setIsLoadingAiImage] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'ai' | 'emblem'>('ai');

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${promptText}|${seed}`;
    if (aiImageCache.has(cacheKey)) {
      setAiDataUrl(aiImageCache.get(cacheKey)!);
      setIsLoadingAiImage(false);
      return;
    }

    setIsLoadingAiImage(true);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      promptText
    )}?width=512&height=512&nologo=true&model=flux&seed=${seed}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Image fetch failed');
        return res.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      )
      .then((dataUrl) => {
        if (!cancelled) {
          aiImageCache.set(cacheKey, dataUrl);
          setAiDataUrl(dataUrl);
          setIsLoadingAiImage(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoadingAiImage(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [promptText, seed]);

  const bg = inverted ? '#0a0a0a' : '#fafafa';
  const fg = inverted ? '#ffffff' : '#000000';
  const muted = inverted ? '#737373' : '#737373';
  const borderCol = inverted ? '#262626' : '#e5e5e5';

  const titleMatch = proposal.catchphrase.match(/「([^」]+)」/);
  const personaTitle = titleMatch
    ? titleMatch[1]
    : proposal.catchphrase.slice(0, 18);

  const maxHourVal = Math.max(...profile.hourlyDistribution, 1);

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        inverted
          ? 'bg-neutral-950 border-neutral-800 text-white'
          : 'bg-neutral-50 border-black text-black'
      }`}
    >
      <div className="grid grid-cols-1 md:grid-cols-12 items-center">
        {/* Left AI Image / SVG Emblem Box */}
        <div
          className="md:col-span-5 flex flex-col items-center justify-center p-5 border-b md:border-b-0 md:border-r relative"
          style={{ borderColor: borderCol, backgroundColor: bg }}
        >
          {viewMode === 'ai' && aiDataUrl ? (
            <div className="relative w-48 h-48 md:w-52 md:h-52 rounded-xl overflow-hidden border border-black bg-white">
              <img
                src={aiDataUrl}
                alt={personaTitle}
                className={`w-full h-full object-cover grayscale contrast-125 ${
                  inverted ? 'invert' : ''
                }`}
              />
              {isLoadingAiImage && (
                <div className="absolute inset-0 bg-black/60 text-white flex items-center justify-center text-[11px] font-mono-code">
                  AI画像を再生成中...
                </div>
              )}
            </div>
          ) : (
            <div className="relative flex items-center justify-center">
              <svg
                viewBox="0 0 240 240"
                className="w-48 h-48 md:w-52 md:h-52 select-none"
              >
                <rect
                  x="6"
                  y="6"
                  width="228"
                  height="228"
                  rx="16"
                  fill="none"
                  stroke={fg}
                  strokeWidth="1.5"
                />
                {profile.hourlyDistribution.map((cnt, hr) => {
                  const angle = ((hr - 6) / 24) * Math.PI * 2;
                  const innerR = 76;
                  const barLen = 4 + (cnt / maxHourVal) * 18;
                  const x1 = 120 + Math.cos(angle) * innerR;
                  const y1 = 112 + Math.sin(angle) * innerR;
                  const x2 = 120 + Math.cos(angle) * (innerR + barLen);
                  const y2 = 112 + Math.sin(angle) * (innerR + barLen);
                  return (
                    <line
                      key={hr}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={fg}
                      strokeWidth={cnt === maxHourVal ? '2.6' : '1.4'}
                      opacity={cnt > 0 ? 0.35 + (cnt / maxHourVal) * 0.65 : 0.15}
                      strokeLinecap="round"
                    />
                  );
                })}
                <circle
                  cx="120"
                  cy="112"
                  r="72"
                  fill="none"
                  stroke={fg}
                  strokeWidth="1.2"
                  opacity="0.3"
                />
                {renderMotifIllustration(primaryMotif.key, fg)}
                <text
                  x="120"
                  y="214"
                  textAnchor="middle"
                  fill={fg}
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  letterSpacing="1.5"
                >
                  {primaryMotif.enLabel}
                </text>
              </svg>
              {viewMode === 'ai' && isLoadingAiImage && (
                <div className="absolute bottom-2 px-3 py-1 rounded-full bg-black text-white text-[10px] font-mono-code flex items-center gap-1.5 animate-pulse">
                  <Sparkles className="w-3 h-3" />
                  AIイメージ画像を生成中...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Persona Visual Summary & Controls */}
        <div className="md:col-span-7 p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <div
                className="text-[10px] font-mono-code uppercase tracking-widest flex items-center gap-1.5"
                style={{ color: muted }}
              >
                <Sparkles className="w-3 h-3" />
                AI GENERATED PERSONA VISUAL // 分析結果から生成したイメージ画像
              </div>
              <div className="text-lg md:text-xl font-bold tracking-tight leading-snug">
                {personaTitle}
              </div>
            </div>
          </div>

          <p className="text-xs leading-relaxed opacity-80">
            5サービスの履歴データから抽出されたあなたの象徴モチーフ（
            {motifs.map((m) => `「${m.label}」`).join('×')}
            ）をもとに、画像生成AI（Fluxモデル）で描き出したモノクロ・タロット風イメージアートです。
          </p>

          {/* Visual Motif Tags */}
          <div className="flex flex-wrap gap-1.5">
            {motifs.map((m, idx) => (
              <span
                key={m.key}
                className={`px-2.5 py-1 rounded text-[11px] font-mono-code border ${
                  inverted
                    ? 'bg-neutral-900 border-neutral-700 text-white'
                    : 'bg-white border-black text-black'
                }`}
              >
                #{idx + 1} {m.label}
              </span>
            ))}
          </div>

          {/* Regenerate / Mode Switch Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setViewMode('ai');
                setSeed((s) => s + 137);
              }}
              disabled={isLoadingAiImage}
              className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                inverted
                  ? 'bg-white text-black border-white'
                  : 'bg-black text-white border-black'
              }`}
            >
              <RefreshCw
                className={`w-3 h-3 ${isLoadingAiImage ? 'animate-spin' : ''}`}
              />
              {isLoadingAiImage ? 'AI描画中...' : 'AI画像を別パターンで再生成'}
            </button>

            <button
              type="button"
              onClick={() =>
                setViewMode((m) => (m === 'ai' ? 'emblem' : 'ai'))
              }
              className={`px-3 py-1.5 rounded-lg border text-[11px] font-mono-code cursor-pointer ${
                inverted
                  ? 'border-neutral-700 text-neutral-300 hover:text-white'
                  : 'border-neutral-300 text-neutral-600 hover:text-black bg-white'
              }`}
            >
              {viewMode === 'ai'
                ? '24h波形エンブレムに切替'
                : 'AI生成イラストに切替'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
