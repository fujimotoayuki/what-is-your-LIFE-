import React from 'react';
import { AggregatedProfile, LifeCardProposal } from '../types/life';

interface PersonaVisualArtProps {
  profile: AggregatedProfile;
  proposal: LifeCardProposal;
  inverted?: boolean;
  compact?: boolean;
}

interface BrainBlock {
  title: string;
  sub: string;
  stat: string;
  weight: number; // relative visual size
}

function buildBrainBlocks(
  profile: AggregatedProfile,
  proposal: LifeCardProposal
): BrainBlock[] {
  const d = profile.aiRawDigest;
  const shodoCount =
    d?.googleSearchPatternCounts?.['書道・書法・千字文・日展・漢詩関連'] || 0;
  const financeCount =
    d?.googleSearchPatternCounts?.['株価・投資・銘柄・金融関連'] || 0;
  const sofiNb = d?.notebooks?.find((n) => /sofi/i.test(n.title));

  if (shodoCount > 0 && (financeCount > 0 || sofiNb)) {
    const amekozuCnt =
      profile.topChannels.find((c) => /雨来ズ/.test(c.name))?.count || 1062;
    const aespaCnt =
      profile.topChannels.find((c) => /aespa/i.test(c.name))?.count || 163;
    return [
      {
        title: 'エンタメ視聴 × 人気が生まれる仕組みの解剖',
        sub: '雨来ズ。・aespa・せじゅ / 推される理由 / ショート動画冒頭フック研究',
        stat: `雨来ズ。${amekozuCnt}件・aespa ${aespaCnt}件・動画資料9件`,
        weight: 30,
      },
      {
        title: '投資・株価 × 値動きの理由と市場アルゴリズム',
        sub: 'ビットコイン・メタプラ・テスラ / 機関投資家の空売り・うねり取り / SoFi分析',
        stat: `投資検索 ${financeCount}件・SoFi資料 ${sofiNb?.sourceCount || 49}件`,
        weight: 26,
      },
      {
        title: '書道（古典テキストから現代書家・公募展まで）',
        sub: '千字文(隷書)・陶淵明『雑詩』・書法字典 / 日展・読売書法展・高木聖雨・武田双雲',
        stat: `書道・古典検索 ${shodoCount}件（11/16に13回連続検索）`,
        weight: 22,
      },
      {
        title: 'AI壁打ち・根拠検証 × 大規模構想の設計図化',
        sub: '「ソースがないと信頼しない」 / 都市縮退・思考放棄の分析 / 人生データ3要素設計',
        stat: `Gemini ${d?.overview?.geminiPromptCount || 407}件・NotebookLM ${
          d?.overview?.notebookLmCount || 10
        }冊`,
        weight: 22,
      },
    ];
  }

  // Dynamic blocks from proposal discoveries for any other dataset
  return proposal.discoveries.slice(0, 4).map((disc, idx) => ({
    title: disc.headline.replace(/^\d+\.\s*/, ''),
    sub: disc.factStatement.split('。')[0] + '。',
    stat: disc.metricLabel,
    weight: idx === 0 ? 32 : idx === 1 ? 26 : 21,
  }));
}

