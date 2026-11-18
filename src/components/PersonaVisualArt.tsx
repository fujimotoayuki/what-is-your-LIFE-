import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { AggregatedProfile, LifeCardProposal } from '../types/life';

interface PersonaVisualArtProps {
  profile: AggregatedProfile;
  proposal: LifeCardProposal;
  inverted?: boolean;
  compact?: boolean;
}

function selectPresetPersonaImage(
  profile: AggregatedProfile,
  proposal: LifeCardProposal
): string | null {
  const d = profile.aiRawDigest;
  const fullText = [
    profile.datasetLabel,
    proposal.catchphrase,
    ...proposal.discoveries.map((x) => `${x.headline} ${x.factStatement}`),
    ...(d?.googleSearchTopQueries?.slice(0, 20).map((q) => q.query) || []),
    ...(d?.youtubeTopChannels?.slice(0, 10).map((c) => c.name) || []),
    ...(d?.notebooks?.map((n) => n.title) || []),
  ].join(' ');

  if (/書道|千字文|高木聖雨|SoFi|雨来ズ/.test(fullText)) {
    return '/personas/persona-user-real.jpg';
  }
  if (/マンデリン|粕谷哲|週末縄文人|古民家構造補強/.test(fullText)) {
    return '/personas/persona-dummy-coffee.jpg';
  }
  if (/コヨーテタイム|Masahiro Sakurai|SoundQuest|モーダルインターチェンジ/.test(fullText)) {
    return '/personas/persona-dummy-gamedev.jpg';
  }
  if (/分割キーボード|QMK|アメ横|サウナ|サンプルデータ/.test(fullText)) {
    return '/personas/persona-sample-sauna.jpg';
  }
  return null;
}

function buildCustomAiScenePrompt(
  profile: AggregatedProfile,
  proposal: LifeCardProposal
): string {
  const d = profile.aiRawDigest;
  const topQs = (d?.googleSearchTopQueries || [])
    .slice(0, 6)
    .map((q) => q.query)
    .join(', ');
  const topChs = (d?.youtubeTopChannels || [])
    .slice(0, 4)
    .map((c) => c.name)
    .join(', ');
  const topNbs = (d?.notebooks || [])
    .slice(0, 3)
    .map((n) => n.title)
    .join(', ');

  return `Masterpiece anime digital illustration, rich detailed concept art. In the center, a mysterious gender-neutral pitch-black shadow silhouette person wearing a casual hoodie/jacket and headphones around the neck, sitting in a contemplative pose with hand on chin at a wooden desk with a laptop, open notebook, coffee mug, and hourglass, glowing white light trails swirling around them. Surrounding the shadow figure in the room are floating glowing holographic screens, wall items, and charts representing their 6 traits: ${topQs}, ${topChs}, ${topNbs}, a glowing circular 24-hour life-cycle clock diagram ring above their head (peaking at ${profile.peakHour}:00), and a stack of 6 hardcover books on the bottom-right of the desk. Warm dramatic lighting, ultra detailed.`;
}

