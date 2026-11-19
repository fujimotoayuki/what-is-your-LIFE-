import { GoogleGenAI, Type, Schema } from '@google/genai';
import { AggregatedProfile, DiscoveryItem, LifeCardProposal } from '../../types/life';
import { geminiJson, getGeminiKey, hasUsableKey } from './geminiTextClient';

/**
 * Gemini image models, tried in order. Image generation needs a billing-enabled
 * Gemini API key (it is not part of the free tier). The same key is used for the analysis.
 */
export const GEMINI_IMAGE_MODELS = ['gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image'];

/**
 * Scene spec: the 6 traits translated into concrete, drawable motifs.
 * Layout mirrors the reference composition:
 *   center  = pitch-black gender-neutral silhouette at a desk
 *   above   = semicircular daily-rhythm arc
 *   left / right walls = trait motifs
 *   desk    = stack of 6 book spines labelled with the traits
 *   center caption = "X × Y" (thinking style pair)
 */
export interface PersonaSceneSpec {
  leftWall: string[];
  rightWall: string[];
  deskProps: string[];
  rhythmLabels: string[];
  bookSpines: string[];
  captionLeft: string;
  captionRight: string;
  mood: string;
  /** What the silhouette is doing, chosen per person (not fixed). */
  pose: string;
}

export function selectedTraits(proposal: LifeCardProposal): DiscoveryItem[] {
  return proposal.discoveries.slice(0, 6);
}

/** Changes whenever the analysis result changes → triggers a new image. */
export function traitSignature(proposal: LifeCardProposal): string {
  return JSON.stringify([
    proposal.nickname,
    proposal.catchphrase,
    selectedTraits(proposal).map((d) => [d.id, d.categoryTag, d.headline, d.factStatement]),
  ]);
}

function traitsText(profile: AggregatedProfile, proposal: LifeCardProposal) {
  return selectedTraits(proposal)
    .map(
      (d, i) =>
        `${i + 1}. [${d.categoryTag}] ${d.headline}\n${d.factStatement.slice(0, 400)}`
    )
    .join('\n\n')
    .concat(
      `\n\nPeak activity hour: ${profile.peakHour}:00, late-night ratio ${profile.lateNightRatio}%`
    );
}

const SPEC_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    leftWall: { type: Type.ARRAY, items: { type: Type.STRING } },
    rightWall: { type: Type.ARRAY, items: { type: Type.STRING } },
    deskProps: { type: Type.ARRAY, items: { type: Type.STRING } },
    rhythmLabels: { type: Type.ARRAY, items: { type: Type.STRING } },
    bookSpines: { type: Type.ARRAY, items: { type: Type.STRING } },
    captionLeft: { type: Type.STRING },
    captionRight: { type: Type.STRING },
    mood: { type: Type.STRING },
    pose: { type: Type.STRING },
  },
  required: [
    'leftWall',
    'rightWall',
    'deskProps',
    'rhythmLabels',
    'bookSpines',
    'captionLeft',
    'captionRight',
    'mood',
    'pose',
  ],
};

function isSpec(v: unknown): v is PersonaSceneSpec {
  const s = v as PersonaSceneSpec;
  return (
    !!s &&
    Array.isArray(s.leftWall) &&
    Array.isArray(s.rightWall) &&
    Array.isArray(s.bookSpines) &&
    typeof s.captionLeft === 'string' &&
    typeof s.pose === 'string'
  );
}

async function buildSceneSpecWithGemini(
  profile: AggregatedProfile,
  proposal: LifeCardProposal,
  apiKey?: string,
  onLog?: (msg: string) => void
): Promise<PersonaSceneSpec | null> {
  const prompt = `You are an art director. Convert the person's 6 behavioral traits below into concrete, DRAWABLE visual motifs for one illustration of their room/inner world.
Rules:
- Motifs must be generic visual objects (e.g. "candlestick stock chart hologram", "calligraphy scroll with 書", "concert stage with glowing lightsticks"), never real people's names, real brand logos, or private info.
- Every one of the 6 traits must appear as at least one motif somewhere (walls or desk).
- leftWall: 3-4 motifs. rightWall: 3-4 motifs. deskProps: 3-4 objects on the desk.
- rhythmLabels: 5-6 short English labels (2-3 words) describing their day cycle, ordered morning -> night, based on peak hour.
- bookSpines: exactly 6 Japanese labels (max 8 chars each), one per trait, like "投資・市場分析".
- captionLeft / captionRight: the two sides of their thinking style in short Japanese (e.g. 発想 / 検証・構造化).
- mood: lighting/season/atmosphere in one English sentence.
- pose: one English sentence on what the central silhouette is doing, chosen to fit THIS person (e.g. standing and sketching on a whiteboard, leaning back watching a screen, kneeling to work on a wooden floor). Be creative and vary it; do not default to sitting with a hand on the chin. Do not add headphones or other accessories unless a trait clearly calls for them.

Traits:
${traitsText(profile, proposal)}

Nickname: ${proposal.nickname}
Catchphrase: ${proposal.catchphrase}`;

  const res = await geminiJson<PersonaSceneSpec>(prompt, {
    apiKey,
    schema: SPEC_SCHEMA,
    validate: isSpec,
    temperature: 0.6,
    timeoutMs: 120_000,
    onLog,
  });
  return res?.data ?? null;
}

/**
 * Used only when Gemini can't build the spec. Still person-specific: it feeds each
 * trait's headline (Japanese is fine for Gemini image models) instead of generic props.
 */