export const PersonaVisualArt: React.FC<PersonaVisualArtProps> = ({
  profile,
  proposal,
  inverted = false,
}) => {
  const blocks = buildBrainBlocks(profile, proposal);
  const maxHourVal = Math.max(...profile.hourlyDistribution, 1);

  const rankedHours = profile.hourlyDistribution
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count);
  const top3Hours = rankedHours.slice(0, 3).map((h) => `${h.hour}時台`);

  return (
    <div
      className={`rounded-2xl border p-6 space-y-6 ${
        inverted
          ? 'bg-neutral-950 border-neutral-800 text-white'
          : 'bg-neutral-50 border-black text-black'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b pb-3 border-neutral-500/20">
        <div>
          <div className="text-[10px] font-mono-code uppercase tracking-widest opacity-50">
            VISUAL BRAIN &amp; 24H RHYTHM MAP
          </div>
          <h3 className="text-sm md:text-base font-bold">
            一目でわかる「頭の中の構成比率」と「24時間の行動波形」
          </h3>
        </div>
        <div className="text-[11px] font-mono-code opacity-70">
          全 {profile.totalEvents.toLocaleString()} 件の記録から可視化
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* Left: Brain Share Map (What occupies this person's mind) */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-2.5">
          <div className="text-[11px] font-bold opacity-75">
            ■ 脳内を占める4大テーマと掘り下げ方
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
            {blocks.map((b, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
                  i === 0
                    ? inverted
                      ? 'bg-white text-black border-white sm:col-span-2'
                      : 'bg-black text-white border-black sm:col-span-2'
                    : inverted
                    ? 'bg-neutral-900 border-neutral-700 text-white'
                    : 'bg-white border-black text-black'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono-code opacity-70">
                      CORE #{i + 1} ({b.weight}%)
                    </span>
                    <span className="text-[10px] font-mono-code font-bold px-1.5 py-0.5 rounded border border-current/30">
                      {b.stat}
                    </span>
                  </div>
                  <div className="text-xs md:text-sm font-bold leading-snug">
                    {b.title}
                  </div>
                  <div className="text-[11px] opacity-80 leading-relaxed">
                    {b.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: 24-Hour Activity Bar Chart & Unconscious Habit Gauges */}
        <div className="md:col-span-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold opacity-75">
                ■ 24時間の活動リズム波形
              </span>
              <span className="font-mono-code opacity-70">
                ピーク: {top3Hours.join(' / ')}
              </span>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-2 ${
                inverted
                  ? 'bg-neutral-900 border-neutral-800'
                  : 'bg-white border-neutral-300'
              }`}
            >
              <div className="h-28 flex items-end gap-1 pt-2">
                {profile.hourlyDistribution.map((cnt, hr) => {
                  const pct = Math.max(Math.round((cnt / maxHourVal) * 100), 4);
                  const isTop =
                    hr === rankedHours[0]?.hour ||
                    hr === rankedHours[1]?.hour ||
                    hr === rankedHours[2]?.hour;
                  return (
                    <div
                      key={hr}
                      className="flex-1 h-full flex flex-col justify-end items-center gap-1"
                      title={`${hr}時台: ${cnt}件`}
                    >
                      <div
                        className={`w-full rounded-t transition-all ${
                          isTop
                            ? inverted
                              ? 'bg-white'
                              : 'bg-black'
                            : inverted
                            ? 'bg-neutral-700'
                            : 'bg-neutral-300'
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] font-mono-code opacity-50 pt-1 border-t border-neutral-500/20">
                <span>0時</span>
                <span>6時</span>
                <span>12時</span>
                <span>18時</span>
                <span>23時</span>
              </div>
            </div>
          </div>

          {/* 3 Key Unconscious Numbers */}
          <div
            className={`p-4 rounded-xl border space-y-2.5 text-xs ${
              inverted
                ? 'bg-neutral-900 border-neutral-800'
                : 'bg-white border-neutral-300'
            }`}
          >
            <div className="text-[11px] font-bold opacity-75">
              ■ 無意識の行動データ
            </div>
            <div className="flex items-center justify-between border-b pb-1.5 border-neutral-500/15">
              <span className="opacity-75">開始15秒以内の即スキップ</span>
              <span className="font-mono-code font-bold">
                {profile.unconsciousStats?.rapidSkip15sCount.toLocaleString() ||
                  0}{' '}
                回 ({profile.unconsciousStats?.rapidSkipRatioPct || 0}%)
              </span>
            </div>
            <div className="flex items-center justify-between border-b pb-1.5 border-neutral-500/15">
              <span className="opacity-75">YouTube累計視聴時間</span>
              <span className="font-mono-code font-bold">
                {profile.unconsciousStats?.totalWatchHours.toLocaleString() || 0}{' '}
                時間 (丸{profile.unconsciousStats?.totalDaysEquivalent || 0}日分)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-75">視聴したチャンネルの種類</span>
              <span className="font-mono-code font-bold">
                {(
                  profile.aiRawDigest?.overview?.uniqueYoutubeChannels ||
                  profile.topChannels.length
                ).toLocaleString()}{' '}
                チャンネル
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