async function generateFreeAiIllustration(prompt: string): Promise<string | null> {
  // Tier 1: Hugging Face FLUX.1-schnell Gradio API
  try {
    const callRes = await fetch(
      'https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/call/infer',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [prompt, 0, true, 768, 960, 4],
        }),
      }
    );
    if (callRes.ok) {
      const { event_id } = (await callRes.json()) as { event_id?: string };
      if (event_id) {
        const streamRes = await fetch(
          `https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/call/infer/${event_id}`
        );
        const sseText = await streamRes.text();
        const urlMatch = sseText.match(/"url":\s*"([^"]+)"/);
        if (urlMatch && urlMatch[1]) {
          const imgRes = await fetch(urlMatch[1]);
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            return await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onloadend = () => resolve(String(r.result));
              r.onerror = reject;
              r.readAsDataURL(blob);
            });
          }
        }
      }
    }
  } catch {
    // Fall through to Tier 2
  }

  // Tier 2: Pollinations Flux API
  try {
    const seed = Math.floor(Math.random() * 999999);
    const pollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=768&height=960&nologo=true&seed=${seed}`;
    const res = await fetch(pollUrl);
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    }
  } catch {
    // Fall through to Tier 3
  }

  // Tier 3: AI Horde Anonymous Distributed Generator
  try {
    const startRes = await fetch(
      'https://stablehorde.net/api/v2/generate/async',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: '0000000000',
        },
        body: JSON.stringify({
          prompt,
          params: { width: 512, height: 640, steps: 20 },
        }),
      }
    );
    if (startRes.ok) {
      const { id } = (await startRes.json()) as { id?: string };
      if (id) {
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          const statusRes = await fetch(
            `https://stablehorde.net/api/v2/generate/status/${id}`
          );
          if (statusRes.ok) {
            const statusJson = (await statusRes.json()) as {
              done?: boolean;
              generations?: { img?: string }[];
            };
            if (statusJson.done && statusJson.generations?.[0]?.img) {
              const imgVal = statusJson.generations[0].img;
              if (imgVal.startsWith('http')) {
                const bRes = await fetch(imgVal);
                const blob = await bRes.blob();
                return await new Promise<string>((resolve, reject) => {
                  const r = new FileReader();
                  r.onloadend = () => resolve(String(r.result));
                  r.onerror = reject;
                  r.readAsDataURL(blob);
                });
              }
              return `data:image/webp;base64,${imgVal}`;
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export const PersonaVisualArt: React.FC<PersonaVisualArtProps> = ({
  profile,
  proposal,
  inverted = false,
  compact = false,
}) => {
  const presetSrc = selectPresetPersonaImage(profile, proposal);
  const [generatedSrc, setGeneratedSrc] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // If an unknown custom dataset is uploaded (no preset match), automatically generate via AI
  useEffect(() => {
    setGeneratedSrc(null);
    if (!presetSrc) {
      let active = true;
      setIsGenerating(true);
      const prompt = buildCustomAiScenePrompt(profile, proposal);
      generateFreeAiIllustration(prompt).then((url) => {
        if (active) {
          if (url) setGeneratedSrc(url);
          setIsGenerating(false);
        }
      });
      return () => {
        active = false;
      };
    }
  }, [presetSrc, profile.datasetLabel, proposal.catchphrase]);

  const handleRegenerateAi = async () => {
    setIsGenerating(true);
    try {
      const prompt = buildCustomAiScenePrompt(profile, proposal);
      const url = await generateFreeAiIllustration(prompt);
      if (url) {
        setGeneratedSrc(url);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const finalSrc =
    generatedSrc || presetSrc || '/personas/persona-sample-sauna.jpg';

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
        className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
          inverted ? 'border-neutral-800' : 'border-neutral-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs md:text-sm font-bold">
            行動履歴から生成した「あなたの人物像イメージイラスト」
          </span>
        </div>

        {!compact && (
          <div className="flex items-center gap-2">
            {generatedSrc && presetSrc && (
              <button
                type="button"
                onClick={() => setGeneratedSrc(null)}
                className="px-2.5 py-1 rounded border border-neutral-300 text-[11px] text-neutral-600 hover:text-black cursor-pointer"
              >
                元のイラストに戻す
              </button>
            )}
            <button
              type="button"
              onClick={handleRegenerateAi}
              disabled={isGenerating}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                inverted ? 'bg-white text-black' : 'bg-black text-white'
              }`}
            >
              <RefreshCw
                className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`}
              />
              {isGenerating
                ? 'AIで1枚絵を描画中...'
                : 'AIで別パターンの1枚絵を生成'}
            </button>
          </div>
        )}
      </div>

      {/* Pure 1-Piece AI Illustration Image */}
      <div className="relative w-full bg-neutral-950 flex items-center justify-center">
        <img
          src={finalSrc}
          alt={proposal.catchphrase}
          className={`w-full ${
            compact ? 'max-h-[580px]' : 'max-h-[740px]'
          } object-contain mx-auto block`}
        />

        {isGenerating && (
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-white p-6 text-center">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <div className="text-xs md:text-sm font-bold">
              6つの特徴から「影の人＋脳内ワールド」の1枚絵イラストをAI生成しています...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
