import React, { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { AggregatedProfile, LifeCardProposal } from '../types/life';

interface PersonaVisualArtProps {
  profile: AggregatedProfile;
  proposal: LifeCardProposal;
  inverted?: boolean;
  compact?: boolean;
}

function buildShadowScenePrompt(
  profile: AggregatedProfile,
  proposal: LifeCardProposal
): string {
  const d = profile.aiRawDigest;
  const topQueries = (d?.googleSearchTopQueries || [])
    .slice(0, 5)
    .map((q) => q.query)
    .join(', ');
  const topChs = (d?.youtubeTopChannels || [])
    .slice(0, 3)
    .map((c) => c.name)
    .join(', ');
  const topNbs = (d?.notebooks || [])
    .slice(0, 2)
    .map((n) => n.title)
    .join(', ');

  return `Cinematic ultra-detailed anime-style digital illustration of a mysterious gender-neutral featureless dark shadow silhouette figure wearing a hoodie and headphones around the neck, sitting in a contemplative pose with hand on chin at a wooden study desk with a laptop, open notebook, coffee mug, and hourglass. Surrounding the shadow figure in the room are glowing floating holographic screens and items representing their mind: ${topQueries}, ${topChs}, ${topNbs}, a glowing circular 24-hour life-cycle clock ring above their head, and a stack of hardcover books on the desk. Warm cinematic lighting with glowing light trails swirling around the figure, masterpiece quality.`;
}

export const PersonaVisualArt: React.FC<PersonaVisualArtProps> = ({
  profile,
  proposal,
  inverted = false,
  compact = false,
}) => {
  const [customAiImageUrl, setCustomAiImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const d = profile.aiRawDigest;
  const shodoCount =
    d?.googleSearchPatternCounts?.['書道・書法・千字文・日展・漢詩関連'] || 0;
  const financeCount =
    d?.googleSearchPatternCounts?.['株価・投資・銘柄・金融関連'] || 0;
  const sofiNb = d?.notebooks?.find((n) => /sofi/i.test(n.title));
  const isUserDataset = shodoCount > 0 && (financeCount > 0 || Boolean(sofiNb));

  const titleMatch = proposal.catchphrase.match(/「([^」]+)」/);
  const personaTitle = titleMatch
    ? titleMatch[1]
    : proposal.catchphrase.slice(0, 20);

  const handleGenerateNewScene = async () => {
    setIsGenerating(true);
    try {
      const prompt = buildShadowScenePrompt(profile, proposal);
      const seed = Math.floor(Math.random() * 999999);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
        prompt
      )}?width=768&height=960&nologo=true&model=flux&seed=${seed}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to generate');
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      setCustomAiImageUrl(dataUrl);
    } catch {
      // Keep default shadow scene
    } finally {
      setIsGenerating(false);
    }
  };

  const displaySrc = customAiImageUrl || '/persona-shadow-scene.jpg';

  const leftKeywords = isUserDataset
    ? ['書道・古典墨蹟', '雨来ズ。・aespa', 'ショート動画フック']
    : (d?.googleSearchTopQueries || []).slice(0, 3).map((q) => q.query);

  const rightKeywords = isUserDataset
    ? ['株価・SoFi・市場構造', 'AI壁打ち・根拠検証', '都市・思考構造ノート']
    : (d?.youtubeTopChannels || []).slice(0, 3).map((c) => c.name);

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        inverted
          ? 'bg-neutral-950 border-neutral-800 text-white'
          : 'bg-white border-black text-black'
      }`}
    >
      {/* Top Bar */}
      <div
        className={`px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-2 ${
          inverted ? 'border-neutral-800' : 'border-neutral-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs md:text-sm font-bold">
            行動履歴から生成した「あなたの脳内・世界観イメージ図」
          </span>
        </div>

        {!compact && (
          <div className="flex items-center gap-2">
            {customAiImageUrl && (
              <button
                type="button"
                onClick={() => setCustomAiImageUrl(null)}
                className="px-2.5 py-1 rounded border border-neutral-300 text-[11px] text-neutral-600 hover:text-black cursor-pointer"
              >
                標準イラストに戻す
              </button>
            )}
            <button
              type="button"
              onClick={handleGenerateNewScene}
              disabled={isGenerating}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                inverted ? 'bg-white text-black' : 'bg-black text-white'
              }`}
            >
              <RefreshCw
                className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`}
              />
              {isGenerating
                ? 'AIで別シーンを描画中...'
                : 'AIで別パターンの影の人を生成'}
            </button>
          </div>
        )}
      </div>

      {/* Main Shadow Persona Illustration Container */}
      <div className="relative w-full bg-neutral-900 overflow-hidden">
        <img
          src={displaySrc}
          alt={personaTitle}
          className={`w-full ${
            compact ? 'max-h-[540px]' : 'max-h-[680px]'
          } object-cover object-center mx-auto block`}
        />

        {/* Subtle Bottom Vignette & Glowing Stance Formula Overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-16 pb-5 px-6 flex flex-col items-center text-center text-white select-none">
          <div className="flex items-center gap-4 md:gap-6 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            <div className="text-right">
              <div className="text-base md:text-2xl font-serif font-bold tracking-wider">
                発想・妄想
              </div>
              <div className="text-[10px] md:text-xs opacity-80 font-mono-code">
                (Imagining Big)
              </div>
            </div>

            <div className="text-xl md:text-3xl font-light opacity-80">×</div>

            <div className="text-left">
              <div className="text-base md:text-2xl font-serif font-bold tracking-wider">
                検証・構造化
              </div>
              <div className="text-[10px] md:text-xs opacity-80 font-mono-code">
                (Evidence &amp; Structure)
              </div>
            </div>
          </div>

          {/* Floating Theme Pills at Bottom of Poster */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {[...leftKeywords, ...rightKeywords].slice(0, 6).map((kw, i) => (
              <span
                key={i}
                className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 text-[10px] md:text-[11px] text-white font-medium"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
