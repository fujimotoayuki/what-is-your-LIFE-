import {
  ActivitySpike,
  AggregatedProfile,
  AiRawDigest,
  CrossServicePattern,
  MonthlyTrend,
  NormalizedEvent,
  PrivacyGuardStats,
  ServiceSource,
  SourceFileSummary,
  TopicGenre,
  TopicSummary,
  UnconsciousStats,
} from '../../types/life';

const STOPWORDS = new Set([
  'http',
  'https',
  'www',
  'com',
  'jp',
  'net',
  'org',
  'co',
  'watch',
  'search',
  'google',
  'youtube',
  'youtube.com',
  'google.com',
  'google.co.jp',
  'youtu.be',
  'tiktok',
  'twitter',
  'instagram',
  'shorts',
  'viral',
  'short',
  'video',
  'movie',
  'official',
  'channel',
  'the',
  'and',
  'for',
  'with',
  'from',
  '切り抜き',
  '公式',
  '動画',
  '解説',
  '実況',
  '結果',
  '検証',
  'ショート',
  'チャンネル',
  '使用',
  'マップ',
  '検索',
  '無料',
  '意味',
  'とは',
  '違い',
  'サイト',
  '方法',
  '理由',
  '年齢',
  '日本',
  '東京',
  '世界',
  '最高',
  '最強',
  '今日',
  '今年',
  '毎日',
  '生活',
  '人間',
  '一人',
  '仕事',
  '時間',
  '画像',
  '一覧',
  'まとめ',
  'ランキング',
  'おすすめ',
  '言い換え',
  '効果音',
  'フォント',
  'エロ',
  '風俗',
  '裏バイト',
  'コンカフェ',
  'missav',
  'raw',
  '定期購入',
]);

interface SemanticGenreRule {
  id: string;
  genre: TopicGenre;
  defaultTitle: string;
  terms: { label: string; pattern: RegExp }[];
}

const SEMANTIC_GENRE_RULES: SemanticGenreRule[] = [
  {
    id: 'genre-oshikatsu-aespa',
    genre: 'oshikatsu',
    defaultTitle: 'aespa（エスパ）',
    terms: [
      { label: 'aespa', pattern: /aespa|エスパ/i },
      { label: 'ウィンター', pattern: /ウィンター|winter.*aespa|aespa.*winter/i },
      { label: 'カリナ', pattern: /カリナ|karina.*aespa|aespa.*karina/i },
      { label: 'ニンニン', pattern: /ニンニン|ningning/i },
      { label: 'ジゼル', pattern: /ジゼル|giselle/i },
    ],
  },
  {
    id: 'genre-money-investment',
    genre: 'money',
    defaultTitle: '株価・投資・仮想通貨',
    terms: [
      { label: '株価', pattern: /株価|日経平均|ダウ/ },
      {
        label: 'ビットコイン',
        pattern: /ビットコイン|bitcoin|\bbtc\b|仮想通貨|暗号資産/i,
      },
      { label: 'メタプラネット', pattern: /メタプラ/ },
      { label: 'SoFi', pattern: /\bsofi\b|ソーファイ/i },
      {
        label: 'テスラ・米国株',
        pattern: /テスラ|\btsla\b|エヌビディア|nvidia|米国株|S&P500/i,
      },
      {
        label: '決算・ETF・NISA',
        pattern: /決算|\betf\b|\bnisa\b|新NISA|株式投資|配当|証券/i,
      },
    ],
  },
  {
    id: 'genre-hobby-shodo',
    genre: 'hobby_culture',
    defaultTitle: '書道・古典・書法展',
    terms: [
      { label: '千字文・隷書', pattern: /千字文|隷書|楷書|行書|草書|篆書|竹冠/ },
      { label: '日展・読売書法展', pattern: /日展|読売書法展|書魁|毎日書道|謙慎/ },
      { label: '書道・揮毫', pattern: /書道|習字|揮毫|条幅|臨書/ },
      { label: '書法字典', pattern: /書法字典|字典/ },
      { label: '漢詩・陶淵明', pattern: /漢詩|陶淵明|雑詩|高木聖雨|原田幹久/ },
    ],
  },
  {
    id: 'genre-maps-local-niigata',
    genre: 'maps_outing',
    defaultTitle: '新潟・上越エリア拠点',
    terms: [
      {
        label: '上越・高田・本町',
        pattern: /上越|高田小町|高田駅|高田城|本町web|ミュゼ雪小町/,
      },
      { label: '新潟・万代', pattern: /万代シテイ|新潟市|新潟県|新潟駅|ビッグスワン/ },
      { label: '朱鷺メッセ・長岡', pattern: /朱鷺メッセ|リバーサイド千秋/ },
    ],
  },
  {
    id: 'genre-maps-gourmet-wellness',
    genre: 'maps_outing',
    defaultTitle: '麻辣湯・ラーメン・サウナ・癒やし',
    terms: [
      {
        label: '麻辣湯（楊国福・七宝）',
        pattern: /麻辣湯|マーラータン|マーラーたん|楊国福|七宝麻辣湯/,
      },
      { label: 'ラーメン', pattern: /ラーメン|らーめん|中華そば/ },
      {
        label: 'サウナ・ヘッドスパ',
        pattern: /サウナ|萩の湯|ヘッドスパ|Adonis|アドニス/i,
      },
      { label: 'エニタイム・ジム', pattern: /エニタイムフィットネス|エニタイム/ },
      {
        label: 'カフェ・スポット',
        pattern: /カフェ|東京ドーム|六本木ヒルズ|コスモワールド|マリンタワー|AIR CABIN/,
      },
    ],
  },
  {
    id: 'genre-ai-tech-career',
    genre: 'ai_tech_career',
    defaultTitle: 'AI開発・IT資格・キャリア研究',
    terms: [
      {
        label: 'AI開発・Claude・Gemini',
        pattern: /\bclaude\b|antigravity|cline|cursor|ジェミニ|\bgemini\b|生成ai|llm/i,
      },
      {
        label: 'プログラミング・Web開発',
        pattern: /react|typescript|javascript|python|プログラミング|アプリ開発|github|api/i,
      },
      {
        label: '企業研究・新卒就活',
        pattern: /新卒|就活|インターン|ガクチカ|テラスカイ|ソニーフィナンシャル/,
      },
      {
        label: '情報処理・安全確保支援士',
        pattern: /安全確保支援士|情報処理|基本情報|応用情報|統計|回帰分析/,
      },
    ],
  },
  {
    id: 'genre-yt-amekozu',
    genre: 'youtube_creator',
    defaultTitle: '雨来ズ。',
    terms: [{ label: '雨来ズ。', pattern: /雨来ズ|雨来ず|雨ニモマケズ/ }],
  },
  {
    id: 'genre-yt-seju',
    genre: 'youtube_creator',
    defaultTitle: 'seju・超十代',
    terms: [
      {
        label: 'seju・超十代',
        pattern: /せじゅ|\bseju\b|超十代|実熊瑠琉|本望あやか|平松その|増田彩乃|櫻井優衣/i,
      },
    ],
  },
  {
    id: 'genre-yt-hiroaka',
    genre: 'youtube_creator',
    defaultTitle: 'ヒロアカ（白金レオ）',
    terms: [
      {
        label: 'ヒロアカ・白金レオ',
        pattern: /ヒロアカ|僕のヒーローアカデミア|白金レオ|死柄木|荼毘/,
      },
    ],
  },
  {
    id: 'genre-yt-tabletennis',
    genre: 'youtube_creator',
    defaultTitle: '卓球（卓キチ）',
    terms: [{ label: '卓球・卓キチ', pattern: /卓球|卓キチ|吉村真晴/ }],
  },
];

