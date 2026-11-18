import React from 'react';
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
}

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
    rx: RegExp;
  }[] = [
    {
      key: 'shodo_ink',
      label: '書道・古典墨蹟',
      enLabel: 'CALLIGRAPHY & CLASSICS',
      rx: /書道|千字文|日展|書法|陶淵明|漢詩|隷書|揮毫|高木聖雨|武田双雲/,
    },
    {
      key: 'coffee_roast',
      label: '自家焙煎・抽出科学',
      enLabel: 'ROASTING THERMODYNAMICS',
      rx: /焙煎|コーヒー|珈琲|マンデリン|エチオピア|1ハゼ|ROR|粕谷哲|KOFFEE/i,
    },
    {
      key: 'architecture_home',
      label: '古民家・空間建築',
      enLabel: 'ARCHITECTURAL RETROFIT',
      rx: /古民家|根太|漆喰|断熱|セルロース|アアルト|北欧照明|モルタル|週末縄文人/,
    },
    {
      key: 'game_shader',
      label: 'ゲーム設計・シェーダー',
      enLabel: 'GAME FEEL & SHADERS',
      rx: /コヨーテタイム|シェーダー|GLSL|Godot|Game Feel|桜井政博|ヒットストップ/i,
    },
    {
      key: 'market_chart',
      label: '市場構造・クオンツ投資',
      enLabel: 'MARKET & ALGORITHMS',
      rx: /株価|投資|銘柄|ビットコイン|SoFi|空売り|機関投資家|うねり取り|メタプラ|決算/i,
    },
    {
      key: 'ai_brain',
      label: 'AI検証・思考構造',
      enLabel: 'CRITICAL AI & LOGIC',
      rx: /LLM|ソース|根拠|論文|思考放棄|Gemini|Claude|NotebookLM|アルゴリズム/i,
    },
    {
      key: 'blueprint_ui',
      label: 'UI配色・システム設計',
      enLabel: 'SYSTEM & UI BLUEPRINT',
      rx: /#[0-9A-Fa-f]{6}|設計書|仕様書|企画書|UI|エディタ|スライド|3要素/,
    },
    {
      key: 'music_idol',
      label: 'K-POP・音楽理論',
      enLabel: 'SOUND & POP CULTURE',
      rx: /aespa|エスパ|ウィンター|カリナ|ボカロ|音楽理論|借用和音|FM音源|初音ミク/i,
    },
    {
      key: 'video_creator',
      label: '動画フック・エンタメ解剖',
      enLabel: 'VIDEO HOOKS & MEDIA',
      rx: /雨来ズ|ショート動画|ジェニー・ホヨス|せじゅ|超十代|Hooks/i,
    },
    {
      key: 'gourmet_bowl',
      label: '麻辣湯・スパイス探求',
      enLabel: 'SPICE & GASTRONOMY',
      rx: /麻辣湯|マーラータン|楊国福|七宝麻辣湯|ラーメン|Malatang/i,
    },
    {
      key: 'map_compass',
      label: '街歩き・フィールド調査',
      enLabel: 'FIELDWORK & MAPPING',
      rx: /上越|新潟|松本市|万代|朱鷺メッセ|秋葉原|下北沢|清澄白河/,
    },
  ];

  const matched: DetectedMotif[] = [];
  for (const r of rules) {
    if (r.rx.test(fullText)) {
      matched.push({ key: r.key, label: r.label, enLabel: r.enLabel });
    }
  }

  if (matched.length === 0) {
    return [
      { key: 'ai_brain', label: '知識探求', enLabel: 'DEEP RESEARCH' },
      { key: 'blueprint_ui', label: '構造設計', enLabel: 'ARCHITECTURE' },
      { key: 'map_compass', label: '行動ログ', enLabel: 'FIELD LOGS' },
    ];
  }

  return matched.slice(0, 4);
}

