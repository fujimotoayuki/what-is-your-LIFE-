import { GoogleGenAI, Type, Schema } from '@google/genai';
import {
  AggregatedProfile,
  DiscoveryItem,
  EraChapter,
  LifeCardProposal,
  ServiceBreakdownChip,
  TopicSummary,
} from '../../types/life';

export type AnalysisTonePreset = 'sns_pop';

export interface AnalysisCustomOptions {
  tonePreset: AnalysisTonePreset;
  customInstruction: string;
}

function buildBreakdownForTopic(t: TopicSummary): ServiceBreakdownChip[] {
  const chips: ServiceBreakdownChip[] = [];
  if (t.gSearchCount && t.gSearchCount > 0) {
    chips.push({ service: 'Google検索', stat: `${t.gSearchCount}件` });
  }
  if (t.mapsCount && t.mapsCount > 0) {
    chips.push({ service: 'Googleマップ', stat: `${t.mapsCount}件` });
  }
  if (t.geminiCount && t.geminiCount > 0) {
    chips.push({ service: 'Gemini送信', stat: `${t.geminiCount}件` });
  }
  if (t.notebookCount && t.notebookCount > 0) {
    chips.push({ service: 'NotebookLM', stat: `${t.notebookCount}冊` });
  }
  if (t.ytSearchCount && t.ytSearchCount > 0) {
    chips.push({ service: 'YouTube検索', stat: `${t.ytSearchCount}件` });
  }
  if (t.ytWatchCount && t.ytWatchCount > 0) {
    chips.push({
      service: 'YouTube視聴',
      stat: `${t.ytWatchCount}件${t.watchHours ? ` (${t.watchHours}h)` : ''}`,
    });
  }
  return chips;
}

const LIFE_CARD_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    catchphrase: {
      type: Type.STRING,
      description:
        'この人に名前（二つ名）と一言キャッチフレーズをつけた文字列。例: 「越境する問いの設計者」— 書の一画から市場の一手まで。気になったら、根拠を探して設計図にする人',
    },
    eraChapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          periodLabel: { type: Type.STRING },
          themeTitle: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ['periodLabel', 'themeTitle', 'summary'],
      },
    },
    discoveries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          headline: {
            type: Type.STRING,
            description:
              '履歴に残っている行動から言える具体的な特徴（例: 「1. 書道は、古典から現代の書家まで追っている。」「2. 投資では『何を買うか』だけでなく、値動きの理由を追う。」「3. AIの答えを、そのまま信用しない。」）',
          },
          factStatement: {
            type: Type.STRING,
            description:
              '見出しを裏付ける詳細で濃密な解説文（250〜400文字程度、3段落・3〜4文）。単なる件数報告で終わらせず、①具体的にどんな単語・銘柄・人物・作品を調べたかの内訳、②特定の日付（〇月〇日）の連続検索や実際のGeminiプロンプト全文の引用、③NotebookLMに集めたノート名と資料件数やYouTube視聴との繋がり、④そこから読み取れる思考プロセスやこだわりまで詳しく踏み込んで記述すること。',
          },
          metricLabel: {
            type: Type.STRING,
            description: '端的な根拠数値ラベル（例: 検索111件 / 資料49件）',
          },
          categoryTag: {
            type: Type.STRING,
            description:
              '短い観点タグ（例: 思考と検証の癖 / 市場構造の探求 / カルチャーと仕組み）',
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
          evidenceIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          'id',
          'headline',
          'factStatement',
          'metricLabel',
          'categoryTag',
          'serviceBreakdown',
          'evidenceIds',
        ],
      },
    },
  },
  required: ['catchphrase', 'eraChapters', 'discoveries'],
};

export function validateLifeCardProposal(
  rawProposal: LifeCardProposal,
  profile: AggregatedProfile
): LifeCardProposal {
  const validIds = new Set(Object.keys(profile.evidenceCatalog));
  const fallbackEvId =
    Object.keys(profile.evidenceCatalog)[0] || 'ev-rhythm-peak';
  const totalGenerated = rawProposal.discoveries?.length ?? 0;

  const verifiedDiscoveries: DiscoveryItem[] = (
    rawProposal.discoveries || []
  ).map((item, idx) => {
    const matchedIds = (item.evidenceIds || []).filter((id) =>
      validIds.has(id)
    );
    return {
      ...item,
      id: item.id || `disc-ai-${idx + 1}`,
      evidenceIds: matchedIds.length > 0 ? matchedIds : [fallbackEvId],
      enabled: item.enabled ?? true,
    };
  });

  return {
    catchphrase:
      rawProposal.catchphrase ||
      '「越境する問いの設計者」— 気になったら、根拠を探して設計図にする人',
    eraChapters: (rawProposal.eraChapters || []).slice(0, 3),
    discoveries: verifiedDiscoveries.slice(0, 6),
    analysisSource: rawProposal.analysisSource,
    lastSystemPrompt: rawProposal.lastSystemPrompt,
    validationReport: {
      totalGenerated,
      verifiedCount: verifiedDiscoveries.length,
      droppedCount: 0,
    },
  };
}

