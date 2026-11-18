import { GoogleGenAI, Type, Schema } from '@google/genai';
import {
  AggregatedProfile,
  DiscoveryItem,
  EraChapter,
  LifeCardProposal,
  ServiceBreakdownChip,
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
        'この人に名前（二つ名）と一言キャッチフレーズをつけた文字列。例: 「〇〇の探求者」— 〇〇から〇〇まで、〇〇する人',
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
              '6つの切り口（1.最大の関心 / 2.第2の頻出テーマ / 3.時間帯・季節ごとの行動 / 4.過去のマイブーム / 5.将来の姿の予測 / 6.思考・性格スタンス分析）に対応する端的な見出し',
          },
          factStatement: {
            type: Type.STRING,
            description:
              '見出しを裏付ける詳細で濃密な解説文（250〜400文字程度、3段落）。単なる件数報告で終わらせず、具体的にどんな意味の近いワード群・チャンネル・場所・プロンプトが何件あったか、時期や時間帯による違い、そこから読み取れる人物像まで詳しく踏み込んで記述すること。',
          },
          metricLabel: {
            type: Type.STRING,
            description: '端的な根拠数値ラベル（例: 関連検索 142件 / 昼12時台ピーク）',
          },
          categoryTag: {
            type: Type.STRING,
            description:
              '6つの切り口を示すタグ（1. 現在の最大関心 / 2. 第2の頻出テーマ / 3. 時間帯・季節のリズム / 4. 過去のマイブーム / 5. 履歴からの未来予測 / 6. 思考・性格スタンス診断）',
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
      '「多面的な知的好奇心の探求者」— 疑問をデータと行動で解き明かす人',
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

  return `このGoogle Takeoutのデータ（YouTube視聴・検索、Google検索、Geminiへの送信メッセージ履歴、NotebookLMのノートと資料件数、Googleマップ履歴、時間帯別・時期別の推移）をもとに、**この人の特徴を6個ピックアップし、この人に名前（二つ名）とキャッチフレーズ**をつけてください。

【分析と執筆の絶対ルール（超重要）】
1. **必ず渡された【Google Takeout 実データ集計＆生ログダイジェスト】の中に実在する固有名詞・日付・検索クエリ・Geminiプロンプト引用・NotebookLMノート名と資料件数・時間帯データだけを使うこと。**
2. **見出し（\`headline\`）は端的に、解説部分（\`factStatement\`）は250〜400文字程度（3段落・3〜4文）で徹底的に詳しく書くこと。**
   解説文が2行程度で終わる浅い要約はNGです。具体的な関連ワードの内訳、件数、日付、引用をたっぷり盛り込んでください。
3. **誰でも自分の人生を立体的に知ることができる「6つの汎用的な切り口」で6枚のカード（\`discoveries\`）を作成すること**：
   - **特徴1【現在もっとも深く探求している最大の関心テーマ】**：
     データを横断して検索数や視聴数が最も多い「意味の近いワード群」や、特定の媒体で突出して頻出・深掘りしているテーマ。具体的にどんな関連ワードを何件調べ、どんな動画・AI質問・NotebookLM資料と繋がっているかを詳しく解説する。
   - **特徴2【特徴1に次ぐ、第2・第3の頻出テーマ・もう一つの顔】**：
     特徴1ほどではないが、繰り返し出現する別の頻出ワード群（趣味・カルチャー・推し・日常の関心・よく調べる場所など）。そのワード群の具体的な内訳や特定日の連続検索などを詳しく解説する。
   - **特徴3【活動が多い時間帯・季節ごとのリズムと、その時間に調べるもの】**：
     \`timeOfDayBreakdown\`（朝・昼・夜・深夜の件数と上位ワード）や\`monthlyBreakdown\`（月・季節・年度の推移）、\`unconsciousStats\`（累計視聴時間や15秒以内即スキップ率）をもとに、「いつ活動がピークになるか」「朝・昼・夜・深夜や季節によって調べるものや見る動画がどう変わるか」を具体的な数字とワードで詳しく解説する。
   - **特徴4【過去のマイブーム（過去には頻出していたが、今ではあまり調べなくなったもの）】**：
     特徴1・2が「現在」の話だとすれば、これは「過去」の話。\`pastBooms\`や過去の月別履歴をもとに、「以前（〇年〇月頃）はあんなに検索・視聴していたのに、最近は落ち着いている過去の熱中テーマ・チャンネル・関心事」を当時の件数と最近の件数を対比させながら詳しく振り返る。
   - **特徴5【この履歴から予測する「あなたの将来像」（将来どんな人になっていそうか？）】**：
     これまでの検索・視聴・AIへの相談・NotebookLMの資料収集の積み重ねから推測すると、1年後〜数年後にどんな知識・環境・ライフスタイルを手に入れ、どんな人になっていそうか。「あくまで履歴からの推測ですが」と添えた上で、現在の行動ログを根拠に具体的で納得感のある未来予測を描く。
   - **特徴6【思考・性格スタンス診断（感情か論理か、現実か妄想・理想か、外交的か内向的か）】**：
     ※本文中に「MBTI」という単語やアルファベット分類記号は使わないこと。検索ワードの選び方、Geminiへの質問の仕方（根拠を求めるか、アイデアを広げるか等）、動画のスキップ率、マップの行動範囲から見える「どういう考え方・性格寄りか（論理か感情か、現実か理想・妄想か、外交的か内向的か）」を、実際のログやプロンプト引用を根拠に詳しく分析する。
4. **キャッチコピー（\`catchphrase\`）**は、この人に名前をつけるならどうするか（例：「〇〇の設計者」「〇〇の探求者」）と、6つの特徴を踏まえた一言キャッチフレーズを合わせた形にしてください。
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

  // Group topTopics to get Theme 1 (most explored) and Theme 2 (second frequent)
  const t1 = profile.topTopics[0];
  const t2 = profile.topTopics[1] || profile.topTopics[2];
  const t3 = profile.topTopics[2] || profile.topTopics[3];

  const t1Label =
    t1?.keyword || topQueries[0]?.query || topChs[0]?.name || 'メインテーマ';
  const t2Label =
    t2?.keyword || topQueries[3]?.query || topChs[1]?.name || 'サブテーマ';

  let catchphrase = `「${
    t1Label.split(/[（・]/)[0]
  }と${t2Label.split(/[（・]/)[0]}を横断する探求者」— 疑問をデータで掘り下げ、次の未来を設計する人`;
  if (customNote) {
    catchphrase = `${catchphrase}（${customNote.slice(0, 12)}）`;
  }

  const discoveries: DiscoveryItem[] = [];

  // 特徴1：現在もっとも深く探求している最大の関心テーマ
  const topNb = nbs[0];
  const t1SubText =
    t1?.matchedSubKeywords && t1.matchedSubKeywords.length > 0
      ? t1.matchedSubKeywords.map((s) => `${s.word}（${s.count}件）`).join('、')
      : topQueries
          .slice(0, 5)
          .map((q) => `${q.query}（${q.count}回）`)
          .join('、');

  discoveries.push({
    id: 'disc-univ-1',
    headline: `1. 【現在の最大関心】「${t1Label}」に関連するワード群を媒体横断で最も深く探求している。`,
    factStatement: `全サービスの履歴を横断して最も高い頻度と熱量で調べているのが「${t1Label}」とその周辺領域で、関連する意味の近いワード（${t1SubText}）が繰り返し出現している。\n単一のサービスだけでなく、Google検索での能動的な調査（${
      t1?.gSearchCount || d?.overview?.googleSearchCount || 0
    }回）からYouTubeでの関連動画視聴（${
      t1?.ytWatchCount || topChs[0]?.count || 0
    }本）、さらに${
      topNb
        ? `NotebookLMの『${topNb.title}』（資料${topNb.sourceCount}件）での資料体系化まで`
        : 'AIとの対話まで'
    }複数の角度から知識を掘り下げている。\n表面的な言葉の意味を調べる段階を超えて、具体的な条件・仕組み・実践データまで徹底的に突き詰める現在のメインテーマとなっている。`,
    metricLabel: `関連アクション 計${t1?.count || topQueries[0]?.count || 0}件`,
    categoryTag: '1. 現在の最大関心',
    serviceBreakdown: [
      ...(t1?.gSearchCount
        ? [{ service: 'Google検索', stat: `${t1.gSearchCount}回` }]
        : []),
      ...(t1?.ytWatchCount
        ? [
            {
              service: 'YouTube視聴',
              stat: `${t1.ytWatchCount}本 (${t1.watchHours ?? 0}h)`,
            },
          ]
        : []),
      ...(topNb
        ? [
            {
              service: `NotebookLM (${topNb.title.slice(0, 14)})`,
              stat: `資料${topNb.sourceCount}件`,
            },
          ]
        : []),
    ],
    evidenceIds: [t1?.evidenceId || 'ev-rhythm-peak'],
    enabled: true,
  });

  // 特徴2：特徴1に次ぐ第2・第3の頻出テーマ
  const t2SubText =
    t2?.matchedSubKeywords && t2.matchedSubKeywords.length > 0
      ? t2.matchedSubKeywords.map((s) => `${s.word}（${s.count}件）`).join('、')
      : topQueries
          .slice(5, 10)
          .map((q) => `${q.query}（${q.count}回）`)
          .join('、');
  const burstSentence = topBurst
    ? `\n特に${topBurst.date}には1日で『${topBurst.queries
        .slice(0, 5)
        .join('』→『')}』と計${
        topBurst.count
      }回連続で検索するなど、一度気になると関連ワードを芋づる式に掘り下げる調べ方が特徴的。`
    : '';

  discoveries.push({
    id: 'disc-univ-2',
    headline: `2. 【第2の頻出テーマ】「${t2Label}」${
      t3 ? `や「${t3.keyword}」` : ''
    }も継続して追いかける多面的な関心。`,
    factStatement: `最大関心テーマと並行して、第2・第3の柱として頻出しているのが「${t2Label}」（内訳: ${t2SubText}）${
      t3 ? `および「${t3.keyword}」（計${t3.count}件）` : ''
    }に関する記録。\nYouTubeでは『${
      topChs[0]?.name || '-'
    }』（${topChs[0]?.count || 0}回）や『${topChs[1]?.name || '-'}』（${
      topChs[1]?.count || 0
    }回）を視聴しつつ、Googleマップでは『${topPlaces
      .slice(0, 3)
      .map((p) => p.place)
      .join('』『')}』を調べるなど、まったく異なるジャンルの知識とオフラインの行動を自由に行き来している。${burstSentence}`,
    metricLabel: `第2テーマ 計${t2?.count || 0}件${
      t3 ? ` / 第3テーマ ${t3.count}件` : ''
    }`,
    categoryTag: '2. 第2の頻出テーマ',
    serviceBreakdown: [
      {
        service: `${t2Label.slice(0, 14)}`,
        stat: `計${t2?.count || 0}件`,
      },
      ...(t3
        ? [
            {
              service: `${t3.keyword.slice(0, 14)}`,
              stat: `計${t3.count}件`,
            },
          ]
        : []),
      ...(topBurst
        ? [
            {
              service: `${topBurst.date} 集中検索`,
              stat: `1日${topBurst.count}回連続`,
            },
          ]
        : []),
    ],
    evidenceIds: [t2?.evidenceId || 'ev-rhythm-peak'],
    enabled: true,
  });

  // 特徴3：時間帯・季節ごとの活動リズムと調べるものの違い
  const peakSlot = timeSlots[0];
  const secondSlot = timeSlots[1];
  const latestMonth = monthly[monthly.length - 1];
  const earlierMonth = monthly[0];

  discoveries.push({
    id: 'disc-univ-3',
    headline: `3. 【時間・季節のリズム】活動ピークは「${
      peakSlot?.slot || `${profile.peakHour}時台`
    }」。時間帯や時期で調べる対象が切り替わる。`,
    factStatement: `1日の活動分布を見ると、最も活発なのは「${
      peakSlot?.slot || '昼'
    }」で全体の${peakSlot?.ratioPct || 35}%（${
      peakSlot?.count.toLocaleString() || 0
    }件）を占め、次いで「${secondSlot?.slot || '夜'}」が${
      secondSlot?.ratioPct || 30
    }%（${secondSlot?.count.toLocaleString() || 0}件）となっている。\n時間帯ごとに調べる対象も変化しており、${
      peakSlot?.slot || 'ピーク時間帯'
    }には『${(peakSlot?.topSearches || []).slice(0, 4).join('』『')}』といった検索や『${(
      peakSlot?.topChannels || []
    )
      .slice(0, 2)
      .join('』『')}』の視聴が多い一方、${
      secondSlot?.slot || '別時間帯'
    }には『${(secondSlot?.topSearches || []).slice(0, 4).join('』『')}』へ関心が移っている。\nまた時期・季節の推移でも、${
      earlierMonth
        ? `${earlierMonth.month}頃は『${earlierMonth.topSearches
            .slice(0, 3)
            .join('・')}』が中心だったのに対し、`
        : ''
    }${
      latestMonth
        ? `直近の${latestMonth.month}は『${latestMonth.topSearches
            .slice(0, 3)
            .join('・')}』へとシフトしており、`
        : ''
    }累計${uStats?.totalWatchHours || 0}時間（開始15秒以内即スキップ率${
      uStats?.rapidSkipRatioPct || 0
    }%）の中でメリハリをつけて情報を摂取している。`,
    metricLabel: `最頻: ${peakSlot?.slot || `${profile.peakHour}時台`} (${
      peakSlot?.ratioPct || 0
    }%)`,
    categoryTag: '3. 時間帯・季節のリズム',
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
        service: '15秒以内即スキップ',
        stat: `${uStats?.rapidSkip15sCount || 0}回 (${
          uStats?.rapidSkipRatioPct || 0
        }%)`,
      },
    ],
    evidenceIds: ['ev-rhythm-peak'],
    enabled: true,
  });

  // 特徴4：過去頻出していたが今ではあまり調べなくなった過去のマイブーム
  const pb1 = pastBooms[0];
  const pb2 = pastBooms[1];
  const pb3 = pastBooms[2];
  const pastListStr = pastBooms
    .slice(0, 5)
    .map(
      (p) =>
        `『${p.item}』（${p.peakPeriod}頃に計${p.pastCount}回 → 直近${p.recentCount}回）`
    )
    .join('、');

  discoveries.push({
    id: 'disc-univ-4',
    headline: `4. 【過去のマイブーム】かつて集中的に追っていた「${
      pb1?.item || earlierMonth?.topSearches?.[0] || '過去の熱中テーマ'
    }」${pb2 ? `や「${pb2.item}」` : ''}の記録。`,
    factStatement: `現在のメインテーマに移り変わる前、過去のデータ前半〜中盤にかけて集中的に検索・視聴していたのに最近ではほとんど調べなくなった「過去のマイブーム」がはっきり残っている。\n具体的には、${
      pastListStr ||
      '過去の時期に特定のチャンネルや検索ワードを集中的に掘り下げていた記録'
    }などが挙げられる。\n当時は『${[
      ...(pb1?.sampleTitles || []),
      ...(pb2?.sampleTitles || []),
    ]
      .slice(0, 3)
      .join(
        '』『'
      )}』などを何度もチェックしていたが、疑問が解消されたり一通りの知識を吸収し終えるとスパッと次の新しいテーマへ関心を移す「短期集中・完全燃焼型」のサイクルが見て取れる。`,
    metricLabel: pb1
      ? `${pb1.peakPeriod}頃: ${pb1.pastCount}回 → 直近${pb1.recentCount}回`
      : '過去と現在の関心シフト',
    categoryTag: '4. 過去のマイブーム',
    serviceBreakdown: [
      ...(pb1
        ? [
            {
              service: `過去ブーム①: ${pb1.item.slice(0, 12)}`,
              stat: `${pb1.peakPeriod}頃 ${pb1.pastCount}回 → 直近${pb1.recentCount}回`,
            },
          ]
        : []),
      ...(pb2
        ? [
            {
              service: `過去ブーム②: ${pb2.item.slice(0, 12)}`,
              stat: `${pb2.peakPeriod}頃 ${pb2.pastCount}回 → 直近${pb2.recentCount}回`,
            },
          ]
        : []),
      ...(pb3
        ? [
            {
              service: `過去ブーム③: ${pb3.item.slice(0, 12)}`,
              stat: `${pb3.peakPeriod}頃 ${pb3.pastCount}回 → 直近${pb3.recentCount}回`,
            },
          ]
        : []),
    ],
    evidenceIds: ['ev-rhythm-peak'],
    enabled: true,
  });

  // 特徴5：この履歴から予測する将来像
  const planPrompt = d?.geminiPromptsChronological?.find((p) =>
    /①|3要素|3フェーズ|設計書|仕様書|企画書|作りたい/.test(p.prompt)
  );
  const totalNbSources = nbs.reduce((acc, n) => acc + n.sourceCount, 0);

  discoveries.push({
    id: 'disc-univ-5',
    headline: `5. 【履歴からの未来予測】「${
      t1Label.split(/[（・]/)[0]
    }」と「${
      t2Label.split(/[（・]/)[0]
    }」を掛け合わせ、自ら仕組みや作品を作って発信・運用する人になる。`,
    factStatement: `あくまでこれまでの行動履歴からの推測ですが、単に情報を消費する側にとどまらず、近い将来「複数の専門領域を掛け合わせた独自のプロダクト・企画・空間を自ら設計して世に出す人」になっている可能性が非常に高い。\nその根拠として、NotebookLMに全${
      nbs.length
    }冊・計${totalNbSources}件もの専門資料を蓄積して構造化している点や、Geminiとの対話（全${
      d?.overview?.geminiPromptCount || 0
    }件）で${
      planPrompt
        ? `「${planPrompt.prompt.slice(0, 95)}...」のようにアイデアを具体的な要件・設計書に落とし込んでいる点`
        : '常に実践的な設計や仕組み化を議論している点'
    }が挙げられる。\nインプットの幅広さ（YouTube ${
      d?.overview?.uniqueYoutubeChannels || 0
    }チャンネル・検索 ${
      d?.overview?.uniqueGoogleSearchQueries || 0
    }語）がそのまま独自の企画力に直結していく未来像が浮かび上がる。`,
    metricLabel: `研究ノート ${nbs.length}冊（資料${totalNbSources}件）の蓄積`,
    categoryTag: '5. 履歴からの未来予測',
    serviceBreakdown: [
      {
        service: '知識の掛け合わせ',
        stat: `${t1Label.split(/[（・]/)[0]} × ${t2Label.split(/[（・]/)[0]}`,
      },
      {
        service: 'NotebookLM蓄積',
        stat: `全${nbs.length}冊 (計${totalNbSources}件の資料)`,
      },
      {
        service: 'Gemini設計・壁打ち',
        stat: `全${d?.overview?.geminiPromptCount || 0}件のプロンプト`,
      },
    ],
    evidenceIds: ['ev-rhythm-peak'],
    enabled: true,
  });

  // 特徴6：思考・性格のスタンス分析（論理か感情か、現実か妄想か、外交的か内向的か）
  const trustPrompt = d?.geminiPromptsChronological?.find((p) =>
    /信頼してない|信用してない|ソース|根拠|論文/.test(p.prompt)
  );
  const colorPrompt = d?.geminiPromptsChronological?.find((p) =>
    /#[0-9A-Fa-f]{6}|見切れ/.test(p.prompt)
  );
  const sourceReqCount =
    d?.geminiPatternCounts?.[
      '根拠・出典・論文の確認(ソース/出典/根拠/論文/研究)'
    ] || 0;
  const whyReqCount =
    d?.geminiPatternCounts?.[
      '理由・仕組み・真偽の深掘り(なんで/なぜ/本当/事実/仕組み/構造)'
    ] || 0;

  discoveries.push({
    id: 'disc-univ-6',
    headline:
      '6. 【思考・性格スタンス診断】大きな構想（理想・妄想）を、徹底した「論理・根拠・現実のディテール」で固める内省的ストラテジスト。',
    factStatement: `思考と行動のスタンス（論理か感情か、現実か理想・妄想か、外交的か内向的か）で履歴を分析すると、「発想の入り口はスケールの大きな理想・妄想でありながら、判断と検証のプロセスは極めてシビアな論理・根拠主義」という特徴が際立っている。\nGeminiへの送信でも「なぜ・本当・仕組み」を問うものが${whyReqCount}件、「ソース・根拠・論文」を求めるものが${sourceReqCount}件あり、${
      trustPrompt
        ? `${trustPrompt.date}には「${trustPrompt.prompt.slice(0, 90)}」と明言するなど、`
        : ''
    }感情的な同調より事実とロジックを優先する。\nまた、1人で深く思考を掘り下げる内向的な探求時間が長い一方で、マップ（${
      d?.overview?.mapsCount || 0
    }件）で現地のスポットを調べたり、${
      colorPrompt
        ? `「${colorPrompt.prompt.slice(0, 75)}...」のように他者に伝わる画面の細部まで現実的に詰め切る実行力も兼ね備えている。`
        : '他者にどう伝わるかのアウトプット品質まで現実的に詰め切る実行力も兼ね備えている。'
    }`,
    metricLabel: `論理・根拠重視（なぜ・根拠確認 計${
      whyReqCount + sourceReqCount
    }件）`,
    categoryTag: '6. 思考・性格スタンス診断',
    serviceBreakdown: [
      {
        service: '思考スタンス（論理 vs 感情）',
        stat: `強い論理・根拠重視 (根拠・理由確認 ${
          whyReqCount + sourceReqCount
        }件)`,
      },
      {
        service: '視点スタンス（現実 vs 理想・妄想）',
        stat: '大きな構想・妄想を現実の設計図と数値に落とすタイプ',
      },
      {
        service: '行動スタンス（外交的 vs 内向的）',
        stat: '1人で徹底的に深掘りしつつ現地行動も伴う自律探求型',
      },
    ],
    evidenceIds: ['ev-rhythm-peak'],
    enabled: true,
  });

  const eraChapters: EraChapter[] = profile.monthlyTrends
    .slice(-3)
    .map((m) => ({
      periodLabel: m.month,
      themeTitle: `${m.topKeywords.join('・') || m.dominantService}`,
      summary: `計${m.totalCount}件のアクティビティ。`,
    }));

  return {
    catchphrase,
    eraChapters,
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
    `集計完了：全 ${profile.totalEvents} 件の履歴（現在×過去×時間帯×思考傾向）を展開しました`
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
          `${modelName} で「6つの汎用切り口（現在・第2関心・時間帯・過去・未来予測・思考タイプ）」を詳細分析中...`
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
        // Try next model in modelsToTry
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