function renderMotifIllustration(key: MotifKey, strokeColor: string) {
  switch (key) {
    case 'shodo_ink':
      return (
        <g>
          {/* Dynamic Zen Enso & Calligraphy Brushstroke */}
          <path
            d="M 55 155 C 35 105, 65 48, 120 46 C 175 44, 205 92, 185 145 C 168 185, 112 195, 78 172"
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="320 18"
          />
          <path
            d="M 62 148 C 46 105, 72 56, 122 54 C 168 52, 195 94, 178 140"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            opacity="0.6"
          />
          {/* Calligraphy Brush Shaft & Tip */}
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
          {/* Hanko Stamp */}
          <rect
            x="152"
            y="148"
            width="22"
            height="22"
            rx="2"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
          />
          <path
            d="M 157 154 L 169 154 M 163 154 L 163 165 M 157 165 L 169 165"
            stroke={strokeColor}
            strokeWidth="1.8"
          />
        </g>
      );

    case 'coffee_roast':
      return (
        <g>
          {/* V60 Dripper & Server */}
          <polygon
            points="78,72 162,72 136,122 104,122"
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <line x1="90" y1="84" x2="112" y2="120" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="108" y1="78" x2="120" y2="120" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="132" y1="78" x2="126" y2="120" stroke={strokeColor} strokeWidth="1.5" />
          <path
            d="M 162 82 C 180 82, 180 106, 150 108"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
          />
          <path
            d="M 92 122 L 148 122 L 156 168 L 84 168 Z"
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Thermodynamic ROR Steam Curves */}
          <path
            d="M 105 62 C 98 48, 114 42, 108 28"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M 122 58 C 115 44, 131 38, 125 24"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M 139 62 C 132 48, 148 42, 142 28"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      );

    case 'game_shader':
      return (
        <g>
          {/* Isometric Prism & Controller / Frame Grid */}
          <polygon
            points="120,42 176,142 64,142"
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <line x1="120" y1="42" x2="120" y2="142" stroke={strokeColor} strokeWidth="1.8" strokeDasharray="4 4" />
          {/* Harmonic / Shader Wave */}
          <path
            d="M 48 158 Q 66 130, 84 158 T 120 158 T 156 158 T 192 158"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
          />
          {/* D-Pad Cross */}
          <path
            d="M 114 96 H 126 V 108 H 138 V 120 H 126 V 132 H 114 V 120 H 102 V 108 H 114 Z"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
          />
        </g>
      );

    case 'market_chart':
      return (
        <g>
          {/* Candlesticks & Algorithmic Trend Curve */}
          <line x1="65" y1="150" x2="175" y2="150" stroke={strokeColor} strokeWidth="1.5" opacity="0.4" />
          {/* Candle 1 */}
          <line x1="78" y1="112" x2="78" y2="156" stroke={strokeColor} strokeWidth="2" />
          <rect x="72" y="122" width="12" height="22" fill="none" stroke={strokeColor} strokeWidth="2" />
          {/* Candle 2 */}
          <line x1="106" y1="92" x2="106" y2="142" stroke={strokeColor} strokeWidth="2" />
          <rect x="100" y="102" width="12" height="26" fill={strokeColor} />
          {/* Candle 3 */}
          <line x1="134" y1="74" x2="134" y2="128" stroke={strokeColor} strokeWidth="2" />
          <rect x="128" y="86" width="12" height="24" fill="none" stroke={strokeColor} strokeWidth="2" />
          {/* Candle 4 */}
          <line x1="162" y1="48" x2="162" y2="108" stroke={strokeColor} strokeWidth="2" />
          <rect x="156" y="58" width="12" height="32" fill={strokeColor} />
          {/* Smooth Moving Average */}
          <path
            d="M 60 146 C 90 138, 125 96, 178 52"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.8"
            strokeLinecap="round"
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
          <circle cx="120" cy="110" r="6" fill={strokeColor} />
        </g>
      );
  }
}