function buildFallbackSpec(
  profile: AggregatedProfile,
  proposal: LifeCardProposal
): PersonaSceneSpec {
  const traits = selectedTraits(proposal);
  const motifs = traits.map((d) => `a visual motif symbolizing 「${d.headline}」`);
  const spines = traits.map((d) => d.categoryTag.slice(0, 8));
  while (spines.length < 6) spines.push('好奇心');
  const night = profile.peakHour >= 20 || profile.peakHour < 5;
  const poses = [
    'standing and reaching toward one of the floating motifs',
    'leaning back in a chair, looking up at the arc diagram',
    'standing at the desk, writing in the open notebook',
    'sitting on the edge of the desk, turned slightly toward the viewer',
    'walking through the room mid-stride, glancing at the walls',
  ];
  return {
    pose: poses[Math.floor(Math.random() * poses.length)],
    leftWall: motifs.slice(0, 3),
    rightWall: motifs.slice(3, 6),
    deskProps: ['open notebook with handwritten diagrams', 'hourglass', 'ceramic mug', 'laptop'],
    rhythmLabels: night
      ? ['Morning Reset', 'Learning', 'Deep Work', 'Create', 'Night Focus']
      : ['Morning Plan', 'Deep Work', 'Learning', 'Create', 'Sleep & Reset'],
    bookSpines: spines,
    captionLeft: '発想',
    captionRight: '検証・構造化',
    mood: night
      ? 'deep blue night with warm desk lamp glow and city lights through the window'
      : 'warm golden-hour light through a large window, cinematic depth of field',
  };
}

const SILHOUETTE_RULES =
  'The central figure is a completely solid pitch-black silhouette: no face, no eyes, no skin, no hair detail, no visible gender, neutral body shape, like a cut-out shadow of a person. Clothes and accessories also read as pure black shape. Everything else in the scene is full color and highly detailed.';

export function composeImagePrompt(spec: PersonaSceneSpec): string {
  return `Highly detailed anime-style digital illustration, vertical 3:4 poster, cinematic and dense like a key visual.
CENTER: ${SILHOUETTE_RULES} The silhouette is ${spec.pose}. No headphones unless stated. There is a wooden desk in the room. Soft white light trails swirl around the figure.
ABOVE THE HEAD: a large translucent semicircular arc diagram (a daily rhythm dial) with small icons and labels: ${spec.rhythmLabels.map((l) => `"${l}"`).join(', ')}; inside the arc, a small landscape with a mountain and city skyline.
LEFT SIDE OF THE ROOM: ${spec.leftWall.join('; ')}.
RIGHT SIDE OF THE ROOM: ${spec.rightWall.join('; ')}.
DESK: ${spec.deskProps.join('; ')}. On the bottom-right of the desk, a stack of 6 hardcover books whose spines are clearly labelled in Japanese: ${spec.bookSpines.map((b) => `「${b}」`).join(' ')}.
CENTER-BOTTOM CAPTION in elegant brush lettering over a white ink stroke: 「${spec.captionLeft}」 × 「${spec.captionRight}」.
Atmosphere: ${spec.mood}. Rich color, sharp details, crisp legible text.`;
}

function describeImageError(e: unknown): string {
  const msg = String((e as Error)?.message || e);
  const code = msg.match(/"code":\s*(\d{3})/)?.[1] || msg.match(/(4\d\d|5\d\d)/)?.[1];
  if (code === '429') return '利用上限に到達（画像生成は無料枠では使えません。課金を有効にしたキーが必要です）';
  if (code === '400' && /billing|paid|free tier/i.test(msg)) return '画像生成には課金を有効にしたキーが必要です';
  if (code === '401' || code === '403') return 'APIキーが無効か、このモデルの権限がありません';
  if (code === '404') return 'このモデルは使えません';
  return msg.slice(0, 160);
}

async function generateWithGemini(
  prompt: string,
  apiKey: string,
  onLog?: (msg: string) => void
): Promise<{ src: string; model: string }> {
  const ai = new GoogleGenAI({ apiKey });
  let lastError = '';
  for (const model of GEMINI_IMAGE_MODELS) {
    onLog?.(`${model} で画像を生成中...`);
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '3:4' },
        },
      });
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (part?.inlineData?.data) {
        return {
          src: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`,
          model,
        };
      }
      lastError = '画像が返ってきませんでした（安全フィルタの可能性）';
      onLog?.(`× ${model}: ${lastError}`);
    } catch (e) {
      lastError = describeImageError(e);
      onLog?.(`× ${model}: ${lastError}`);
    }
  }
  throw new Error(`画像生成に失敗: ${lastError}`);
}

export interface PersonaImageResult {
  src: string;
  prompt: string;
  specSource: 'gemini' | 'fallback';
  model: string;
}

export async function generatePersonaImage(
  profile: AggregatedProfile,
  proposal: LifeCardProposal,
  apiKey?: string,
  onLog?: (msg: string) => void
): Promise<PersonaImageResult> {
  const key = getGeminiKey(apiKey);
  if (!hasUsableKey(key)) throw new Error('Gemini APIキーを入力してください');
  onLog?.('6つの特徴を絵の小物に変換中...');
  const geminiSpec = await buildSceneSpecWithGemini(profile, proposal, apiKey, onLog);
  const spec = geminiSpec ?? buildFallbackSpec(profile, proposal);
  const prompt = composeImagePrompt(spec);
  const { src, model } = await generateWithGemini(prompt, key, onLog);
  return { src, prompt, specSource: geminiSpec ? 'gemini' : 'fallback', model };
}