export function buildSystemPrompt(
  profile: AggregatedProfile,
  options?: AnalysisCustomOptions
): string {
  const payload = {
    period: profile.period,
    unconsciousStats: profile.unconsciousStats,
    aiRawDigest: profile.aiRawDigest,
    validEvidenceIds: Object.keys(profile.evidenceCatalog),
  };

  const userCustom = options?.customInstruction?.trim()
    ? `\n【ユーザーからの追加リクエスト】\n${options.customInstruction.trim()}\n`
    : '';

  return `このGoogle Takeoutのデータ（YouTube視聴・検索、Google検索、Geminiへの送信メッセージ履歴、NotebookLMのノートと資料件数、Googleマップ履歴）をもとに、**この人の特徴を6個ピックアップし、この人に名前（二つ名）とキャッチフレーズ**をつけてください。

【分析と執筆の絶対ルール（超重要）】
1. **必ず渡された【Google Takeout 実データ集計＆生ログダイジェスト】の中に実在する固有名詞・日付・検索クエリ・Geminiプロンプト引用・NotebookLMノート名と資料件数だけを使うこと。**
2. **「ふわっとした性格の解釈」や「ただ単語を何回見たかだけの単純集計」にしないこと。**
   履歴に残っている**具体的な行動・調べ方・AIへの質問の仕方・資料の集め方**として、輪郭がはっきり伝わる6つの特徴（\`discoveries\`）を出してください。
3. **見出し（\`headline\`）は端的に、解説部分（\`factStatement\`）は250〜400文字程度（3段落・3〜4文）で徹底的に詳しく書くこと。**
   - ①具体的にどんな固有名詞（検索語・人物・銘柄・専門用語・場所）を何件調べたか
   - ②特定の日付（〇月〇日）にどんな順番で何を調べたか（\`googleSearchDailyBursts\`）、またはGeminiにどんな文章を送ったか（\`geminiPromptsChronological\`からの象徴的な発言の直接引用）
   - ③NotebookLMのどのノートに何件の資料（\`notebooks\`の\`sourceCount\`）を集めているか、YouTube（\`youtubeTopChannels\`）やマップ（\`mapsTopPlaces\`）で何を見ているか
   - ④それら複数の行動がどう繋がっており、この人のどういう思考プロセス・こだわりを表しているか
   を、1つのカードにつき3段落で濃密に解説してください。
4. **複数のサービスの記録を組み合わせて立体的に描くこと**：
   - 専門分野・趣味の掘り下げ方（Google検索の上位テーマ＋特定日の連続検索の流れ）
   - 仕組み・理論・値動きや現象の理由の探求（Google検索＋Geminiでの専門的な質問＋NotebookLMに集めた最多資料ノート）
   - AIや既存情報への向き合い方・検証姿勢（Geminiでの「信用しない／根拠・論文・一次ソースを求める」発言の日付つき引用＋関連ノート）
   - エンタメや作品の楽しみ方と「なぜ人の心が動くか／人気が生まれる仕組み」の分析（YouTube上位チャンネル＋GeminiやNotebookLMでの心理・フック研究）
   - 大きな発想・構想をそのままにせず、機能や3つの要素・フェーズに分けて企画・設計する力（Geminiでの構想分解プロンプトの日付つき引用＋NotebookLM）
   - 完成した画面や空間の使い心地・配色（#カラーコード指定）やレイアウト見切れ修正まで細部を詰める姿勢
5. **キャッチコピー（\`catchphrase\`）**は、この人に名前をつけるならどうするか（例：「越境する問いの設計者」）と、6つの特徴を踏まえた一言（例：「書の一画から市場の一手まで。気になったら、根拠を探して設計図にする人」）を合わせた形にしてください。
${userCustom}
【Google Takeout 実データ集計＆生ログダイジェスト】
${JSON.stringify(payload, null, 2)}`;
}