export const PersonaVisualArt: React.FC<PersonaVisualArtProps> = ({
  profile,
  proposal,
  inverted = false,
  compact = false,
}) => {
  const motifs = detectPersonMotifs(profile, proposal);
  const primaryMotif = motifs[0];
  const secondMotif = motifs[1];

  const bg = inverted ? '#0a0a0a' : '#fafafa';
  const fg = inverted ? '#ffffff' : '#000000';
  const muted = inverted ? '#737373' : '#737373';
  const borderCol = inverted ? '#262626' : '#e5e5e5';

  // Extract Persona Title from Catchphrase (e.g. 「越境する問いの設計者」)
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
      <div
        className={`grid grid-cols-1 ${
          compact ? 'md:grid-cols-12' : 'md:grid-cols-12'
        } items-center`}
      >
        {/* Left / Center Editorial SVG Emblem */}
        <div
          className="md:col-span-5 flex items-center justify-center p-6 border-b md:border-b-0 md:border-r"
          style={{ borderColor: borderCol, backgroundColor: bg }}
        >
          <svg
            viewBox="0 0 240 240"
            className="w-48 h-48 md:w-52 md:h-52 select-none"
          >
            {/* Outer Editorial Frame */}
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
            <rect
              x="12"
              y="12"
              width="216"
              height="216"
              rx="12"
              fill="none"
              stroke={fg}
              strokeWidth="0.6"
              strokeDasharray="3 3"
              opacity="0.5"
            />

            {/* Corner Crosshairs */}
            <path
              d="M 20 26 H 32 M 26 20 V 32 M 208 26 H 220 M 214 20 V 32 M 20 214 H 32 M 26 208 V 220 M 208 214 H 220 M 214 208 V 220"
              stroke={fg}
              strokeWidth="1.2"
              opacity="0.55"
            />

            {/* 24-Hour Activity Radial Crown around Center */}
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

            {/* Inner Circle */}
            <circle
              cx="120"
              cy="112"
              r="72"
              fill="none"
              stroke={fg}
              strokeWidth="1.2"
              opacity="0.3"
            />

            {/* Primary & Secondary Motif Composite */}
            {secondMotif && secondMotif.key !== primaryMotif.key && (
              <g opacity="0.22" transform="translate(8, -6) scale(0.95)">
                {renderMotifIllustration(secondMotif.key, fg)}
              </g>
            )}
            {renderMotifIllustration(primaryMotif.key, fg)}

            {/* Bottom Caption inside SVG */}
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
        </div>

        {/* Right Persona Visual Summary & Motif Breakdown */}
        <div className="md:col-span-7 p-6 space-y-4">
          <div className="space-y-1">
            <div
              className="text-[10px] font-mono-code uppercase tracking-widest"
              style={{ color: muted }}
            >
              PERSONA VISUAL ARCHETYPE // 行動履歴から生成された人物像イラスト
            </div>
            <div className="text-lg md:text-xl font-bold tracking-tight leading-snug">
              {personaTitle}
            </div>
          </div>

          <p className="text-xs leading-relaxed opacity-80">
            5サービスの履歴データから自動抽出された象徴モチーフ（
            {motifs.map((m) => `「${m.label}」`).join('×')}
            ）と、あなたの実際の24時間アクセス波形（外周リング：ピーク{' '}
            {profile.peakHour}時台）を合成したパーソナリティ・エンブレムです。
          </p>

          {/* Visual Motif Tags */}
          <div className="flex flex-wrap gap-1.5 pt-1">
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
            <span
              className={`px-2.5 py-1 rounded text-[11px] font-mono-code border ${
                inverted
                  ? 'bg-neutral-900 border-neutral-700 text-neutral-300'
                  : 'bg-neutral-100 border-neutral-300 text-neutral-700'
              }`}
            >
              24h波形ピーク: {profile.peakHour}:00
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