function isGarbageKeyword(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  if (lower.length < 2 || lower.length > 24) return true;
  if (STOPWORDS.has(lower)) return true;
  if (/^\d+$/.test(lower)) return true;
  if (/\.(com|jp|net|org|io|tv|be|me|app)$/i.test(lower)) return true;
  if (lower.includes('http') || lower.includes('youtube') || lower.includes('google')) {
    return true;
  }
  if (lower.includes('定期購入') || lower.includes('視聴') || lower.includes('検索')) {
    return true;
  }
  return false;
}

function classifyDynamicKeywordGenre(
  kw: string,
  services: Set<ServiceSource>,
  gSearchCount: number,
  mapsCount: number,
  geminiCount: number,
  notebookCount: number
): TopicGenre {
  if (mapsCount >= 2 || /駅|市|県|町|ホテル|温泉|カフェ|ラーメン|サウナ/.test(kw)) {
    return 'maps_outing';
  }
  if (geminiCount + notebookCount >= 2) {
    return 'ai_tech_career';
  }
  if (/株|投資|円|ドル|決算|NISA|ビットコイン|証券|銀行|年収/.test(kw)) {
    return 'money';
  }
  if (gSearchCount >= 3 && services.size >= 2) {
    return 'hobby_culture';
  }
  if (services.size >= 2) {
    return 'oshikatsu';
  }
  return 'general';
}

function extractFallbackSearchKeywords(ev: NormalizedEvent): string[] {
  // Only extract fallback dynamic keywords from explicit Searches, Maps, NotebookLM, or bracketed tags
  if (ev.actionType === 'search' || ev.source === 'maps') {
    const cleanQuery = ev.title
      .replace(/^「\s*/, '')
      .replace(/\s*」$/, '')
      .replace(/\s*-\s*Google\s*検索$/i, '')
      .replace(/[　\s]+/g, ' ')
      .trim();
    if (!isGarbageKeyword(cleanQuery)) {
      const parts = cleanQuery
        .split(' ')
        .map((p) => p.trim())
        .filter((p) => !isGarbageKeyword(p));
      return parts.slice(0, 2);
    }
  }

  if (ev.source === 'notebooklm') {
    const clean = ev.title.replace(/^[^\w\u3000-\u9fff]+/, '').trim().slice(0, 20);
    return isGarbageKeyword(clean) ? [] : [clean];
  }

  const matched: string[] = [];
  const bracketMatches = ev.title.matchAll(/【([^】]{2,14})】/g);
  for (const m of bracketMatches) {
    const inner = m[1].split(/[\/／・|｜]/)[0].trim();
    if (!isGarbageKeyword(inner)) {
      matched.push(inner);
    }
  }
  return matched.slice(0, 1);
}

