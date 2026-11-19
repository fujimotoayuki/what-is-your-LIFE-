import { Type, Schema } from '@google/genai';
import { AggregatedProfile, DiscoveryItem, LifeCardProposal } from '../../types/life';
import { geminiJson } from './geminiTextClient';

/**
 * Analysis = Gemini only. There is no canned / per-dataset answer:
 * every run asks Gemini again, so the same ZIP gives a different result each time.
 * If Gemini can't answer, the caller gets an error (no template text).
 */

const DISCOVERY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    categoryTag: {
      type: Type.STRING,
      description:
        '6つの切り口のどれかを示すタグ（いま一番の沼 / もうひとつの頻出テーマ / 時間帯と季節のリズム / 昔ハマっていたこと / 履歴からの未来予測 / 考え方のクセ）',
    },
    headline: {
      type: Type.STRING,
      description: 'やわらかく自然な言葉の見出し（30字前後）',
    },
    factStatement: {
      type: Type.STRING,
      description:
        '見出しを裏付ける解説（250〜400字・3段落）。実データの検索ワード・チャンネル名・日付・回数・Geminiへの送信文の引用を具体的に入れる',
    },
    metricLabel: {
      type: Type.STRING,
      description: '根拠の数値ラベル（例: 関連検索 130件 / 深夜2時台ピーク）',
    },
    serviceBreakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          service: { type: Type.STRING },
          stat: { type: Type.STRING },
        },
        required: ['service', 'stat'],
      },
    },
    evidenceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['id', 'categoryTag', 'headline', 'factStatement', 'metricLabel', 'evidenceIds'],
};

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    nickname: {
      type: Type.STRING,
      description: 'この人の二つ名（例: 越境する問いの設計者）。「」は付けない。15字以内',
    },
    catchphrase: {
      type: Type.STRING,
      description: 'この人をやわらかく一言で表すキャッチフレーズ（40字以内）',
    },
    discoveries: { type: Type.ARRAY, items: DISCOVERY_SCHEMA },
  },
  required: ['nickname', 'catchphrase', 'discoveries'],
};

type GeminiReply = Omit<LifeCardProposal, 'analysisModel'>;

function isReply(v: unknown): v is GeminiReply {
  const r = v as GeminiReply;
  return (
    !!r &&
    typeof r.nickname === 'string' &&
    typeof r.catchphrase === 'string' &&
    Array.isArray(r.discoveries) &&
    r.discoveries.length >= 6
  );
}

export function buildSystemPrompt(profile: AggregatedProfile): string {
  const payload = {
    period: profile.period,
    unconsciousStats: profile.unconsciousStats,
    aiRawDigest: profile.aiRawDigest,
    validEvidenceIds: Object.keys(profile.evidenceCatalog),
  };

  return `このGoogle Takeoutのデータ（YouTube視聴・検索、Google検索、Geminiへの送信メッセージ、NotebookLMのノート、Googleマップ、時間帯別・月別の推移）を横断的に見て、**この人の特徴を6個**挙げ、この人に**二つ名とキャッチフレーズ**をつけてください。

【ルール】
1. 固い言葉・論文調はNG。友達が語りかけるような、やわらかい言葉で書くこと（「〜をよく調べているね」「〜なところが面白い」など）。
2. 解説（factStatement）は250〜400字・3段落で具体的に。データに実在する検索ワード、チャンネル名、日付、回数、Geminiへの送信文の引用を入れること。データにないことは書かない。
3. 6個の特徴は次の切り口で1つずつ作ること：
   - 特徴1【いま一番興味を持って深く掘っていること】：意味の近いワード群をまとめて、何をどれくらい調べ、どの動画・ノート・質問とつながっているか。
   - 特徴2【特徴1ほどではないが、よく出てくる別のテーマ】：趣味・カルチャー・推し・よく行く場所など。
   - 特徴3【活動の多い時間帯と、時間帯・季節で変わる中身】：朝・昼・夜・深夜の比率、時間帯ごとに調べるものの違い、月ごとの変化、動画の即スキップや累計視聴時間。
   - 特徴4【昔はよく調べていたが、今は落ち着いたこと】：過去と今の回数を比べて振り返る。
   - 特徴5【この履歴から予想する将来の姿】：「あくまで履歴からの推測だけど…」と前置きして、ワクワクする視点で具体的に。
   - 特徴6【考え方のクセ】：感情寄りか論理寄りか、現実派か理想を広げる派か、外向的か内向的か。検索やAIへの聞き方を根拠に。「MBTI」やアルファベット記号は使わない。
4. 性別は推測しない・書かない。
5. evidenceIds には下の validEvidenceIds から関係するIDを選ぶ。

【Google Takeout 集計データ】
${JSON.stringify(payload, null, 2)}`;
}

function normalize(reply: GeminiReply, profile: AggregatedProfile, model: string): LifeCardProposal {
  const validIds = new Set(Object.keys(profile.evidenceCatalog));
  const discoveries: DiscoveryItem[] = reply.discoveries.slice(0, 6).map((d, i) => ({
    ...d,
    id: d.id || `disc-${i + 1}`,
    evidenceIds: (d.evidenceIds || []).filter((id) => validIds.has(id)),
  }));
  return {
    nickname: reply.nickname.replace(/[「」]/g, '').trim(),
    catchphrase: reply.catchphrase.trim(),
    discoveries,
    analysisModel: model,
  };
}

export async function analyzeProfileWithGemini(
  profile: AggregatedProfile,
  userApiKey?: string,
  onProgress?: (msg: string) => void
): Promise<LifeCardProposal> {
  const result = await geminiJson<GeminiReply>(buildSystemPrompt(profile), {
    apiKey: userApiKey,
    schema: RESPONSE_SCHEMA,
    validate: isReply,
    temperature: 1.0, // varied answers on every run are intended
    onLog: onProgress,
  });
  if (!result) {
    throw new Error(
      'Geminiから分析結果を受け取れませんでした（APIキーの誤り・利用上限・混雑・タイムアウトの可能性）。少し時間をおいてもう一度試してください。'
    );
  }
  return normalize(result.data, profile, result.model);
}
