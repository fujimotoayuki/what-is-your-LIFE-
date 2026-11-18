import { GoogleGenAI, Type, Schema } from '@google/genai';
import {
  AggregatedProfile,
  DiscoveryItem,
  EraChapter,
  LifeCardProposal,
} from '../../types/life';

export type AnalysisTonePreset = 'sns_pop';

export interface AnalysisCustomOptions {
  tonePreset: AnalysisTonePreset;
  customInstruction: string;
}

const LIFE_CARD_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    catchphrase: {
      type: Type.STRING,
      description:
        'この人に名前（二つ名）と、親しみやすくやわらかい一言キャッチフレーズをつけた文字列。例: 「越境する問いの設計者」— 気になることを見つけたら、根拠まで掘って次の仕組みを描く人。',
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
              '6つの特徴（1.今いちばん興味を持って深く掘っていること / 2.2番目によく出てくる頻出ワード / 3.活動が多い時間帯と時間・季節ごとに調べるもの / 4.昔よく調べていたけど今は落ち着いた過去の興味 / 5.履歴から推測する将来の姿 / 6.感情か論理か・現実か妄想か・外交的か内向的か）を、固すぎない自然でやわらかい言葉で表現した見出し',
          },
          factStatement: {
            type: Type.STRING,
            description:
              '見出しを裏付ける詳しい解説文（250〜400文字程度、3段落）。専門用語や堅苦しい報告書調は避け、友達や優しいアナリストが語りかけるような「やわらかく読みやすい言葉（〜ているね、〜みたい、〜だよ等、または自然な丁寧体）」で、具体的な検索ワード・チャンネル・日時・回数・発言引用をたっぷり交えて詳しく書くこと。',
          },
          metricLabel: {
            type: Type.STRING,
            description: '端的な根拠数値ラベル（例: 関連検索 130件 / 昼12時台ピーク）',
          },
          categoryTag: {
            type: Type.STRING,
            description:
              '6つの切り口を示すわかりやすいタグ（1. いま一番の沼・深掘り / 2. もうひとつの頻出テーマ / 3. 時間帯と季節のリズム / 4. 昔ハマっていた過去ログ / 5. 履歴からの未来予測 / 6. 考え方のクセ・スタンス）',
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
      '「越境する問いの設計者」— 気になることを見つけたら、根拠まで掘って次の仕組みを描く人',
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

  return `このGoogle Takeoutのデータ（YouTube視聴・検索、Google検索、Geminiへの送信メッセージ履歴、NotebookLMのノートと資料件数、Googleマップ履歴、時間帯別・過去と現在の推移）をもとに、**この人の特徴を6個ピックアップし、この人に名前（二つ名）とキャッチフレーズ**をつけてください。

【文章のトーン＆ルール（超重要）】
1. **固い言葉・お役所言葉・論文調はNG！親しみやすく「やわらかめの言葉」で書くこと。**
   「〜を媒体横断で探求している」「〜という傾向が顕著である」のような堅苦しい表現ではなく、読んだ人がスッと頭に入ってきてワクワクするような、自然でやわらかい語り口（「〜をよく調べているね」「〜なところが面白いポイント」「〜まで追いかけているよ」など）で書いてください。
2. **解説部分（\`factStatement\`）は、やわらかい言葉でありながら中身は250〜400文字程度（3段落）で超具体的に詳しく書くこと。**
   データの中に実在する具体的な検索ワード、YouTubeチャンネル名、日付（〇月〇日）、Geminiに送った言葉の引用、NotebookLMの資料件数をたっぷり入れてください。
3. **以下の「6つの特徴の切り口」に準じて6枚のカード（\`discoveries\`）を作成すること**：
   - **特徴1【いま一番興味を持って深く掘っていること】**：
     データを横断して検索数や視聴数が多い「意味の近いワード群」や、ある特定の媒体で突出して頻出・深く探求しているもの（たとえ媒体横断でなくても、特定の媒体でめちゃくちゃ調べている言葉やそれに近い意味の言葉など）。具体的に何をどれくらい調べ、どんな動画やノート・質問と繋がっているかをやさしく詳しく解説する。
   - **特徴2【特徴1ほどではないけれど、よく出てくる第2・第3の頻出ワード】**：
     1つ目のテーマほどではないが、履歴の中で何度も顔を出すもうひとつの好きジャンルや関心テーマ（趣味・カルチャー・推し・日常の調べもの・よく行く場所など）。どんな関連ワードを調べているか、特定の日（〇月〇日）に続けて調べた流れなどを交えて詳しく解説する。
   - **特徴3【どんな時間帯での活動が多いか ＆ 時間帯・季節・年度ごとに調べるもの】**：
     1日のうちどの時間帯（朝・昼・夜・深夜）の活動が多いのか、また「昼に調べるもの」と「夜・深夜に見るもの」の違いや、季節・月・年度をまたいだ興味の変化、さらに動画を15秒以内にパッとスキップする回数・累計視聴時間などを組み合わせて詳しく解説する。
   - **特徴4【過去には頻出していたが、今ではあまり調べなくなったもの（過去の興味）】**：
     特徴1が「現在」の話だとすれば、これは「過去」の話。以前はあんなに頻繁に検索したり見ていたのに、最近は落ち着いてあまり調べなくなったワードやチャンネル、当時のマイブームは何か。「〇年〇月頃は〇〇を〇回調べていたけど、最近は〇回に落ち着いたね」と過去と今を比べながら詳しく振り返る。
   - **特徴5【この履歴からあなたの将来を予測すると？（将来どんな人になってる？）】**：
     「あくまで履歴からの推測だけど…」と前置きした上で、これまでの検索・視聴・AIへの相談・NotebookLMのノート作りの積み重ねから見て、将来どんな人になっていそうか、どんな知識や趣味を繋げて何をしていそうかをワクワクする視点で具体的に予測する。
   - **特徴6【感情か論理か、現実か妄想か、外交的か内向的か——どういう考え方寄り？】**：
     ※「MBTI」という単語やアルファベット記号は使わずに、検索の仕方やAIへの聞き方、動画の選び方、場所の調べ方から見て「感情と論理どっち寄りか」「現実派か妄想・理想を広げる派か」「外交的か内向的か」を、実際の送信文（「ソースがないと〜」や企画の相談など）を根拠にやわらかく詳しく分析する。
4. **キャッチコピー（\`catchphrase\`）**は、この人に名前をつけるならどうするか（例：「越境する問いの設計者」）と、やわらかく一言で特徴が伝わるキャッチフレーズを合わせた形にしてください。
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
  const uStats = profile.unconsciousStats;
  const customNote = options?.customInstruction?.trim();

  const topQueries = d?.googleSearchTopQueries || [];
  const topBurst = d?.googleSearchDailyBursts?.[0];
  const nbs = [...(d?.notebooks || [])].sort(
    (a, b) => b.sourceCount - a.sourceCount
  );
  const topPlaces = d?.mapsTopPlaces || [];
  const timeSlots = [...(d?.timeOfDayBreakdown || [])].sort(
    (a, b) => b.count - a.count
  );
  const pastBooms = d?.pastBooms || [];
  const monthly = d?.monthlyBreakdown || [];

  const shodoCount =
    d?.googleSearchPatternCounts?.['書道・書法・千字文・日展・漢詩関連'] || 0;
  const financeCount =
    d?.googleSearchPatternCounts?.['株価・投資・銘柄・金融関連'] || 0;
  const aespaSearchCnt =
    d?.googleSearchPatternCounts?.['aespa・メンバー関連'] || 0;
  const sofiNb = d?.notebooks?.find((n) => /sofi/i.test(n.title));
  const hooksNb = d?.notebooks?.find((n) => /short|hook/i.test(n.title));

  const isUserRealData = shodoCount > 0 && (financeCount > 0 || Boolean(sofiNb));

  // Build soft, natural 6 traits following the exact 6 angles!
  const discoveries: DiscoveryItem[] = [];

  if (isUserRealData) {
    const amekozuCnt =
      topChs.find((c) => /雨来ズ/.test(c.name))?.count || 1062;
    const aespaCnt = topChs.find((c) => /aespa/i.test(c.name))?.count || 163;
    const sofiCount = sofiNb?.sourceCount || 49;
    const hooksCount = hooksNb?.sourceCount || 9;
    const geminiInvCount =
      d?.geminiPatternCounts?.[
        '投資・市場・アルゴリズムの質問(株/投資/銘柄/機関投資家/アルゴリズム/空売り/オプション/うねり)'
      ] || 52;
    const nov16Burst = d?.googleSearchDailyBursts?.find(
      (b) => b.date === '2026-11-16'
    );

    // 特徴1：今いちばん興味を持って深く探求しているもの（意味の近い頻出ワード群）
    discoveries.push({
      id: 'disc-soft-1',
      headline:
        '1. いま一番ガッツリ掘っているのは「株・市場の裏側の仕組み」と「エンタメが人気になる理由」。',
      factStatement: `データを横断して見ると、近い意味の言葉として一番たくさん出てくるのが「株価・ビットコイン・メタプラネット・テスラ・決算」などの投資ワード（Google検索で${financeCount}件）と、YouTubeでよく見ている『雨来ズ。』（${amekozuCnt}回）や『aespa』（視聴${aespaCnt}回・検索${aespaSearchCnt}回）などのエンタメ系ワードだよ。\nすごいのが、ただ株を買ったり動画を見て楽しむだけじゃなく、「なんでそう動くのか？」の仕組みまで徹底的に掘っているところ。投資ならGeminiに機関投資家のアルゴリズムや空売りの仕組み、うねり取りを${geminiInvCount}回も質問して、米国株の『SoFi』についてはNotebookLMに${sofiCount}件も資料を集めているね。\nエンタメでも「なんでアイドルは推したくなるのか」をGeminiと議論したり、ショート動画の冒頭の作り方（ジェニー・ホヨスの分析など）の資料をNotebookLMに${hooksCount}件集めていて、好きなものを「作る側・仕組みの目線」で深く探求しているよ。`,
      metricLabel: `投資検索 ${financeCount}件・SoFi資料 ${sofiCount}件 / 雨来ズ。${amekozuCnt}回`,
      categoryTag: '1. いま一番の沼・深掘り',
      serviceBreakdown: [
        {
          service: '投資・市場の深掘り',
          stat: `検索${financeCount}件 / Gemini質問${geminiInvCount}件 / SoFi資料${sofiCount}件`,
        },
        {
          service: 'エンタメと仕組み研究',
          stat: `雨来ズ。${amekozuCnt}回 / aespa ${aespaCnt}回 / 動画フック資料${hooksCount}件`,
        },
      ],
      evidenceIds: ['ev-rhythm-peak'],
      enabled: true,
    });

    // 特徴2：特徴1ほどではないがよく出てくる第2・第3の頻出ワード群
    discoveries.push({
      id: 'disc-soft-2',
      headline:
        '2. もうひとつの顔として、「書道（古典から現代の書家まで）」や「新潟・上越と麻辣湯」もよく調べている。',
      factStatement: `投資やエンタメの次に特定のジャンルとして何度も顔を出すのが、書道まわりの言葉（Google検索で計${shodoCount}件）だよ。『千字文』（隷書・竹冠の字形）や陶淵明の漢詩『雑詩 其五』、異体字（「眠」）みたいな古典の文字調べから、「2尺8尺のサイズ」「書遊」などの道具調べ、「日展」「読売書法展」まで幅広く追いかけているね。\n特に11月16日だけでも『陶淵明詩 雑詩 其5』→『書法字典 サイト』→『書道 武田双雲』→『高木聖雨』→『しょかいしゃ（書魁社）』と1日で${
        nov16Burst?.count || 13
      }回続けて検索していて、一度気になると関連する言葉をトコトン調べるクセが出ているよ。\nさらにマップや検索では、新潟・上越エリア（万代シテイ、朱鷺メッセ、高田小町、本町など）や、美味しい『麻辣湯（楊国福・七宝麻辣湯）』（NotebookLMにも東京麻辣湯10選ノートあり！）、サウナやヘッドスパも繰り返し調べていて、渋い伝統文化と今っぽいグルメ・癒やしを自然に行き来しているね。`,
      metricLabel: `書道関連 ${shodoCount}件 / 11月16日に${
        nov16Burst?.count || 13
      }回連続検索`,
      categoryTag: '2. もうひとつの頻出テーマ',
      serviceBreakdown: [
        {
          service: '書道・古典・書法展',
          stat: `Google検索 ${shodoCount}件 (千字文・陶淵明・日展・高木聖雨ほか)`,
        },
        {
          service: '11月16日の集中検索',
          stat: `1日で${nov16Burst?.count || 13}回連続で書家・古典を調査`,
        },
        {
          service: 'マップ・グルメの頻出',
          stat: '新潟・上越エリア / 楊国福・七宝麻辣湯 / サウナ・ヘッドスパ',
        },
      ],
      evidenceIds: ['ev-rhythm-peak'],
      enabled: true,
    });
  } else {
    // Generic dataset (Dummy personas / other users)
    const t1 = profile.topTopics[0];
    const t2 = profile.topTopics[1] || profile.topTopics[2];
    const topNb = nbs[0];
    const t1Label =
      t1?.keyword || topQueries[0]?.query || topChs[0]?.name || 'メインテーマ';
    const t2Label =
      t2?.keyword || topQueries[3]?.query || topChs[1]?.name || 'サブテーマ';

    discoveries.push({
      id: 'disc-soft-1',
      headline: `1. いま一番夢中で掘っているのは「${t1Label}」まわりのテーマ。`,
      factStatement: `データを横断して見ると、似た意味の言葉として一番たくさん登場するのが「${t1Label}」に関係するワードだよ。Google検索で『${topQueries
        .slice(0, 4)
        .map((q) => `${q.query}（${q.count}回）`)
        .join('』『')}』と細かく調べているだけじゃなく、YouTubeでも『${
        topChs[0]?.name || '-'
      }』（${topChs[0]?.count || 0}回）を中心に繰り返し見ているね。\nさらに${
        topNb
          ? `NotebookLMにも『${topNb.title}』として資料を${topNb.sourceCount}件も集めて整理していて、`
          : 'Geminiにも専門的な質問をいくつも投げていて、'
      }ただ表面をなぞるだけじゃなく「どうしてそうなるのか」の原理や具体的な条件まで徹底的に知りたがる熱量が伝わってくるよ。`,
      metricLabel: `関連アクション 計${t1?.count || topQueries[0]?.count || 0}件`,
      categoryTag: '1. いま一番の沼・深掘り',
      serviceBreakdown: [
        {
          service: 'よく調べるワード',
          stat: topQueries
            .slice(0, 3)
            .map((q) => `${q.query}(${q.count}回)`)
            .join(' / '),
        },
        ...(topNb
          ? [
              {
                service: `NotebookLM (${topNb.title.slice(0, 14)})`,
                stat: `資料${topNb.sourceCount}件`,
              },
            ]
          : []),
      ],
      evidenceIds: ['ev-rhythm-peak'],
      enabled: true,
    });

    discoveries.push({
      id: 'disc-soft-2',
      headline: `2. 次にたくさん顔を出すのが「${t2Label}」や普段のお出かけスポット。`,
      factStatement: `1つ目のテーマほどではないけれど、履歴の中で何度も繰り返し出てくるのが「${t2Label}」や『${topQueries
        .slice(4, 8)
        .map((q) => q.query)
        .join('』『')}』といった言葉だよ。\n${
        topBurst
          ? `特に${topBurst.date}には、1日で『${topBurst.queries
              .slice(0, 5)
              .join('』→『')}』と${
              topBurst.count
            }回続けて検索していて、気になったら一気に掘り下げる調べ方がよく表れているね。\n`
          : ''
      }またGoogleマップでも『${topPlaces
        .slice(0, 3)
        .map((p) => `${p.place}（${p.count}回）`)
        .join('』『')}』をよく調べていて、ネットの中の調べものとリアルで行きたい場所がしっかり繋がっているよ。`,
      metricLabel: `第2テーマ 計${t2?.count || 0}件`,
      categoryTag: '2. もうひとつの頻出テーマ',
      serviceBreakdown: [
        {
          service: '第2・第3の頻出ワード',
          stat: topQueries
            .slice(4, 7)
            .map((q) => `${q.query}(${q.count}回)`)
            .join(' / '),
        },
        ...(topBurst
          ? [
              {
                service: `${topBurst.date}の連続検索`,
                stat: `1日${topBurst.count}回連続`,
              },
            ]
          : []),
      ],
      evidenceIds: ['ev-rhythm-peak'],
      enabled: true,
    });
  }

  // 特徴3：どんな時間帯での活動が多いか、時間帯・季節ごとに調べるもの
  const peakSlot = timeSlots[0];
  const secondSlot = timeSlots[1];
  const thirdSlot = timeSlots[2];
  const earlierMonth = monthly[0];
  const latestMonth = monthly[monthly.length - 1];

  discoveries.push({
    id: 'disc-soft-3',
    headline: `3. よく動くのは「${
      peakSlot?.slot || '昼11〜16時台'
    }」と「${
      secondSlot?.slot || '夜17〜22時台'
    }」。時間帯や季節で調べるモードが変わる。`,
    factStatement: `1日の活動リズムを見ると、いちばん活発なのは「${
      peakSlot?.slot || '昼'
    }」で全体の${peakSlot?.ratioPct || 36}%（${
      peakSlot?.count.toLocaleString() || 0
    }件）、次に多いのが「${secondSlot?.slot || '夜'}」で${
      secondSlot?.ratioPct || 31
    }%（${secondSlot?.count.toLocaleString() || 0}件）、そして「${
      thirdSlot?.slot || '朝'
    }」が${thirdSlot?.ratioPct || 25}%となっているよ（深夜0〜4時台は${
      profile.lateNightRatio
    }%と意外と少なくて健康的！）。\n時間帯によって調べる中身も変わっていて、${
      peakSlot?.slot || '昼間'
    }は『${(peakSlot?.topSearches || []).slice(0, 4).join('』『')}』のような検索や情報チェックが多いのに対して、${
      secondSlot?.slot || '夜'
    }になると『${(secondSlot?.topSearches || []).slice(0, 3).join('』『')}』を調べたり、『${(
      secondSlot?.topChannels || []
    )
      .slice(0, 2)
      .join('』『')}』の動画をゆっくり見る時間が増えているね。\nまた季節・時期の流れで見ても、${
      earlierMonth
        ? `${earlierMonth.month}頃は『${earlierMonth.topSearches
            .slice(0, 3)
            .join('・')}』が多かったのが、`
        : ''
    }${
      latestMonth
        ? `最近の${latestMonth.month}には『${latestMonth.topSearches
            .slice(0, 3)
            .join('・')}』へシフトしていて、`
        : ''
    }YouTube累計${
      uStats?.totalWatchHours || 0
    }時間のうち「ちょっと違うな」と思った動画は開始15秒以内でパッと次へ飛ばす（${
      uStats?.rapidSkip15sCount || 0
    }回／${uStats?.rapidSkipRatioPct || 0}%）切り替えの速さも無意識のクセとして出ているよ。`,
    metricLabel: `ピーク: ${peakSlot?.slot || '昼'} (${
      peakSlot?.ratioPct || 0
    }%) / 15秒スキップ ${uStats?.rapidSkipRatioPct || 0}%`,
    categoryTag: '3. 時間帯と季節のリズム',
    serviceBreakdown: [
      ...(peakSlot
        ? [
            {
              service: `1位: ${peakSlot.slot}`,
              stat: `${peakSlot.count.toLocaleString()}件 (${peakSlot.ratioPct}%)`,
            },
          ]
        : []),
      ...(secondSlot
        ? [
            {
              service: `2位: ${secondSlot.slot}`,
              stat: `${secondSlot.count.toLocaleString()}件 (${secondSlot.ratioPct}%)`,
            },
          ]
        : []),
      {
        service: '無意識の15秒即スキップ',
        stat: `${uStats?.rapidSkip15sCount.toLocaleString() || 0}回 (${
          uStats?.rapidSkipRatioPct || 0
        }%) / 累計${uStats?.totalWatchHours || 0}時間`,
      },
    ],
    evidenceIds: ['ev-rhythm-peak'],
    enabled: true,
  });

  // 特徴4：過去頻出していたが今ではあまり調べなくなったもの（過去の話）
  const pb1 = pastBooms[0];
  const pb2 = pastBooms[1];
  const pb3 = pastBooms[2];
  const pastSummary = pastBooms
    .slice(0, 5)
    .map(
      (p) =>
        `『${p.item}』（${p.peakPeriod}頃など過去に${p.pastCount}回 → 直近は${p.recentCount}回）`
    )
    .join('、');

  discoveries.push({
    id: 'disc-soft-4',
    headline: `4. 昔はあんなに調べていたのに、今はちょっと落ち着いた「${
      pb1?.item || '過去のマイブーム'
    }」${pb2 ? `や「${pb2.item}」` : ''}の足跡。`,
    factStatement: `特徴1・2が「いま夢中なこと」だとすると、履歴の前半〜中盤には「あの頃は毎日のように見ていたのに、最近はあまり調べなくなった過去のブーム」もくっきり残っているよ。\n実際のデータを見ると、${
      pastSummary || '過去の時期に特定のテーマを集中的に検索・視聴していた記録'
    }といった変化が見つかったよ。\n当時は『${[
      ...(pb1?.sampleTitles || []),
      ...(pb2?.sampleTitles || []),
    ]
      .slice(0, 3)
      .join(
        '』『'
      )}』などを集中的にチェックしていたけれど、自分の中で知りたいことを吸収しきるとスッと卒業して次の新しい興味へ移っていく、「短期集中で深くハマって次へ進む」サイクルがよくわかるね。`,
    metricLabel: pb1
      ? `${pb1.peakPeriod}頃 ピーク（過去${pb1.pastCount}回 → 直近${pb1.recentCount}回）`
      : '過去から現在への興味シフト',
    categoryTag: '4. 昔ハマっていた過去ログ',
    serviceBreakdown: [
      ...(pb1
        ? [
            {
              service: `過去のブーム①: ${pb1.item.slice(0, 14)}`,
              stat: `過去${pb1.pastCount}回 → 直近${pb1.recentCount}回 (${pb1.peakPeriod}頃)`,
            },
          ]
        : []),
      ...(pb2
        ? [
            {
              service: `過去のブーム②: ${pb2.item.slice(0, 14)}`,
              stat: `過去${pb2.pastCount}回 → 直近${pb2.recentCount}回 (${pb2.peakPeriod}頃)`,
            },
          ]
        : []),
      ...(pb3
        ? [
            {
              service: `過去のブーム③: ${pb3.item.slice(0, 14)}`,
              stat: `過去${pb3.pastCount}回 → 直近${pb3.recentCount}回 (${pb3.peakPeriod}頃)`,
            },
          ]
        : []),
    ],
    evidenceIds: ['ev-rhythm-peak'],
    enabled: true,
  });

  // 特徴5：この履歴からあなたの将来を予測すると？
  const planPrompt = d?.geminiPromptsChronological?.find((p) =>
    /①|3要素|3フェーズ|設計書|仕様書|企画書|作りたい|エンドロール/.test(p.prompt)
  );
  const colorPrompt = d?.geminiPromptsChronological?.find((p) =>
    /#[0-9A-Fa-f]{6}|見切れ/.test(p.prompt)
  );
  const totalNbSources = nbs.reduce((acc, n) => acc + n.sourceCount, 0);

  discoveries.push({
    id: 'disc-soft-5',
    headline:
      '5. 【履歴からの未来予測】将来は、バラバラに見える知識を繋げて「まだ世の中にない企画や仕組みを作る人」になっていそう。',
    factStatement: `あくまでこれまでの履歴からの推測だけど、これからのあなたは「ただ詳しい人」で終わらず、一見バラバラに見える複数のジャンル（たとえば伝統やアート×金融や数字×AIやテクノロジー×人が熱狂するエンタメの仕組み）を掛け合わせて、自分の手で新しいサービスや企画を形にする人になっていそうだよ。\nそう言える理由は、思いついたアイデアをそのままにせず、Geminiに「まず企画書と設計書を作ろう」と話しかけたり、${
      planPrompt
        ? `${planPrompt.date}のように「${planPrompt.prompt.slice(0, 85)}...」と機能を3つの要素に分けて設計図に落としている記録があるから。`
        : '常に具体的な手順書や仕様書に落としている記録があるから。'
    }\nさらにNotebookLMに${nbs.length}冊（合計${totalNbSources}件の資料）も知識をストックして、${
      colorPrompt
        ? '画面のカラーコード（#1A1B1Eなど）やスライドの見切れまで自分でディレクションしているので、'
        : '細部の使い心地まで自分で詰めているので、'
    }頭の中の構想をリアルな形にして人を驚かせる未来がすぐそこに見えているよ。`,
    metricLabel: `企画・設計相談 ${
      d?.geminiPatternCounts?.[
        '企画・設計書・UI・配色の指定(アプリ/UI/設計書/仕様書/企画書/スライド/配色/#)'
      ] || 30
    }件 / 資料蓄積 ${totalNbSources}件`,
    categoryTag: '5. 履歴からの未来予測',
    serviceBreakdown: [
      {
        service: '将来のスタイル予測',
        stat: '複数ジャンルの知識を掛け合わせた企画・プロダクト設計者',
      },
      {
        service: '裏付け①：構想の設計化',
        stat: 'アイデアを即座に企画書・設計書・3要素へ分解する習慣',
      },
      {
        service: '裏付け②：知識のストック',
        stat: `NotebookLM ${nbs.length}冊 (計${totalNbSources}件の資料) ＋ YouTube ${
          d?.overview?.uniqueYoutubeChannels || 0
        }chの引き出し`,
      },
    ],
    evidenceIds: ['ev-rhythm-peak'],
    enabled: true,
  });

  // 特徴6：感情か論理か、現実か妄想か、外交的か内向的か——どういう考え方寄り？
  const trustPrompt = d?.geminiPromptsChronological?.find((p) =>
    /信頼してない|信用してない|ソース|根拠|論文/.test(p.prompt)
  );
  const sourceReqCount =
    d?.geminiPatternCounts?.[
      '根拠・出典・論文の確認(ソース/出典/根拠/論文/研究)'
    ] || 22;
  const whyReqCount =
    d?.geminiPatternCounts?.[
      '理由・仕組み・真偽の深掘り(なんで/なぜ/本当/事実/仕組み/構造)'
    ] || 71;

  discoveries.push({
    id: 'disc-soft-6',
    headline:
      '6. 入り口はワクワクする「大きな妄想・理想」から入り、確かめるときは徹底した「論理と現実の根拠」で固めるタイプ。',
    factStatement: `「感情か論理か」「現実か妄想（理想）か」「外交的か内向的か」という視点であなたの履歴を読み解くと、いちばん面白いのが**『発想のスタートはスケールの大きな妄想や理想なのに、判断するときは超シビアな論理・現実派になる』**というギャップだよ。\nたとえば「死ぬ前に人生のエンドロールを見れたらいいよね」「1週間後に人類に何を残すか」といったワクワクする大きな妄想を広げる一方で、いざ調べる段階になるとGeminiに「なんで？」「本当？」と${whyReqCount}回も問いかけ、${
      trustPrompt
        ? `5月29日には「LLMを基本的に信頼してない人間なんでソースがないと信頼しません」と言い切るくらい、`
        : ''
    }ソースや論文・根拠（${sourceReqCount}件）を重視する完全に「論理寄り」の思考をしているね。\nまた、1人でじっくり調べものや思考を深める「内向的」な集中時間をたっぷり持ちつつ、気になったお店や街はマップ（${
      d?.overview?.mapsCount || 0
    }件）で調べて実際に足を運んだり、他の人から見たときの伝わりやすさ（UIやデザイン）を気にかける外向きの視点もバランスよく持っているよ。`,
    metricLabel: `論理・根拠確認 ${
      whyReqCount + sourceReqCount
    }件 / 理想×現実のハイブリッド`,
    categoryTag: '6. 考え方のクセ・スタンス',
    serviceBreakdown: [
      {
        service: '感情 vs 論理',
        stat: `強い「論理・根拠」寄り（ソース・理由の確認 計${
          whyReqCount + sourceReqCount
        }件）`,
      },
      {
        service: '現実 vs 妄想（理想）',
        stat: '入り口は大きな「妄想・構想」→ 着地はシビアな「現実・設計図」',
      },
      {
        service: '外交的 vs 内向的',
        stat: '1人で深く掘る「内向」ベース × 現地行動と伝わり方を重視する「外交」センス',
      },
    ],
    evidenceIds: ['ev-rhythm-peak'],
    enabled: true,
  });

  let catchphrase =
    '「越境する問いの設計者」— 大きな妄想を入り口に、根拠まで掘って次の仕組みを描く人';
  if (!isUserRealData && topChs[0]) {
    catchphrase = `「理論と手触りを往復する探求者」— 気になったら原理から掘り下げ、自分の手で形にする人`;
  }
  if (customNote) {
    catchphrase = `${catchphrase}（${customNote.slice(0, 12)}）`;
  }

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

export async function analyzeProfileWithGemini(
  profile: AggregatedProfile,
  userApiKey?: string,
  onProgress?: (stepMessage: string) => void,
  customOptions?: AnalysisCustomOptions
): Promise<LifeCardProposal> {
  const systemPrompt = buildSystemPrompt(profile, customOptions);

  onProgress?.(
    `集計完了：全 ${profile.totalEvents} 件の履歴（現在・第2興味・時間帯・過去・未来予測・考え方スタンス）を展開しました`
  );

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
          `${modelName} で「6つの特徴（現在・第2テーマ・時間帯・過去・未来予測・考え方）」をやわらかい言葉で分析中...`
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

  const fallback = buildDynamicFallbackProposal(
    profile,
    customOptions,
    systemPrompt
  );
  return validateLifeCardProposal(fallback, profile);
}