export function aggregateEvents(
  events: NormalizedEvent[],
  privacyStats: PrivacyGuardStats,
  datasetLabel = 'Google Takeout Dataset',
  sourceFiles?: SourceFileSummary[]
): AggregatedProfile {
  const serviceCounts: Record<ServiceSource, number> = {
    youtube: 0,
    chrome: 0,
    gemini: 0,
    maps: 0,
    notebooklm: 0,
  };

  const hourlyDistribution = new Array<number>(24).fill(0);
  let lateNightCount = 0;
  let weekendCount = 0;

  const channelMap = new Map<string, { count: number; minutes: number }>();

  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Compute watch durations & 15s rapid skip count for YouTube watches
  const ytWatches = sorted.filter(
    (e) => e.source === 'youtube' && e.actionType === 'watch'
  );
  const eventDurationMin = new Map<string, number>();
  let totalWatchMinutes = 0;
  let rapidSkip15sCount = 0;
  const dailyWatchMinutes = new Map<string, number>();

  for (let i = 0; i < ytWatches.length; i++) {
    const cur = ytWatches[i];
    const next = ytWatches[i + 1];
    const curMs = new Date(cur.timestamp).getTime();
    const nextMs = next ? new Date(next.timestamp).getTime() : curMs + 360_000;
    const gapSec = Math.max(0, (nextMs - curMs) / 1000);

    if (gapSec > 0 && gapSec <= 15) {
      rapidSkip15sCount++;
    }

    let durMin = 6;
    if (gapSec > 0 && gapSec <= 35 * 60) {
      durMin = gapSec / 60;
    } else if (
      cur.title.toLowerCase().includes('short') ||
      cur.title.includes('#')
    ) {
      durMin = 1;
    } else {
      durMin = 8;
    }

    eventDurationMin.set(cur.id, durMin);
    totalWatchMinutes += durMin;

    const jstDay = new Date(curMs + 9 * 3600_000).toISOString().slice(0, 10);
    dailyWatchMinutes.set(jstDay, (dailyWatchMinutes.get(jstDay) ?? 0) + durMin);
  }

  let maxSingleDayDate = '';
  let maxSingleDayMinutes = 0;
  dailyWatchMinutes.forEach((mins, day) => {
    if (mins > maxSingleDayMinutes) {
      maxSingleDayMinutes = mins;
      maxSingleDayDate = day;
    }
  });

  const unconsciousStats: UnconsciousStats = {
    totalWatchHours: Math.round(totalWatchMinutes / 60),
    totalDaysEquivalent: Number((totalWatchMinutes / 60 / 24).toFixed(1)),
    rapidSkip15sCount,
    rapidSkipRatioPct:
      ytWatches.length > 0
        ? Math.round((rapidSkip15sCount / ytWatches.length) * 100)
        : 0,
    maxSingleDayDate: maxSingleDayDate || sorted[0]?.timestamp.slice(0, 10) || '',
    maxSingleDayHours: Number((maxSingleDayMinutes / 60).toFixed(1)),
  };

  interface TopicAccumulator {
    id: string;
    defaultTitle: string;
    genre: TopicGenre;
    isSemanticRule: boolean;
    count: number;
    watchMinutes: number;
    ytWatchCount: number;
    ytSearchCount: number;
    gSearchCount: number;
    mapsCount: number;
    geminiCount: number;
    notebookCount: number;
    subKeywords: Map<string, number>;
    services: Set<ServiceSource>;
    hours: number[];
    sampleTitles: string[];
  }

  const topicMap = new Map<string, TopicAccumulator>();

  const dateMap = new Map<
    string,
    {
      count: number;
      serviceCounts: Record<ServiceSource, number>;
      keywords: Map<string, number>;
      sampleTitles: string[];
    }
  >();

  const monthMap = new Map<
    string,
    {
      count: number;
      serviceCounts: Record<ServiceSource, number>;
      keywords: Map<string, number>;
    }
  >();

  const recordTopicHit = (
    key: string,
    defaultTitle: string,
    genre: TopicGenre,
    isSemanticRule: boolean,
    matchedSubLabels: string[],
    ev: NormalizedEvent,
    durMin: number,
    hour: number
  ) => {
    const entry = topicMap.get(key) ?? {
      id: key,
      defaultTitle,
      genre,
      isSemanticRule,
      count: 0,
      watchMinutes: 0,
      ytWatchCount: 0,
      ytSearchCount: 0,
      gSearchCount: 0,
      mapsCount: 0,
      geminiCount: 0,
      notebookCount: 0,
      subKeywords: new Map<string, number>(),
      services: new Set<ServiceSource>(),
      hours: [],
      sampleTitles: [],
    };

    entry.count++;
    entry.watchMinutes += durMin;
    if (ev.source === 'youtube' && ev.actionType === 'watch') entry.ytWatchCount++;
    if (ev.source === 'youtube' && ev.actionType === 'search') entry.ytSearchCount++;
    if (ev.source === 'chrome') entry.gSearchCount++;
    if (ev.source === 'maps') entry.mapsCount++;
    if (ev.source === 'gemini') entry.geminiCount++;
    if (ev.source === 'notebooklm') entry.notebookCount++;

    for (const sub of matchedSubLabels) {
      entry.subKeywords.set(sub, (entry.subKeywords.get(sub) ?? 0) + 1);
    }

    entry.services.add(ev.source);
    entry.hours.push(hour);

    // Prefer non-YouTube or search/maps sample titles when available so samples aren't only video titles
    const cleanSample = ev.title.slice(0, 38);
    if (
      entry.sampleTitles.length < 5 &&
      !entry.sampleTitles.includes(cleanSample)
    ) {
      if (ev.source !== 'youtube' || ev.actionType === 'search') {
        entry.sampleTitles.unshift(cleanSample);
        if (entry.sampleTitles.length > 5) entry.sampleTitles.pop();
      } else {
        entry.sampleTitles.push(cleanSample);
      }
    }
    topicMap.set(key, entry);
  };

  for (const ev of sorted) {
    serviceCounts[ev.source] = (serviceCounts[ev.source] || 0) + 1;
    const durMin = eventDurationMin.get(ev.id) ?? 0;

    if (
      ev.source === 'youtube' &&
      ev.actionType === 'watch' &&
      ev.channelOrDomain &&
      !isGarbageKeyword(ev.channelOrDomain)
    ) {
      const prevCh = channelMap.get(ev.channelOrDomain) ?? {
        count: 0,
        minutes: 0,
      };
      prevCh.count++;
      prevCh.minutes += durMin;
      channelMap.set(ev.channelOrDomain, prevCh);
    }

    const dt = new Date(ev.timestamp);
    if (isNaN(dt.getTime())) continue;

    const jstDate = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
    const hour = jstDate.getUTCHours();
    const dayOfWeek = jstDate.getUTCDay();
    const dateKey = jstDate.toISOString().slice(0, 10);
    const monthKey = jstDate.toISOString().slice(0, 7);

    hourlyDistribution[hour]++;
    if (hour >= 0 && hour <= 4) {
      lateNightCount++;
    }
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendCount++;
    }

    const combinedText = `${ev.title} ${ev.channelOrDomain || ''}`;
    const eventThemeLabels: string[] = [];

    for (const rule of SEMANTIC_GENRE_RULES) {
      const matchedLabels: string[] = [];
      for (const term of rule.terms) {
        if (term.pattern.test(combinedText)) {
          matchedLabels.push(term.label);
        }
      }
      if (matchedLabels.length > 0) {
        recordTopicHit(
          rule.id,
          rule.defaultTitle,
          rule.genre,
          true,
          matchedLabels,
          ev,
          durMin,
          hour
        );
        eventThemeLabels.push(matchedLabels[0]);
      }
    }

    if (eventThemeLabels.length === 0) {
      const fallbackKws = extractFallbackSearchKeywords(ev);
      for (const kw of fallbackKws) {
        recordTopicHit(
          `dyn-${kw.toLowerCase()}`,
          kw,
          'general',
          false,
          [kw],
          ev,
          durMin,
          hour
        );
        eventThemeLabels.push(kw);
      }
    }

    const dEntry = dateMap.get(dateKey) ?? {
      count: 0,
      serviceCounts: { youtube: 0, chrome: 0, gemini: 0, maps: 0, notebooklm: 0 },
      keywords: new Map<string, number>(),
      sampleTitles: [],
    };
    dEntry.count++;
    dEntry.serviceCounts[ev.source]++;
    for (const kw of eventThemeLabels) {
      dEntry.keywords.set(kw, (dEntry.keywords.get(kw) ?? 0) + 1);
    }
    if (dEntry.sampleTitles.length < 4) {
      dEntry.sampleTitles.push(ev.title);
    }
    dateMap.set(dateKey, dEntry);

    const mEntry = monthMap.get(monthKey) ?? {
      count: 0,
      serviceCounts: { youtube: 0, chrome: 0, gemini: 0, maps: 0, notebooklm: 0 },
      keywords: new Map<string, number>(),
    };
    mEntry.count++;
    mEntry.serviceCounts[ev.source]++;
    for (const kw of eventThemeLabels) {
      mEntry.keywords.set(kw, (mEntry.keywords.get(kw) ?? 0) + 1);
    }
    monthMap.set(monthKey, mEntry);
  }

  const totalEvents = Math.max(sorted.length, 1);
  let peakHour = 0;
  let maxHourCount = -1;
  hourlyDistribution.forEach((cnt, hr) => {
    if (cnt > maxHourCount) {
      maxHourCount = cnt;
      peakHour = hr;
    }
  });

  const evidenceCatalog: AggregatedProfile['evidenceCatalog'] = {};

  const topChannels = Array.from(channelMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([name, obj]) => ({
      name,
      count: obj.count,
      hours: Number((obj.minutes / 60).toFixed(1)),
    }));

  if (topChannels.length > 0) {
    evidenceCatalog['ev-channel-1'] = {
      evidenceId: 'ev-channel-1',
      label: `YouTube最頻チャンネル「${topChannels[0].name}」(${topChannels[0].count}本 / ${topChannels[0].hours}時間)`,
      services: ['youtube'],
      metric: `1位: ${topChannels[0].name} (${topChannels[0].hours}時間)`,
      detail: `YouTube視聴履歴の上位チャンネル: ${topChannels
        .slice(0, 5)
        .map((c) => `${c.name} (${c.count}本・${c.hours}h)`)
        .join(', ')}`,
    };
  }

  const rhythmEvidenceId = 'ev-rhythm-peak';
  const lateNightRatio = Math.round((lateNightCount / totalEvents) * 100);
  const weekendRatio = Math.round((weekendCount / totalEvents) * 100);
  evidenceCatalog[rhythmEvidenceId] = {
    evidenceId: rhythmEvidenceId,
    label: `総視聴${unconsciousStats.totalWatchHours}時間 / 15秒即スキップ${unconsciousStats.rapidSkip15sCount}回`,
    services: ['youtube', 'chrome', 'gemini'],
    metric: `累計${unconsciousStats.totalWatchHours}時間 / ピーク${peakHour}時台`,
    detail: `全${sorted.length}件・累計視聴${unconsciousStats.totalWatchHours}時間（丸${unconsciousStats.totalDaysEquivalent}日分）。15秒以内スキップ${unconsciousStats.rapidSkip15sCount}回（${unconsciousStats.rapidSkipRatioPct}%）。`,
  };

  // Convert accumulators to TopicSummary and ensure diverse genres are represented
  const allCandidates = Array.from(topicMap.values())
    .filter((item) => item.count >= 2)
    .map((item) => {
      const resolvedGenre = item.isSemanticRule
        ? item.genre
        : classifyDynamicKeywordGenre(
            item.defaultTitle,
            item.services,
            item.gSearchCount,
            item.mapsCount,
            item.geminiCount,
            item.notebookCount
          );

      const matchedSubKeywords = Array.from(item.subKeywords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word, count]) => ({ word, count }));

      // Build a transparent, concrete keyword label from actual matched sub-keywords
      let displayKeyword = item.defaultTitle;
      if (item.isSemanticRule && matchedSubKeywords.length > 0) {
        const topSubNames = matchedSubKeywords.slice(0, 3).map((s) => s.word);
        if (item.id === 'genre-oshikatsu-aespa') {
          displayKeyword =
            topSubNames.length > 1
              ? `aespa（${topSubNames.filter((w) => w !== 'aespa').slice(0, 3).join('・') || 'エスパ'}）`
              : 'aespa';
        } else {
          displayKeyword = topSubNames.join('・');
        }
      }

      // Score gives high weight to non-YouTube services (Google Search, Maps, Gemini, NotebookLM) and multi-service overlap
      const nonYtCount =
        item.gSearchCount * 4 +
        item.mapsCount * 5 +
        item.geminiCount * 6 +
        item.notebookCount * 8 +
        item.ytSearchCount * 3;
      const diversityScore =
        item.services.size * 120 + nonYtCount + Math.min(item.ytWatchCount, 600);

      return {
        raw: item,
        resolvedGenre,
        matchedSubKeywords,
        displayKeyword,
        diversityScore,
      };
    })
    .sort((a, b) => b.diversityScore - a.diversityScore);

  // Pick top topics ensuring genre diversity (oshikatsu, money, hobby_culture, maps_outing, ai_tech_career, youtube_creator)
  const selectedCandidates: typeof allCandidates = [];
  const usedIds = new Set<string>();
  const priorityGenres: TopicGenre[] = [
    'oshikatsu',
    'money',
    'hobby_culture',
    'maps_outing',
    'ai_tech_career',
    'youtube_creator',
  ];

  // First pass: take #1 from each priority genre
  for (const g of priorityGenres) {
    const bestInGenre = allCandidates.find(
      (c) => c.resolvedGenre === g && !usedIds.has(c.raw.id)
    );
    if (bestInGenre) {
      selectedCandidates.push(bestInGenre);
      usedIds.add(bestInGenre.raw.id);
    }
  }

  // Second pass: fill remaining slots up to 12 with highest diversityScore
  for (const c of allCandidates) {
    if (selectedCandidates.length >= 12) break;
    if (!usedIds.has(c.raw.id)) {
      selectedCandidates.push(c);
      usedIds.add(c.raw.id);
    }
  }

  const topTopics: TopicSummary[] = selectedCandidates.map((c, idx) => {
    const data = c.raw;
    const evidenceId = `ev-topic-${idx + 1}`;
    const services = Array.from(data.services);
    const hourFreq = new Map<number, number>();
    data.hours.forEach((h) => hourFreq.set(h, (hourFreq.get(h) ?? 0) + 1));
    let topicPeakHour = peakHour;
    let maxH = 0;
    hourFreq.forEach((cnt, h) => {
      if (cnt > maxH) {
        maxH = cnt;
        topicPeakHour = h;
      }
    });

    const watchHours = Number((data.watchMinutes / 60).toFixed(1));

    evidenceCatalog[evidenceId] = {
      evidenceId,
      label: `「${c.displayKeyword}」(計${data.count}回)`,
      services,
      metric: `計${data.count}回 (${services.length}サービス)`,
      detail: `「${c.displayKeyword}」関連のアクティビティが計${data.count}回（内訳: ${c.matchedSubKeywords
        .map((s) => `${s.word} ${s.count}回`)
        .join(' / ')}）。`,
    };

    return {
      evidenceId,
      keyword: c.displayKeyword,
      genre: c.resolvedGenre,
      count: data.count,
      watchHours,
      ytWatchCount: data.ytWatchCount,
      ytSearchCount: data.ytSearchCount,
      gSearchCount: data.gSearchCount,
      mapsCount: data.mapsCount,
      geminiCount: data.geminiCount,
      notebookCount: data.notebookCount,
      matchedSubKeywords: c.matchedSubKeywords,
      services,
      peakHour: topicPeakHour,
      sampleTitles: data.sampleTitles,
    };
  });

  const spikes: ActivitySpike[] = Array.from(dateMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([date, data], idx) => {
      const evidenceId = `ev-spike-${idx + 1}`;
      const mainService = (Object.entries(data.serviceCounts).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] ?? 'youtube') as ServiceSource;
      const topKeyword =
        Array.from(data.keywords.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
        '動画・検索';

      const activeServices = (Object.entries(data.serviceCounts) as [
        ServiceSource,
        number,
      ][])
        .filter(([, cnt]) => cnt > 0)
        .map(([s]) => s);

      evidenceCatalog[evidenceId] = {
        evidenceId,
        label: `${date}（1日${data.count}件 / ${topKeyword}）`,
        services: activeServices,
        metric: `${date} (${data.count}件)`,
        detail: `${date}に「${topKeyword}」などを中心に1日${data.count}件。`,
      };

      return {
        evidenceId,
        date,
        count: data.count,
        mainService,
        topKeyword,
        sampleTitles: data.sampleTitles,
      };
    });

  const crossServicePatterns: CrossServicePattern[] = [];

  const monthlyTrends: MonthlyTrend[] = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([month, data], idx) => {
      const evidenceId = `ev-month-${idx + 1}`;
      const dominantService = (Object.entries(data.serviceCounts).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] ?? 'youtube') as ServiceSource;
      const topKeywords = Array.from(data.keywords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k]) => k);

      evidenceCatalog[evidenceId] = {
        evidenceId,
        label: `${month}（${topKeywords.join('・') || dominantService}）`,
        services: [dominantService],
        metric: `${month}: ${data.count}件`,
        detail: `${month}は計${data.count}件。`,
      };

      return {
        evidenceId,
        month,
        totalCount: data.count,
        dominantService,
        topKeywords,
      };
    });

  const startDate =
    sorted.length > 0
      ? sorted[0].timestamp.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const endDate =
    sorted.length > 0
      ? sorted[sorted.length - 1].timestamp.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const diffMs = Math.max(
    new Date(endDate).getTime() - new Date(startDate).getTime(),
    1000 * 60 * 60 * 24
  );
  const totalDays = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1, 1);

  // Build complete, unbiased raw digest for Gemini (Codex-style deep inspection)
  const ytWatchEvents = sorted.filter(
    (e) => e.source === 'youtube' && e.actionType === 'watch'
  );
  const ytSearchEvents = sorted.filter(
    (e) => e.source === 'youtube' && e.actionType === 'search'
  );
  const gSearchEvents = sorted.filter(
    (e) =>
      e.source === 'chrome' &&
      e.actionType === 'search' &&
      e.channelOrDomain !== 'Google画像検索'
  );
  const gImageSearchEvents = sorted.filter(
    (e) =>
      e.source === 'chrome' &&
      e.actionType === 'search' &&
      e.channelOrDomain === 'Google画像検索'
  );
  const geminiEvents = sorted.filter((e) => e.source === 'gemini');
  const notebookEvents = sorted.filter((e) => e.source === 'notebooklm');
  const mapsEvents = sorted.filter((e) => e.source === 'maps');

  const uniqueGSearchSet = new Set(
    gSearchEvents.map((e) => e.title.trim().toLowerCase())
  );

  const gSearchFreq = new Map<string, number>();
  const gSearchByDay = new Map<string, string[]>();
  for (const e of gSearchEvents) {
    const q = e.title.trim();
    if (!q) continue;
    gSearchFreq.set(q, (gSearchFreq.get(q) ?? 0) + 1);
    const day = new Date(new Date(e.timestamp).getTime() + 9 * 3600_000)
      .toISOString()
      .slice(0, 10);
    const arr = gSearchByDay.get(day) ?? [];
    if (!arr.includes(q)) arr.push(q);
    gSearchByDay.set(day, arr);
  }

  const ytSearchFreq = new Map<string, number>();
  for (const e of ytSearchEvents) {
    const q = e.title.trim();
    if (!q) continue;
    ytSearchFreq.set(q, (ytSearchFreq.get(q) ?? 0) + 1);
  }

  const mapsFreq = new Map<string, number>();
  for (const e of mapsEvents) {
    const p = e.title.trim();
    if (!p) continue;
    mapsFreq.set(p, (mapsFreq.get(p) ?? 0) + 1);
  }

  const geminiPatternCounts: Record<string, number> = {
    '根拠・出典・論文の確認(ソース/出典/根拠/論文/研究)': geminiEvents.filter((e) =>
      /ソース|出典|根拠|論文|研究|エビデンス|信頼/.test(e.title)
    ).length,
    '理由・仕組み・真偽の深掘り(なんで/なぜ/本当/事実/仕組み/構造)':
      geminiEvents.filter((e) => /なんで|なぜ|本当|事実|仕組み|構造/.test(e.title))
        .length,
    '投資・市場・アルゴリズムの質問(株/投資/銘柄/機関投資家/アルゴリズム/空売り/オプション/うねり)':
      geminiEvents.filter((e) =>
        /株|投資|銘柄|機関|アルゴリズム|空売り|オプション|うねり|ポートフォリオ|ファンダメンタル/.test(
          e.title
        )
      ).length,
    '企画・設計書・UI・配色の指定(アプリ/UI/設計書/仕様書/企画書/スライド/配色/#)':
      geminiEvents.filter((e) =>
        /アプリ|UI|設計書|仕様書|企画書|スライド|配色|#[0-9A-Fa-f]{6}|見切れ/.test(
          e.title
        )
      ).length,
    '人の心理・エンタメ・推される理由の考察(アイドル/推/ショート動画/心理/顧客)':
      geminiEvents.filter((e) =>
        /アイドル|推|ショート|心理|顧客|ジャーニー|人気/.test(e.title)
      ).length,
  };

  const googleSearchPatternCounts: Record<string, number> = {
    '株価・投資・銘柄・金融関連': gSearchEvents.filter((e) =>
      /株価|投資|銘柄|ビットコイン|\bbtc\b|メタプラ|テスラ|\bsofi\b|証券|\betf\b|\bnisa\b|決算|per|空売り/i.test(
        e.title
      )
    ).length,
    '書道・書法・千字文・日展・漢詩関連': gSearchEvents.filter((e) =>
      /書道|書法|千字文|日展|読売書法|書魁|隷書|楷書|行書|草書|篆書|陶淵明|漢詩|雑詩|高木聖雨|武田双雲|原田幹久|書遊|2尺|異体字|竹冠/.test(
        e.title
      )
    ).length,
    'aespa・メンバー関連': gSearchEvents.filter((e) =>
      /aespa|エスパ|ウィンター|カリナ|ニンニン|ジゼル/i.test(e.title)
    ).length,
    '雨来ズ関連': gSearchEvents.filter((e) => /雨来ズ|雨来ず/.test(e.title)).length,
  };

  // Select up to 180 most informative Gemini prompts (prioritizing longer/substantive ones + recent ones)
  const substantiveGeminiPrompts = [...geminiEvents]
    .filter((e) => e.title.trim().length >= 8)
    .sort((a, b) => {
      const aScore =
        (/ソース|信頼|機関|アルゴリズム|アイドル|推|#[0-9A-Fa-f]{6}|見切れ|設計書|企画書|エンドロール|うねり/.test(
          a.title
        )
          ? 500
          : 0) + Math.min(a.title.length, 200);
      const bScore =
        (/ソース|信頼|機関|アルゴリズム|アイドル|推|#[0-9A-Fa-f]{6}|見切れ|設計書|企画書|エンドロール|うねり/.test(
          b.title
        )
          ? 500
          : 0) + Math.min(b.title.length, 200);
      return bScore - aScore;
    })
    .slice(0, 160)
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .map((e) => ({
      date: e.timestamp.slice(0, 10),
      prompt: e.title.replace(/\s+/g, ' ').slice(0, 220),
    }));

  const notebooksDigest = notebookEvents.map((e) => {
    let sourceCount = 0;
    let sampleSources: string[] = [];
    if (e.subText) {
      try {
        const parsedSub = JSON.parse(e.subText) as {
          sourceCount?: number;
          sampleSources?: string[];
        };
        sourceCount = parsedSub.sourceCount ?? 0;
        sampleSources = parsedSub.sampleSources ?? [];
      } catch {
        // ignore
      }
    }
    return {
      title: e.title,
      date: e.timestamp.slice(0, 10),
      sourceCount,
      sampleSources,
    };
  });

  // Compute Time-of-Day Breakdown (what the user searches/watches in each time slot)
  const slotDefs = [
    { key: 'morning', label: '朝（5〜10時台）', match: (h: number) => h >= 5 && h <= 10 },
    { key: 'daytime', label: '昼（11〜16時台）', match: (h: number) => h >= 11 && h <= 16 },
    { key: 'evening', label: '夜（17〜22時台）', match: (h: number) => h >= 17 && h <= 22 },
    {
      key: 'lateNight',
      label: '深夜（23〜4時台）',
      match: (h: number) => h === 23 || (h >= 0 && h <= 4),
    },
  ];

  const timeOfDayBreakdown = slotDefs.map((slot) => {
    let slotCount = 0;
    const slotSearchMap = new Map<string, number>();
    const slotChannelMap = new Map<string, number>();

    for (const ev of sorted) {
      const dt = new Date(ev.timestamp);
      if (isNaN(dt.getTime())) continue;
      const h = new Date(dt.getTime() + 9 * 3600_000).getUTCHours();
      if (!slot.match(h)) continue;
      slotCount++;

      if (ev.actionType === 'search' || ev.source === 'maps') {
        const q = ev.title.trim();
        if (q && !isGarbageKeyword(q)) {
          slotSearchMap.set(q, (slotSearchMap.get(q) ?? 0) + 1);
        }
      } else if (ev.source === 'youtube' && ev.channelOrDomain) {
        slotChannelMap.set(
          ev.channelOrDomain,
          (slotChannelMap.get(ev.channelOrDomain) ?? 0) + 1
        );
      }
    }

    return {
      slot: slot.label,
      count: slotCount,
      ratioPct: Math.round((slotCount / Math.max(sorted.length, 1)) * 100),
      topSearches: Array.from(slotSearchMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([q, c]) => `${q}(${c}回)`),
      topChannels: Array.from(slotChannelMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([ch, c]) => `${ch}(${c}回)`),
    };
  });

  // Compute Past Booms (frequent in earlier 70% of history, rare/absent in recent 30%)
  const splitIdx = Math.floor(sorted.length * 0.7);
  const pastSlice = sorted.slice(0, splitIdx);
  const recentSlice = sorted.slice(splitIdx);

  const pastItemMap = new Map<
    string,
    {
      type: 'search' | 'youtube_channel' | 'gemini_topic' | 'maps';
      pastCount: number;
      recentCount: number;
      monthCounts: Map<string, number>;
      samples: string[];
    }
  >();

  const recordPeriodItem = (
    key: string,
    type: 'search' | 'youtube_channel' | 'gemini_topic' | 'maps',
    isPast: boolean,
    month: string,
    sampleTitle: string
  ) => {
    if (!key || isGarbageKeyword(key)) return;
    const entry = pastItemMap.get(key) ?? {
      type,
      pastCount: 0,
      recentCount: 0,
      monthCounts: new Map<string, number>(),
      samples: [],
    };
    if (isPast) {
      entry.pastCount++;
      entry.monthCounts.set(month, (entry.monthCounts.get(month) ?? 0) + 1);
    } else {
      entry.recentCount++;
    }
    if (entry.samples.length < 3 && !entry.samples.includes(sampleTitle)) {
      entry.samples.push(sampleTitle);
    }
    pastItemMap.set(key, entry);
  };

  for (const ev of pastSlice) {
    const m = ev.timestamp.slice(0, 7);
    if (ev.actionType === 'search') {
      const firstWord = ev.title.trim().split(/[\s　]+/)[0];
      recordPeriodItem(firstWord, 'search', true, m, ev.title);
    } else if (ev.source === 'youtube' && ev.channelOrDomain) {
      recordPeriodItem(ev.channelOrDomain, 'youtube_channel', true, m, ev.title);
    } else if (ev.source === 'maps') {
      recordPeriodItem(ev.title.trim(), 'maps', true, m, ev.title);
    }
  }

  for (const ev of recentSlice) {
    const m = ev.timestamp.slice(0, 7);
    if (ev.actionType === 'search') {
      const firstWord = ev.title.trim().split(/[\s　]+/)[0];
      recordPeriodItem(firstWord, 'search', false, m, ev.title);
    } else if (ev.source === 'youtube' && ev.channelOrDomain) {
      recordPeriodItem(ev.channelOrDomain, 'youtube_channel', false, m, ev.title);
    } else if (ev.source === 'maps') {
      recordPeriodItem(ev.title.trim(), 'maps', false, m, ev.title);
    }
  }

  const pastBooms = Array.from(pastItemMap.entries())
    .filter(
      ([, v]) =>
        v.pastCount >= 3 &&
        (v.recentCount === 0 || v.pastCount >= v.recentCount * 3.5)
    )
    .sort((a, b) => b[1].pastCount - a[1].pastCount)
    .slice(0, 20)
    .map(([item, v]) => {
      const peakPeriod =
        Array.from(v.monthCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        '過去';
      return {
        item,
        type: v.type,
        peakPeriod,
        pastCount: v.pastCount,
        recentCount: v.recentCount,
        sampleTitles: v.samples,
      };
    });

  // Monthly / Seasonal Breakdown
  const monthlyDetailMap = new Map<
    string,
    {
      totalCount: number;
      searches: Map<string, number>;
      channels: Map<string, number>;
      prompts: string[];
    }
  >();

  for (const ev of sorted) {
    const m = ev.timestamp.slice(0, 7);
    const cur = monthlyDetailMap.get(m) ?? {
      totalCount: 0,
      searches: new Map<string, number>(),
      channels: new Map<string, number>(),
      prompts: [],
    };
    cur.totalCount++;
    if (ev.actionType === 'search') {
      const q = ev.title.trim();
      if (q) cur.searches.set(q, (cur.searches.get(q) ?? 0) + 1);
    } else if (ev.source === 'youtube' && ev.channelOrDomain) {
      cur.channels.set(
        ev.channelOrDomain,
        (cur.channels.get(ev.channelOrDomain) ?? 0) + 1
      );
    } else if (ev.source === 'gemini' && cur.prompts.length < 3) {
      cur.prompts.push(ev.title.slice(0, 60));
    }
    monthlyDetailMap.set(m, cur);
  }

  const monthlyBreakdown = Array.from(monthlyDetailMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, data]) => ({
      month,
      totalCount: data.totalCount,
      topSearches: Array.from(data.searches.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([q, c]) => `${q}(${c})`),
      topChannels: Array.from(data.channels.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([ch, c]) => `${ch}(${c})`),
      samplePrompts: data.prompts,
    }));

  const aiRawDigest: AiRawDigest = {
    overview: {
      totalEvents: sorted.length,
      youtubeWatchCount: ytWatchEvents.length,
      uniqueYoutubeChannels: channelMap.size,
      youtubeSearchCount: ytSearchEvents.length,
      googleSearchCount: gSearchEvents.length,
      uniqueGoogleSearchQueries: uniqueGSearchSet.size,
      googleImageSearchCount: gImageSearchEvents.length,
      geminiPromptCount: geminiEvents.length,
      notebookLmCount: notebookEvents.length,
      mapsCount: mapsEvents.length,
    },
    notebooks: notebooksDigest,
    geminiPatternCounts,
    geminiPromptsChronological: substantiveGeminiPrompts,
    googleSearchPatternCounts,
    googleSearchTopQueries: Array.from(gSearchFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([query, count]) => ({ query, count })),
    googleSearchDailyBursts: Array.from(gSearchByDay.entries())
      .filter(([, qs]) => qs.length >= 5)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 20)
      .map(([date, qs]) => ({
        date,
        count: qs.length,
        queries: qs.slice(0, 18),
      })),
    youtubeTopChannels: Array.from(channelMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 30)
      .map(([name, obj]) => ({
        name,
        count: obj.count,
        hours: Number((obj.minutes / 60).toFixed(1)),
      })),
    youtubeTopSearches: Array.from(ytSearchFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([query, count]) => ({ query, count })),
    mapsTopPlaces: Array.from(mapsFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([place, count]) => ({ place, count })),
    timeOfDayBreakdown,
    pastBooms,
    monthlyBreakdown,
  };

  return {
    generatedAt: new Date().toISOString(),
    datasetLabel,
    sourceFiles,
    period: {
      startDate,
      endDate,
      totalDays,
    },
    totalEvents: sorted.length,
    serviceCounts,
    unconsciousStats,
    aiRawDigest,
    topChannels,
    hourlyDistribution,
    peakHour,
    lateNightRatio,
    weekendRatio,
    topTopics,
    spikes,
    crossServicePatterns,
    monthlyTrends,
    privacyStats,
    evidenceCatalog,
  };
}