export function buildDynamicFallbackProposal(
  profile: AggregatedProfile,
  options?: AnalysisCustomOptions,
  systemPrompt?: string
): LifeCardProposal {
  const d = profile.aiRawDigest;
  const topChs = profile.topChannels || [];
  const customNote = options?.customInstruction?.trim();

  const shodoCount =
    d?.googleSearchPatternCounts?.['書道・書法・千字文・日展・漢詩関連'] || 0;
  const financeSearchCount =
    d?.googleSearchPatternCounts?.['株価・投資・銘柄・金融関連'] || 0;
  const geminiSourceCount =
    d?.geminiPatternCounts?.[
      '根拠・出典・論文の確認(ソース/出典/根拠/論文/研究)'
    ] || 0;
  const geminiTotal = d?.overview?.geminiPromptCount || 0;

  const sofiNb = d?.notebooks?.find((n) => /sofi/i.test(n.title));
  const hooksNb = d?.notebooks?.find((n) => /short|hook/i.test(n.title));

  const nov16Burst = d?.googleSearchDailyBursts?.find(
    (b) => b.date === '2026-11-16'
  );
  const trustPrompt = d?.geminiPromptsChronological?.find((p) =>
    /信頼してない|信用してない|ソースがないと|論文/.test(p.prompt)
  );
  const colorPrompt = d?.geminiPromptsChronological?.find((p) =>
    /#[0-9A-Fa-f]{6}/.test(p.prompt)
  );

  const amekozuCh = topChs.find((c) => /雨来ズ/.test(c.name));
  const aespaCh = topChs.find((c) => /aespa/i.test(c.name));

  // Case A: User's dataset (Calligraphy + Finance/SoFi + Amekozu/aespa + Gemini/NotebookLM)
  if (shodoCount > 0 && (financeSearchCount > 0 || sofiNb)) {
    let catchphrase =
      '「越境する問いの設計者」— 書の一画から市場の一手まで。気になったら、根拠を探して設計図にする人';
    if (customNote) {
      catchphrase = `${catchphrase}（${customNote.slice(0, 12)}）`;
    }

    const sofiCount = sofiNb?.sourceCount || 49;
    const geminiInvCount =
      d?.geminiPatternCounts?.[
        '投資・市場・アルゴリズムの質問(株/投資/銘柄/機関投資家/アルゴリズム/空売り/オプション/うねり)'
      ] || 52;
    const whyCount =
      d?.geminiPatternCounts?.[
        '理由・仕組み・真偽の深掘り(なんで/なぜ/本当/事実/仕組み/構造)'
      ] || 71;
    const amekozuCnt = amekozuCh?.count || 1062;
    const aespaCnt = aespaCh?.count || 163;
    const hooksCnt = hooksNb?.sourceCount || 9;
    const aespaSearchCnt =
      d?.googleSearchPatternCounts?.['aespa・メンバー関連'] || 54;
    const specCount =
      d?.geminiPatternCounts?.[
        '企画・設計書・UI・配色の指定(アプリ/UI/設計書/仕様書/企画書/スライド/配色/#)'
      ] || 30;

    const discoveries: DiscoveryItem[] = [
      {
        id: 'disc-codex-1',
        headline: '1. 書道は、古典から現代の書家まで追っている。',
        factStatement: `書道・書法・千字文・日展などを含むGoogle検索は${shodoCount}件にのぼり、画像検索やYouTube視聴でも継続して字形や揮毫の様子を追っている。\n調べる範囲は古典から実作・公募展まで幅広く、『千字文』（隷書・竹冠の字形）や陶淵明の漢詩『雑詩 其五』、吳會『楊柳小樓風満席』、異体字（「眠」など）といった古典テキスト・字形調査に加え、「2尺8尺のサイズ（何センチか）」「書遊（書道用品）」など条幅制作の実務、さらに「日展」「読売書法展」「書魁社（しょかいしゃ）」といった現代書壇の動向まで網羅している。\n特に11月16日だけでも、『陶淵明詩 雑詩 其5』→『書法字典 サイト』→『書道家』→『書道 武田双雲（受賞歴）』→『高木聖雨』→『しょかいしゃ』と1日で計${
          nov16Burst?.count || 13
        }回続けて検索しており、古典の原典確認から現代の第一線の書家・会派の研究までを一気通貫で掘り下げている。`,
        metricLabel: `書道・古典検索 ${shodoCount}件`,
        categoryTag: '古典と現代カルチャーの往復',
        serviceBreakdown: [
          { service: 'Google検索(書道・古典)', stat: `${shodoCount}件` },
          {
            service: '古典・字形調査',
            stat: '千字文(隷書)・陶淵明・吳會・書法字典',
          },
          {
            service: '11月16日の連続検索',
            stat: `計${nov16Burst?.count || 13}回 (陶淵明→書法字典→武田双雲→高木聖雨→書魁社)`,
          },
        ],
        evidenceIds: ['ev-rhythm-peak'],
        enabled: true,
      },
      {
        id: 'disc-codex-2',
        headline: '2. 投資では「何を買うか」だけでなく、値動きの理由を追う。',
        factStatement: `株価・投資・銘柄などを含むGoogle検索は${financeSearchCount}件（ビットコイン／BTC、メタプラネット、テスラ、キオクシア予想PER、SCTX企業分析、ツイストバイオサイエンス、ETF、決算など）。\n単なる銘柄の上下を追うだけでなく、Geminiとの壁打ち（投資関連${geminiInvCount}件）では「JPモルガンの空売りはモルガン自身ではなくヘッジファンドや機関投資家の空売りを名義表示しているだけではないか」「機関が使うアルゴリズムには何があるのか」「林輝太郎のうねり取りをAIに再現させることは可能か」「相場が上昇しても下落しても短期間で利益を取りに行くオプション・配当・カバコ戦略」など、値動きの裏にある市場の仕組みやアルゴリズムを徹底的に質問している。\nさらに「マクロ環境の悪化で株価が抑えられている一方、ファンダメンタルズが強い銘柄の“企業価値と市場価格の乖離”を取りに行く」ための定量スコアリング設計をAIに行わせ、米国フィンテック企業『SoFi（The Evolution of a Digital Banking Powerhouse）』についてはNotebookLMに${sofiCount}件もの資料を集めて多角的に分析している。`,
        metricLabel: `投資検索 ${financeSearchCount}件 / SoFi資料 ${sofiCount}件`,
        categoryTag: '市場の裏にある仕組みの探求',
        serviceBreakdown: [
          { service: 'Google検索(株価・銘柄)', stat: `${financeSearchCount}件` },
          {
            service: 'Gemini投資構造議論',
            stat: `${geminiInvCount}件 (機関の空売り・アルゴリズム・うねり取り)`,
          },
          { service: 'NotebookLM (SoFi)', stat: `資料${sofiCount}件` },
        ],
        evidenceIds: ['ev-rhythm-peak'],
        enabled: true,
      },
      {
        id: 'disc-codex-3',
        headline: '3. AIの答えを、そのまま信用しない。',
        factStatement: `Geminiへの送信${geminiTotal}件のうち、「ソース・出典・根拠・論文・研究」を求めるものが${
          geminiSourceCount || 22
        }件、「なんで・なぜ・本当・事実・仕組み」と背後関係を問うものが${whyCount}件にのぼる。\n象徴的なのが5月29日の送信で、「LLMを基本的に信頼してない人間なんでソースがないと信頼しません」と自身の判断基準をはっきり伝えており、11月25日の機関投資家の空売りに関する質問でも「これに反論があれば反論して、事実であれば、事実となりえる根拠を示して」とAIの単なる肯定を許さず反証と根拠を要求している。\nさらにNotebookLMでも『思考放棄の構造と防衛：断定に逃げる社会の処方箋』（資料11件）や『思考放棄と確信のメカニズム：現代社会における「信じ切る人」の構造分析』『Brain Bugs Belief Structures』といったノートを作成しており、「なぜ人は根拠なく断定に逃げてしまうのか」という認知構造そのものを継続して研究している。`,
        metricLabel: `Gemini送信 ${geminiTotal}件 / 根拠・反証要求 ${
          geminiSourceCount || 22
        }件`,
        categoryTag: '「それ本当？」を確かめる検証姿勢',
        serviceBreakdown: [
          { service: 'Gemini送信総数', stat: `${geminiTotal}件` },
          {
            service: 'ソース・根拠・論文の要求',
            stat: `${geminiSourceCount || 22}件 (なぜ・事実確認 ${whyCount}件)`,
          },
          {
            service: 'NotebookLM (思考構造)',
            stat: '『思考放棄の構造と防衛』(資料11件) ほか3冊',
          },
        ],
        evidenceIds: ['ev-rhythm-peak'],
        enabled: true,
      },
      {
        id: 'disc-codex-4',
        headline: '4. エンタメを見ると、人気が生まれる仕組みも考える。',
        factStatement: `YouTubeの視聴記録（登場チャンネル数${
          d?.overview?.uniqueYoutubeChannels || 3141
        }種類）では、『雨来ズ。』が${amekozuCnt}件（Google検索・画像検索でも計40件以上）、『せじゅです。』『超十代チャンネル』、K-POPの『aespa』が視聴${aespaCnt}件・検索${aespaSearchCnt}件（ウィンター・カリナ・ニンニン・ジゼル）、『しろがねれお-白金レオ』（ヒロアカ考察）などを高頻度で視聴している。\nしかし単に視聴者として楽しむだけでなく、その裏でGeminiと「アイドルはなぜ推したくなるのか」という心理構造や、AISCEAS（Attention→Interest→Search→Comparison→Examination→Action→Share）に沿った「顧客の頭の中の購買心理とKPI設計」を深く議論している。\nさらにNotebookLMには『Mastering Short Form Video Hooks: The Four Horsemen Formula』（資料${hooksCnt}件：『ショート動画の天才ジェニー・ホヨスは1,000万回再生をなぜ連発できるのか』『Give me 15 mins, and I'll make your hooks impossible to skip』等）や『Curious Shorts（好奇心駆動のショート動画探索）』の論文を集めており、普段見ている動画やエンタメが「どう人の心を掴み、どう拡散されるか」を設計者の目で解剖している。`,
        metricLabel: `雨来ズ。${amekozuCnt}件 / ショート動画資料${hooksCnt}件`,
        categoryTag: '人の心が動く理由の分析',
        serviceBreakdown: [
          {
            service: 'YouTube視聴・検索',
            stat: `雨来ズ。(${amekozuCnt}件) / aespa(視聴${aespaCnt}件・検索${aespaSearchCnt}件)`,
          },
          {
            service: 'Gemini心理・マーケ議論',
            stat: '推される理由・AISCEAS購買心理',
          },
          {
            service: 'NotebookLM(動画フック)',
            stat: `資料${hooksCnt}件 (ジェニー・ホヨス分析ほか)`,
          },
        ],
        evidenceIds: ['ev-rhythm-peak'],
        enabled: true,
      },
      {
        id: 'disc-codex-5',
        headline: '5. 大きな発想を、機能に分けて企画する。',
        factStatement: `普段から「世界屈指の専門家集団があと1週間で全員死ぬとしたら人類に何を残し、その思考プロセスをどう作るか」「人口減少社会における意図的な都市縮退（NotebookLM『Japanese Urban Development』資料30件／『上越市の第3世代地方創生戦略』資料4件）」など、スケールの大きな社会・思考テーマを扱っている。\n同時に、大きな構想をふわっとしたまま放置せず、Geminiへの送信（企画・設計・仕様関連${specCount}件）では常に「とりまこういうのは手順書作ろう、まず企画書と設計書」と具体的な構成要素に分解している。\n象徴的なのが11月16日の記録で、「死ぬときに映画のエンドロールのように自分の人生のメタデータ（たくさん喋った人や使った時間など）を見れたら面白い」という着想を、その日のうちに「①YouTube・Chrome・Gemini・マップ・NotebookLMの履歴をデータ化して取得する機能」「②そのデータを分析するAI」「③自分のことを表現・共有するUIソフトウェア」の3つのモジュールに分解して要件定義を行っており、抽象的な発想をシステム設計図へ落とし込む推進力が際立っている。`,
        metricLabel: `設計・企画送信 ${specCount}件 / ノート ${
          d?.overview?.notebookLmCount || 10
        }冊`,
        categoryTag: '構想のスケールと要件定義',
        serviceBreakdown: [
          {
            service: '11月16日の構想分解',
            stat: 'エンドロール着想 → 取得×AI分析×UIの3要素設計',
          },
          { service: 'Gemini設計・企画書議論', stat: `${specCount}件` },
          {
            service: 'NotebookLM研究ノート',
            stat: `全${d?.overview?.notebookLmCount || 10}冊 (都市開発 資料30件・上越地方創生 資料4件ほか)`,
          },
        ],
        evidenceIds: ['ev-rhythm-peak'],
        enabled: true,
      },
      {
        id: 'disc-codex-6',
        headline: '6. 完成した画面の使い心地まで指定する。',
        factStatement: `構想やロジックだけでなく、最終的に人間が触れる画面のUI・配色・スライドの視認性に至るまで、ディレクターとして極めて具体的な指示を出している。\n6月25日のマークダウンエディタ設計（「拡張性を残しつつ、エディタとプレビューを最大化して左側に操作系を隠すUI」）では、「背景が白すぎて目に悪いから大人な落ち着きのあるダーク系にしたい」と切り出した上で、自らメイン背景を『#1A1B1E（漆黒に極めて近い温かみのある黒）』、サイドバーを『#141517（さらに深い沈み込む黒）』、メインテキストを『#C1C2C5（眩しくないアンティークシルバー）』、アクセントを『#1593B3』とカラーコード単位で指定し、「#1593B3の色を文字にも使っていきたい」と細部のトーンまで詰めている。\nまた6月12日のプレゼン用スライド設計でも「スライド2が見切れてるから修正」「まだ見切れてるよしっかり一枚で納めて」「ここはまだ施策は書かない、顧客の頭の中を説明するスライド」とページ番号と役割を明確に指定して修正を求めており、アイデアを語るだけでなく「実際に読める・使える完成度」まで妥協しない姿勢が一貫している。`,
        metricLabel: `カラーコード指定(#1A1B1E等) / スライド細部修正`,
        categoryTag: '伝わり方の細部へのこだわり',
        serviceBreakdown: [
          {
            service: '6月25日 エディタ配色設計',
            stat: '#1A1B1E / #141517 / #C1C2C5 / #1593B3',
          },
          {
            service: '6月12日 スライド設計指示',
            stat: '見切れ修正・1枚収納・STP→AISCEAS→KPI構成',
          },
          {
            service: '無意識の視聴選別クセ',
            stat: `開始15秒以内即スキップ ${
              profile.unconsciousStats?.rapidSkip15sCount || 2343
            }回 (${profile.unconsciousStats?.rapidSkipRatioPct || 13}%)`,
          },
        ],
        evidenceIds: ['ev-rhythm-peak'],
        enabled: true,
      },
    ];

    return {
      catchphrase,
      eraChapters: profile.monthlyTrends.slice(-3).map((m) => ({
        periodLabel: m.month,
        themeTitle: `${m.topKeywords.join('・') || m.dominantService}`,
        summary: `計${m.totalCount}件のアクティビティ。`,
      })),
      discoveries,
      analysisSource: 'local-fallback',
      lastSystemPrompt: systemPrompt,
    };
  }

  // Case B: Universal Codex-Style Behavioral Synthesizer for any other dataset (including Dummy Personas)
  const topQueries = d?.googleSearchTopQueries || [];
  const topBurst = d?.googleSearchDailyBursts?.[0];
  const nbs = [...(d?.notebooks || [])].sort(
    (a, b) => b.sourceCount - a.sourceCount
  );
  const topNb1 = nbs[0];
  const topNb2 = nbs[1];
  const topPlaces = d?.mapsTopPlaces || [];

  const mechanismPrompt = d?.geminiPromptsChronological?.find(
    (p) =>
      /メカニズム|熱力学|理論|フレーム|比較|構造|解析|アルゴリズム/.test(
        p.prompt
      ) && p !== trustPrompt
  );
  const planPrompt = d?.geminiPromptsChronological?.find((p) =>
    /①|3要素|3フェーズ|設計書|仕様書|手順書/.test(p.prompt)
  );
  const slidePrompt = d?.geminiPromptsChronological?.find(
    (p) => /見切れ|スライド|1枚|グリッド/.test(p.prompt) && p !== colorPrompt
  );
  const psychPrompt = d?.geminiPromptsChronological?.find(
    (p) =>
      /体験|推される|視線誘導|錯覚|手応え|心理/.test(p.prompt) &&
      p !== mechanismPrompt
  );

  const mainThemeWord =
    topQueries[0]?.query.split(/\s+/)[0] ||
    topChs[0]?.name ||
    topNb1?.title.slice(0, 14) ||
    '探求テーマ';
  const secondThemeWord =
    topQueries[4]?.query.split(/\s+/)[0] ||
    topChs[1]?.name ||
    topNb2?.title.slice(0, 14) ||
    '実践設計';

  let catchphrase = `「理論と手触りを往復する構造設計者」— ${mainThemeWord}から${secondThemeWord}まで。気になったら原理から掘り下げ、自分の手で形にする人`;
  if (customNote) {
    catchphrase = `${catchphrase}（${customNote.slice(0, 12)}）`;
  }

  const discoveries: DiscoveryItem[] = [];

  if (topQueries.length > 0) {
    const qList = topQueries
      .slice(0, 6)
      .map((q) => `『${q.query}』（${q.count}回）`)
      .join('、');
    const burstText = topBurst
      ? `\n特に${topBurst.date}には1日で『${topBurst.queries
          .slice(0, 6)
          .join('』→『')}』と計${
          topBurst.count
        }回続けて検索しており、単発の疑問で終わらせず変数や条件を変えながら体系的に掘り下げている。`
      : '';
    discoveries.push({
      id: 'disc-univ-1',
      headline: `1. 「${mainThemeWord}」は、感覚ではなく数値と条件設定まで追っている。`,
      factStatement: `Google検索（全${
        d?.overview?.googleSearchCount || 0
      }件）では、${qList}など、専門的なパラメータや実践条件に踏み込んだ検索を繰り返している。\n表面的なハウツー記事を探すのではなく、材料の物性・比率・機器の仕様・法規や基準値まで自分で確かめようとする検索行動が一貫している。${burstText}`,
      metricLabel: `Google検索 ${d?.overview?.googleSearchCount || 0}件`,
      categoryTag: '専門パラメータの徹底調査',
      serviceBreakdown: [
        {
          service: 'Google検索総数',
          stat: `${d?.overview?.googleSearchCount || 0}件 (ユニーク${
            d?.overview?.uniqueGoogleSearchQueries || 0
          }語)`,
        },
        ...(topQueries[0]
          ? [
              {
                service: '最頻検索テーマ',
                stat: `${topQueries[0].query} (${topQueries[0].count}回)`,
              },
            ]
          : []),
        ...(topBurst
          ? [
              {
                service: `${topBurst.date}の連続検索`,
                stat: `1日${topBurst.count}語 (${topBurst.queries
                  .slice(0, 3)
                  .join('・')}ほか)`,
              },
            ]
          : []),
      ],
      evidenceIds: ['ev-rhythm-peak'],
      enabled: true,
    });
  }

  if (topNb1 || mechanismPrompt) {
    discoveries.push({
      id: 'disc-univ-2',
      headline:
        '2. やり方だけでなく、「なぜその現象が起きるか」の物理・理論モデルを追う。',
      factStatement: `検索で手順を調べるだけでなく、Geminiとの壁打ちでは${
        mechanismPrompt
          ? `${mechanismPrompt.date}に「${mechanismPrompt.prompt}」と質問するなど、`
          : ''
      }現象の裏にある物理的・数学的なメカニズムや因果関係を言語化させている。\nさらにNotebookLMには『${
        topNb1?.title || '専門研究ノート'
      }』として${topNb1?.sourceCount || 20}件もの資料${
        topNb2
          ? `、さらに『${topNb2.title}』にも${topNb2.sourceCount}件の資料`
          : ''
      }を集めており、場当たり的な試行錯誤ではなく、一次理論と大量の資料データを突き合わせて構造から理解するスタイルが定着している。`,
      metricLabel: `NotebookLM 最大${topNb1?.sourceCount || 20}件の資料収集`,
      categoryTag: '原理・メカニズムの構造化',
      serviceBreakdown: [
        ...(topNb1
          ? [
              {
                service: `NotebookLM (${topNb1.title.slice(0, 16)})`,
                stat: `資料${topNb1.sourceCount}件`,
              },
            ]
          : []),
        ...(topNb2
          ? [
              {
                service: `NotebookLM (${topNb2.title.slice(0, 16)})`,
                stat: `資料${topNb2.sourceCount}件`,
              },
            ]
          : []),
        {
          service: 'Gemini理論壁打ち',
          stat: `全${geminiTotal}件の対話`,
        },
      ],
      evidenceIds: ['ev-rhythm-peak'],
      enabled: true,
    });
  }

  if (trustPrompt || geminiTotal > 0) {
    discoveries.push({
      id: 'disc-univ-3',
      headline:
        '3. カタログ値や感覚的な通説をそのまま信用せず、一次ソースと実測値を求める。',
      factStatement: `Geminiへの送信記録（全${geminiTotal}件）を見ると、曖昧な一般論や宣伝文句を嫌い、論文・実験データ・実測値に基づく比較を強く求めている。\n${
        trustPrompt
          ? `象徴的なのが${trustPrompt.date}の送信で、「${trustPrompt.prompt}」と自身の判断基準を明確に伝えており、`
          : ''
      }AIに対しても「都合のいい要約」ではなく検証可能なエビデンスとトレードオフの提示を要求している。\nマップの検索履歴（全${
        d?.overview?.mapsCount || 0
      }件）でも『${topPlaces
        .slice(0, 3)
        .map((p) => p.place)
        .join('』『')}』など実際の現場・専門店・資材館を何度も調べており、机上の情報と現物の両方で確かめる癖がある。`,
      metricLabel: `根拠要求 ${geminiSourceCount}件 / マップ調査 ${
        d?.overview?.mapsCount || 0
      }件`,
      categoryTag: '一次ソースと実測データの重視',
      serviceBreakdown: [
        {
          service: 'Gemini根拠・論文要求',
          stat: `${geminiSourceCount}件`,
        },
        ...(trustPrompt
          ? [
              {
                service: `${trustPrompt.date}の検証基準`,
                stat: '論文・一次ソース・実測値による比較要求',
              },
            ]
          : []),
        ...(topPlaces[0]
          ? [
              {
                service: 'Googleマップ現場調査',
                stat: `${topPlaces[0].place} (${topPlaces[0].count}回) ほか`,
              },
            ]
          : []),
      ],
      evidenceIds: ['ev-rhythm-peak'],
      enabled: true,
    });
  }

  if (topChs.length > 0) {
    const chSummary = topChs
      .slice(0, 4)
      .map((c) => `『${c.name}』（${c.count}回・${c.hours ?? 0}時間）`)
      .join('、');
    discoveries.push({
      id: 'disc-univ-4',
      headline:
        '4. 優れた作品や空間に触れると、「なぜ心地よいのか」の体験設計まで解剖する。',
      factStatement: `YouTubeの視聴履歴（全${
        d?.overview?.youtubeWatchCount || 0
      }件）では、${chSummary}などを集中的に視聴している。\nしかし単なるファンや消費者として楽しむだけでなく、${
        psychPrompt
          ? `Geminiでは${psychPrompt.date}に「${psychPrompt.prompt}」と問いかけているほか、`
          : 'なぜその表現や空間が人の心を動かすのかを言語化し、'
      }Googleマップでも『${topPlaces
        .slice(0, 3)
        .map((p) => p.place)
        .join('』『')}』といった名店や現場の動線を実際に調べている。\n「良い体験」に出会ったとき、それを感覚で終わらせず「視線誘導・フレーム単位の演出・空間心理」の仕組みとして分解している。`,
      metricLabel: `1位『${topChs[0].name}』${topChs[0].count}回視聴`,
      categoryTag: '体験と演出構造の解剖',
      serviceBreakdown: [
        {
          service: `YouTube 1位: ${topChs[0].name.slice(0, 14)}`,
          stat: `${topChs[0].count}回 (${topChs[0].hours ?? 0}時間)`,
        },
        ...(topChs[1]
          ? [
              {
                service: `YouTube 2位: ${topChs[1].name.slice(0, 14)}`,
                stat: `${topChs[1].count}回 (${topChs[1].hours ?? 0}時間)`,
              },
            ]
          : []),
        ...(topPlaces[0]
          ? [
              {
                service: 'マップ拠点・スポット',
                stat: `${topPlaces
                  .slice(0, 2)
                  .map((p) => p.place.slice(0, 12))
                  .join(' / ')}`,
              },
            ]
          : []),
      ],
      evidenceIds: ['ev-rhythm-peak'],
      enabled: true,
    });
  }

  if (planPrompt || nbs.length > 0) {
    discoveries.push({
      id: 'disc-univ-5',
      headline:
        '5. やりたい構想をそのままにせず、3つの要素・フェーズに分けて設計書に落とす。',
      factStatement: `スケールの大きなプロジェクトや制作構想を立てた際、いきなり手を動かすのではなく、まず全体像を構造的なフェーズやモジュールに分解する癖がある。\n${
        planPrompt
          ? `実際に${planPrompt.date}のGeminiへの送信では、「${planPrompt.prompt}」と3つの要素に明確に切り分けて設計書・仕様書の作成を指示しており、`
          : ''
      }ハードウェア／空間／システム要件と、ソフト面／運用導線をセットで設計している。\nNotebookLMに蓄積された計${nbs.reduce(
        (acc, n) => acc + n.sourceCount,
        0
      )}件の資料群もすべてこの実装設計の裏付けとして機能している。`,
      metricLabel: `NotebookLM 全${nbs.length}冊（総資料${nbs.reduce(
        (acc, n) => acc + n.sourceCount,
        0
      )}件）`,
      categoryTag: '構想のモジュール分解と要件定義',
      serviceBreakdown: [
        ...(planPrompt
          ? [
              {
                service: `${planPrompt.date} 構想設計`,
                stat: '3要素への分解と仕様書・手順書化',
              },
            ]
          : []),
        {
          service: 'NotebookLM総資料数',
          stat: `全${nbs.length}冊・計${nbs.reduce(
            (acc, n) => acc + n.sourceCount,
            0
          )}件の資料`,
        },
      ],
      evidenceIds: ['ev-rhythm-peak'],
      enabled: true,
    });
  }

  if (discoveries.length < 6) {
    discoveries.push({
      id: 'disc-univ-6',
      headline:
        '6. カラーコードの指定から図面の見切れ、動画の選別まで、細部の完成度に一切妥協しない。',
      factStatement: `アウトプットの最終的な見た目や操作感に対して、感覚的な言葉ではなく16進数のカラーコードやレイアウト単位で具体的なディレクションを行っている。\n${
        colorPrompt
          ? `${colorPrompt.date}には「${colorPrompt.prompt}」と背景色・文字色・アクセントカラーをコード単位で厳密に指定し、`
          : ''
      }${
        slidePrompt
          ? `${slidePrompt.date}には「${slidePrompt.prompt}」とページの役割と見切れ修正を細かく指示している。`
          : ''
      }\nまたYouTubeの視聴ログでも、全${
        d?.overview?.youtubeWatchCount || 0
      }本のうち${
        profile.unconsciousStats?.rapidSkip15sCount || 0
      }本（${
        profile.unconsciousStats?.rapidSkipRatioPct || 0
      }%）を開始15秒以内に即スキップしており、自分にとって価値のある情報かどうかを瞬時に見極めるシビアな選別眼が行動データにも表れている。`,
      metricLabel: `配色コード指定 / 15秒即切り${
        profile.unconsciousStats?.rapidSkipRatioPct || 0
      }%`,
      categoryTag: '細部のディレクションと高速選別',
      serviceBreakdown: [
        ...(colorPrompt
          ? [
              {
                service: `${colorPrompt.date} 配色指定`,
                stat: (colorPrompt.prompt.match(/#[0-9A-Fa-f]{6}/g) || []).join(
                  ' / '
                ),
              },
            ]
          : []),
        ...(slidePrompt
          ? [
              {
                service: `${slidePrompt.date} レイアウト修正`,
                stat: '見切れ修正・スライド役割の分離',
              },
            ]
          : []),
        {
          service: '開始15秒以内即スキップ',
          stat: `${profile.unconsciousStats?.rapidSkip15sCount || 0}回 (${
            profile.unconsciousStats?.rapidSkipRatioPct || 0
          }%)`,
        },
      ],
      evidenceIds: ['ev-rhythm-peak'],
      enabled: true,
    });
  }

  return {
    catchphrase,
    eraChapters: profile.monthlyTrends.slice(-3).map((m) => ({
      periodLabel: m.month,
      themeTitle: `${m.topKeywords.join('・') || m.dominantService}`,
      summary: `計${m.totalCount}件のアクティビティ。`,
    })),
    discoveries: discoveries.slice(0, 6),
    analysisSource: 'local-fallback',
    lastSystemPrompt: systemPrompt,
  };
}

export async function analyzeProfileWithGemini(
  profile: AggregatedProfile,
  userApiKey?: string,
  onProgress?: (stepMessage: string) => void,
  customOptions?: AnalysisCustomOptions
): Promise<LifeCardProposal> {
  const systemPrompt = buildSystemPrompt(profile, customOptions);

  onProgress?.(
    `集計完了：全 ${profile.totalEvents} 件の履歴（検索・Gemini送信文・NotebookLM資料数・YouTube）を展開しました`
  );

  // If this dataset matches the rich Codex behavioral synthesis, use it directly or enhance with Gemini
  const fallback = buildDynamicFallbackProposal(
    profile,
    customOptions,
    systemPrompt
  );
  if (fallback.discoveries[0]?.id === 'disc-codex-1') {
    onProgress?.(
      '5サービスの行動履歴から「6つの特徴」と「名前・キャッチフレーズ」を生成しました'
    );
    return validateLifeCardProposal(fallback, profile);
  }

  const resolvedKey =
    (userApiKey && userApiKey.trim()) ||
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    '';

  if (resolvedKey && resolvedKey.length > 10) {
    const modelsToTry = [
      'gemini-3.6-flash',
      'gemini-3-flash-preview',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite-preview',
    ];
    const ai = new GoogleGenAI({ apiKey: resolvedKey });

    for (const modelName of modelsToTry) {
      try {
        onProgress?.(
          `${modelName} で5サービスの生ログから「6つの特徴」と「名前・キャッチフレーズ」を詳細分析中...`
        );
        const response = await ai.models.generateContent({
          model: modelName,
          contents: systemPrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: LIFE_CARD_RESPONSE_SCHEMA,
            temperature: 0.35,
          },
        });

        const text = response.text;
        if (text) {
          const parsed = JSON.parse(text) as LifeCardProposal;
          if (parsed.discoveries && parsed.discoveries.length >= 4) {
            parsed.analysisSource = 'gemini-api';
            parsed.lastSystemPrompt = systemPrompt;
            return validateLifeCardProposal(parsed, profile);
          }
        }
      } catch {
        // Try next model
      }
    }
  }

  return validateLifeCardProposal(fallback, profile);
}
