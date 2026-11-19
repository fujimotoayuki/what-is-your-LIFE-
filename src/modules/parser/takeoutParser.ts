import JSZip from 'jszip';
import {
  ActionType,
  AggregatedProfile,
  NormalizedEvent,
  ServiceSource,
  SourceFileSummary,
  UnifiedTakeoutExport,
} from '../../types/life';
import { aggregateEvents } from './aggregator';
import { applyPrivacyGuard } from './privacyGuard';
import { getSampleRawEvents } from './sampleData';

function detectServiceFromPathOrContent(
  path: string,
  contentSample = ''
): ServiceSource | null {
  const lowerPath = path.toLowerCase();

  if (
    lowerPath.includes('archive_browser') ||
    lowerPath.includes('アーカイブの概要') ||
    lowerPath.includes('readme') ||
    lowerPath.includes('index.html') ||
    (lowerPath.includes('notebooklm') &&
      lowerPath.includes('/sources/') &&
      lowerPath.endsWith('.html')) ||
    lowerPath.includes('ブックマーク.html') ||
    lowerPath.includes('リーディング リスト.html') ||
    lowerPath.includes('拡張機能.json') ||
    lowerPath.includes('デバイス情報.json') ||
    lowerPath.includes('os の設定.json') ||
    lowerPath.includes('住所やその他の情報.json')
  ) {
    return null;
  }

  const combined = `${lowerPath} ${contentSample.slice(0, 500).toLowerCase()}`;

  if (combined.includes('notebooklm')) return 'notebooklm';
  if (
    combined.includes('gemini') ||
    combined.includes('bard') ||
    lowerPath.includes('gemini')
  ) {
    return 'gemini';
  }
  if (
    lowerPath.includes('/マップ/') ||
    lowerPath.includes('/maps/') ||
    lowerPath.includes('location history') ||
    lowerPath.includes('ロケーション履歴') ||
    lowerPath.includes('timeline') ||
    lowerPath.includes('タイムライン') ||
    lowerPath.includes('saved') ||
    lowerPath.includes('保存済み')
  ) {
    return 'maps';
  }
  if (
    lowerPath.includes('youtube') ||
    lowerPath.includes('watch-history') ||
    lowerPath.includes('search-history') ||
    lowerPath.includes('再生履歴') ||
    lowerPath.includes('視聴履歴') ||
    lowerPath.includes('登録チャンネル') ||
    lowerPath.includes('subscriptions')
  ) {
    return 'youtube';
  }
  // マイ アクティビティ/検索/ (Safari等のGoogle検索履歴) や Chrome 履歴
  if (
    lowerPath.includes('マイ アクティビティ/検索') ||
    lowerPath.includes('my activity/search') ||
    lowerPath.includes('マイアクティビティ') ||
    lowerPath.includes('myactivity') ||
    lowerPath.includes('chrome') ||
    lowerPath.includes('browserhistory') ||
    lowerPath.includes('履歴.json') ||
    lowerPath.includes('history.json') ||
    combined.includes('"browser history"')
  ) {
    return 'chrome';
  }

  return null;
}

function defaultActionTypeForService(
  source: ServiceSource,
  rawTitle: string,
  path = ''
): ActionType {
  if (source === 'youtube') {
    if (
      rawTitle.includes('を検索しました') ||
      /^Searched for\s+/i.test(rawTitle) ||
      path.includes('検索履歴') ||
      path.toLowerCase().includes('search-history')
    ) {
      return 'search';
    }
    return 'watch';
  }
  if (source === 'chrome') {
    return rawTitle.includes('を検索しました') ||
      rawTitle.includes(' - Google 検索') ||
      /^Searched for\s+/i.test(rawTitle) ||
      path.includes('画像検索') ||
      rawTitle.toLowerCase().includes('google.com/search')
      ? 'search'
      : 'visit';
  }
  if (source === 'gemini') return 'prompt';
  if (source === 'maps') return 'location';
  return 'study_note';
}

function cleanYouTubeOrActivityTitle(raw: string): string {
  return raw
    .replace(/^(Watched|Searched for|Visited|Prompted|Viewed)\s+/i, '')
    .replace(/^送信したメッセージ:\s*/i, '')
    .replace(/^マイマップ地図を開きました:\s*/i, '')
    .replace(/^経路:\s*/i, '')
    .replace(
      /\s*(を視聴しました|を検索しました|にアクセスしました|を表示しました|を使用しました)\s*$/,
      ''
    )
    .replace(/^「\s*/, '')
    .replace(/\s*」$/, '')
    .replace(/〒?\d{3}-\d{4}\s*/g, '')
    .trim();
}

function extractDomain(urlStr?: string): string | undefined {
  if (!urlStr) return undefined;
  try {
    const u = new URL(urlStr);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function parseTakeoutTimestamp(raw: unknown): string | null {
  if (typeof raw === 'number') {
    if (raw > 1e14) {
      return new Date(Math.floor(raw / 1000)).toISOString();
    }
    if (raw < 1e11) {
      return new Date(raw * 1000).toISOString();
    }
    return new Date(raw).toISOString();
  }

  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d{13,17}$/.test(trimmed)) {
    const n = Number(trimmed);
    return new Date(n > 1e14 ? Math.floor(n / 1000) : n).toISOString();
  }

  const direct = new Date(trimmed);
  if (!isNaN(direct.getTime()) && trimmed.includes('-')) {
    return direct.toISOString();
  }

  const jpMatch = trimmed.match(
    /(\d{4})[\/\-年]\s*(\d{1,2})[\/\-月]\s*(\d{1,2})日?\s*(午前|午後|AM|PM)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(午前|午後|AM|PM)?/i
  );
  if (jpMatch) {
    const year = Number(jpMatch[1]);
    const month = Number(jpMatch[2]);
    const day = Number(jpMatch[3]);
    const ampm = (jpMatch[4] || jpMatch[8] || '').toUpperCase();
    let hour = Number(jpMatch[5]);
    const minute = Number(jpMatch[6]);
    const second = Number(jpMatch[7] || '0');

    if ((ampm === '午後' || ampm === 'PM') && hour < 12) hour += 12;
    if ((ampm === '午前' || ampm === 'AM') && hour === 12) hour = 0;

    const pad = (n: number) => String(n).padStart(2, '0');
    const isoJst = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(
      minute
    )}:${pad(second)}+09:00`;
    const dt = new Date(isoJst);
    if (!isNaN(dt.getTime())) {
      return dt.toISOString();
    }
  }

  const cleanedEn = trimmed.replace(/\s+(JST|UTC|GMT)$/i, '');
  const enDate = new Date(cleanedEn);
  if (!isNaN(enDate.getTime())) {
    return enDate.toISOString();
  }

  return null;
}

function parseJsonContent(
  path: string,
  text: string,
  notebookSourceMap?: Map<string, { count: number; samples: string[] }>
): NormalizedEvent[] {
  const parsed = JSON.parse(text);

  if (parsed && Array.isArray(parsed.normalizedEvents)) {
    return parsed.normalizedEvents as NormalizedEvent[];
  }

  if (
    parsed &&
    !Array.isArray(parsed) &&
    typeof parsed === 'object' &&
    typeof parsed.title === 'string' &&
    parsed.metadata &&
    typeof parsed.metadata === 'object'
  ) {
    const title = parsed.title.trim();
    if (
      !title ||
      title.includes('403 Forbidden') ||
      title.includes('Attention Required!') ||
      title.includes('Page Not Found') ||
      title.includes('ERROR:')
    ) {
      return [];
    }
    const isMainNotebook = !path.includes('/Sources/');
    if (!isMainNotebook) return [];

    const folderMatch = path.match(/NotebookLM\/([^\/]+)\//i);
    const folderName = folderMatch ? folderMatch[1] : '';
    const sourceInfo = folderName ? notebookSourceMap?.get(folderName) : undefined;

    const meta = parsed.metadata as Record<string, unknown>;
    const ts =
      parseTakeoutTimestamp(
        meta.lastViewed || meta.createTime || meta.sourceAddedTimestamp
      ) || new Date().toISOString();

    return [
      {
        id: `notebooklm-${parsed.id || title}`,
        source: 'notebooklm',
        timestamp: ts,
        actionType: 'study_note',
        title: `${parsed.emoji ? `${parsed.emoji} ` : ''}${title}`,
        channelOrDomain: 'NotebookLM',
        subText: sourceInfo
          ? JSON.stringify({
              sourceCount: sourceInfo.count,
              sampleSources: sourceInfo.samples.slice(0, 5),
            })
          : undefined,
      },
    ];
  }

  const rawList: Record<string, unknown>[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.['Browser History'])
    ? parsed['Browser History']
    : Array.isArray(parsed?.features)
    ? parsed.features
    : Array.isArray(parsed?.items)
    ? parsed.items
    : [];

  const serviceFromPath = detectServiceFromPathOrContent(path, text);
  const results: NormalizedEvent[] = [];

  rawList.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;

    if (
      typeof item.title === 'string' &&
      typeof item.source === 'string' &&
      typeof item.timestamp === 'string'
    ) {
      const ts = parseTakeoutTimestamp(item.timestamp);
      if (!ts) return;
      results.push({
        id: String(item.id || `json-${idx}`),
        source: item.source as ServiceSource,
        timestamp: ts,
        actionType:
          (item.actionType as ActionType) ||
          defaultActionTypeForService(item.source as ServiceSource, item.title, path),
        title: item.title,
        channelOrDomain:
          typeof item.channelOrDomain === 'string' ? item.channelOrDomain : undefined,
        subText: typeof item.subText === 'string' ? item.subText : undefined,
      });
      return;
    }

    const headerStr = String(item.header || '');
    const source =
      (headerStr ? detectServiceFromPathOrContent(path, headerStr) : null) ||
      serviceFromPath;
    if (!source) return;

    const detailsStr = JSON.stringify(item.details || '');
    if (
      detailsStr.includes('Google 広告') ||
      detailsStr.includes('From Google Ads')
    ) {
      return;
    }

    const rawTitleOrig = String(
      item.title || item.name || item.query || item.prompt || ''
    ).trim();
    const cleanedTitle = cleanYouTubeOrActivityTitle(rawTitleOrig);

    if (
      !cleanedTitle ||
      cleanedTitle === 'を視聴しました' ||
      cleanedTitle.includes('を定期購入しました') ||
      /^Subscribed to\s+/i.test(cleanedTitle) ||
      cleanedTitle.includes('削除された動画') ||
      cleanedTitle.toLowerCase().includes('video that has been removed') ||
      cleanedTitle.startsWith('http://') ||
      cleanedTitle.startsWith('https://') ||
      cleanedTitle === 'ログイン' ||
      cleanedTitle.startsWith('Sign In') ||
      cleanedTitle.startsWith('受信トレイ') ||
      cleanedTitle === 'Google マップで周辺のスポットを探索' ||
      cleanedTitle === 'マップ' ||
      cleanedTitle === 'Want to go' ||
      cleanedTitle === '選択された回答案' ||
      cleanedTitle.includes('フィードバックを消去') ||
      cleanedTitle.startsWith('使用: ') ||
      /^\d+\s*件のスポット$/.test(cleanedTitle)
    ) {
      return;
    }

    const timestamp = parseTakeoutTimestamp(
      item.time || item.time_usec || item.timestamp || item.created_at
    );
    if (!timestamp) return;

    const actionType = defaultActionTypeForService(source, rawTitleOrig, path);

    const subtitlesArr = Array.isArray(item.subtitles)
      ? (item.subtitles as Record<string, unknown>[])
          .map((s) => String(s?.name || '').trim())
          .filter(Boolean)
      : [];
    const channelName = subtitlesArr[0];

    const urlStr = String(item.url || item.titleUrl || item.subText || '');
    const channelOrDomain =
      source === 'youtube'
        ? channelName && !/youtube\.com|youtu\.be|^https?:/i.test(channelName)
          ? channelName
          : undefined
        : source === 'chrome' && actionType === 'search'
        ? path.includes('画像検索') || headerStr.includes('画像検索')
          ? 'Google画像検索'
          : 'Google検索'
        : channelName || extractDomain(urlStr);

    results.push({
      id: `${source}-json-${idx}`,
      source,
      timestamp,
      actionType,
      title: cleanedTitle,
      channelOrDomain,
      subText: urlStr || undefined,
    });
  });

  return results;
}

function parseHtmlContent(path: string, htmlText: string): NormalizedEvent[] {
  const source = detectServiceFromPathOrContent(path, htmlText);
  if (!source) return [];

  const results: NormalizedEvent[] = [];
  const outerRegex = /<div class="outer-cell[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;

  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = outerRegex.exec(htmlText)) !== null) {
    const block = match[0];

    if (
      block.includes('Google 広告から') ||
      block.includes('From Google Ads')
    ) {
      continue;
    }

    const bodyMatch = block.match(
      /<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">([\s\S]*?)<\/div>/
    );
    if (!bodyMatch) continue;
    const inner = bodyMatch[1];

    const links: { url: string; text: string }[] = [];
    const aRegex = /<a href="([^"]*)">([\s\S]*?)<\/a>/g;
    let am: RegExpExecArray | null;
    while ((am = aRegex.exec(inner)) !== null) {
      links.push({
        url: am[1],
        text: am[2]
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .trim(),
      });
    }

    const textLines = inner
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const dateLine = textLines[textLines.length - 1] || '';
    const ts = parseTakeoutTimestamp(dateLine);
    if (!ts) continue;

    // Gemini マイアクティビティ等では <a> タグがなくプレーンテキスト「Prompted ...」の場合がある
    const rawPrimary =
      links[0]?.text || cleanYouTubeOrActivityTitle(textLines[0] || '');
    const primaryTitle = cleanYouTubeOrActivityTitle(rawPrimary);
    const primaryHref = links[0]?.url || '';
    const secondaryChannel = links[1]?.text;

    if (
      !primaryTitle ||
      primaryTitle.includes('を定期購入しました') ||
      /^Subscribed to\s+/i.test(primaryTitle) ||
      primaryTitle.includes('削除された動画') ||
      primaryTitle.startsWith('http://') ||
      primaryTitle.startsWith('https://') ||
      /\.mp4$/i.test(primaryTitle) ||
      primaryTitle.startsWith('Shortened:') ||
      primaryTitle === 'Google マップで周辺のスポットを探索' ||
      primaryTitle === 'Want to go' ||
      primaryTitle.startsWith('使用: ')
    ) {
      continue;
    }

    const isSearch =
      inner.includes('を検索しました') ||
      inner.includes('Searched for') ||
      path.includes('検索履歴') ||
      path.includes('/検索/') ||
      path.includes('画像検索') ||
      path.toLowerCase().includes('search');

    const actionType: ActionType =
      source === 'youtube' || source === 'chrome'
        ? isSearch
          ? 'search'
          : source === 'youtube'
          ? 'watch'
          : 'visit'
        : defaultActionTypeForService(source, inner, path);

    results.push({
      id: `${source}-html-${idx++}`,
      source,
      timestamp: ts,
      actionType,
      title: primaryTitle,
      channelOrDomain:
        source === 'youtube'
          ? secondaryChannel &&
            !/youtube\.com|youtu\.be|^https?:/i.test(secondaryChannel)
            ? secondaryChannel
            : undefined
          : secondaryChannel ||
            (isSearch && source === 'chrome'
              ? 'Google検索'
              : extractDomain(primaryHref)),
      subText: primaryHref || undefined,
    });
  }

  return results;
}

function parseCsvContent(path: string, csvText: string): NormalizedEvent[] {
  const source = detectServiceFromPathOrContent(path, csvText);
  if (!source) return [];

  if (
    path.includes('登録チャンネル') ||
    path.includes('再生リスト') ||
    path.includes('チャンネル') ||
    path.includes('コメント') ||
    path.includes('チャット')
  ) {
    return [];
  }

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [];

  const results: NormalizedEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]
      .split(',')
      .map((c) => c.replace(/^"|"$/g, '').trim());
    const title = cols[0] || cols[1];
    if (!title) continue;
    const maybeDate = cols.find((c) => /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(c));
    const ts = maybeDate ? parseTakeoutTimestamp(maybeDate) : null;
    if (!ts) continue;

    results.push({
      id: `${source}-csv-${i}`,
      source,
      timestamp: ts,
      actionType: defaultActionTypeForService(source, title, path),
      title,
      subText: cols[2] || cols[1] || undefined,
    });
  }
  return results;
}

export async function parseUploadedTakeoutFiles(
  files: File[],
  onProgress?: (msg: string) => void
): Promise<{
  normalizedEvents: NormalizedEvent[];
  aggregatedProfile: AggregatedProfile;
}> {
  const rawEvents: NormalizedEvent[] = [];
  const sourceFiles: SourceFileSummary[] = [];

  for (const file of files) {
    const lowerName = file.name.toLowerCase();
    let fileExtractedCount = 0;
    let entriesParsed = 0;

    onProgress?.(
      `ファイルを展開中: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`
    );

    if (lowerName.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(file);

      // Pre-count NotebookLM sources per notebook folder
      const notebookSourceMap = new Map<
        string,
        { count: number; samples: string[] }
      >();
      for (const path of Object.keys(zip.files)) {
        const m = path.match(
          /NotebookLM\/([^\/]+)\/Sources\/(.+?)\s+metadata\.json$/i
        );
        if (m) {
          const folder = m[1];
          const srcTitle = m[2].trim();
          const cur = notebookSourceMap.get(folder) ?? {
            count: 0,
            samples: [],
          };
          cur.count++;
          if (cur.samples.length < 6 && srcTitle) {
            cur.samples.push(srcTitle);
          }
          notebookSourceMap.set(folder, cur);
        }
      }

      const entries = Object.entries(zip.files).filter(
        ([name, entry]) =>
          !entry.dir &&
          /\.(json|html|htm|csv)$/i.test(name) &&
          !name.includes('__MACOSX') &&
          !name.toLowerCase().includes('archive_browser') &&
          !name.includes('アーカイブの概要')
      );

      for (const [path, entry] of entries) {
        try {
          if (!detectServiceFromPathOrContent(path)) continue;
          const content = await entry.async('string');
          let extracted: NormalizedEvent[] = [];
          if (path.toLowerCase().endsWith('.json')) {
            extracted = parseJsonContent(path, content, notebookSourceMap);
          } else if (/\.html?$/i.test(path)) {
            extracted = parseHtmlContent(path, content);
          } else if (path.toLowerCase().endsWith('.csv')) {
            extracted = parseCsvContent(path, content);
          }
          if (extracted.length > 0) {
            entriesParsed++;
            fileExtractedCount += extracted.length;
            rawEvents.push(...extracted);
            onProgress?.(
              `履歴データを抽出: ${path.split('/').slice(-2).join('/')} (${extracted.length.toLocaleString()}件)`
            );
          }
        } catch {
          // ignore
        }
      }
    } else if (lowerName.endsWith('.json')) {
      const text = await file.text();
      const maybeUnified = JSON.parse(text) as Partial<UnifiedTakeoutExport>;
      if (
        maybeUnified &&
        Array.isArray(maybeUnified.normalizedEvents) &&
        maybeUnified.aggregatedProfile &&
        files.length === 1
      ) {
        return {
          normalizedEvents: maybeUnified.normalizedEvents,
          aggregatedProfile: maybeUnified.aggregatedProfile,
        };
      }
      const extracted = parseJsonContent(file.name, text);
      entriesParsed = 1;
      fileExtractedCount = extracted.length;
      rawEvents.push(...extracted);
    } else if (/\.html?$/i.test(lowerName)) {
      const text = await file.text();
      const extracted = parseHtmlContent(file.name, text);
      entriesParsed = 1;
      fileExtractedCount = extracted.length;
      rawEvents.push(...extracted);
    } else if (lowerName.endsWith('.csv')) {
      const text = await file.text();
      const extracted = parseCsvContent(file.name, text);
      entriesParsed = 1;
      fileExtractedCount = extracted.length;
      rawEvents.push(...extracted);
    }

    sourceFiles.push({
      fileName: file.name,
      sizeBytes: file.size,
      entriesParsed,
      eventsExtracted: fileExtractedCount,
    });
  }

  if (rawEvents.length === 0) {
    throw new Error(
      'ZIPファイル内に対象サービス（YouTube / Google検索 / Chrome / Gemini / Maps / NotebookLM）の履歴データが見つかりませんでした。'
    );
  }

  const dedupMap = new Map<string, NormalizedEvent>();
  rawEvents.forEach((ev, i) => {
    const key = `${ev.source}|${ev.timestamp}|${ev.title}`;
    if (!dedupMap.has(key)) {
      dedupMap.set(key, {
        ...ev,
        id: `${ev.source}-${i + 1}`,
      });
    }
  });
  const uniqueRawEvents = Array.from(dedupMap.values());

  const { safeEvents, stats } = applyPrivacyGuard(uniqueRawEvents);
  const label =
    files.length === 1
      ? files[0].name
      : `${files.length}個のファイル (${files.map((f) => f.name).join(', ')})`;

  const aggregatedProfile = aggregateEvents(safeEvents, stats, label, sourceFiles);
  return {
    normalizedEvents: safeEvents,
    aggregatedProfile,
  };
}

export interface SampleDatasetInfo {
  id: 'sauna-spice' | 'coffee-architect' | 'indiegame-dtm';
  label: string;
  description: string;
}

export const SAMPLE_DATASETS: SampleDatasetInfo[] = [
  {
    id: 'sauna-spice',
    label: 'サウナ×スパイス×自作キーボード',
    description: '深夜型・44件の小さなデータ',
  },
  {
    id: 'coffee-architect',
    label: '古民家再生×コーヒー',
    description: '建築・DIY系・約1,500件',
  },
  {
    id: 'indiegame-dtm',
    label: 'インディーゲーム×DTM',
    description: 'ゲーム開発・作曲系・約1,200件',
  },
];

/** Load one of the bundled sample datasets (zips are served from /samples/). */
export async function loadSampleDatasetById(
  id: SampleDatasetInfo['id'],
  onProgress?: (msg: string) => void
): Promise<{ normalizedEvents: NormalizedEvent[]; aggregatedProfile: AggregatedProfile }> {
  if (id === 'sauna-spice') return loadSampleLifeDataset();
  const res = await fetch(`/samples/${id}.zip`);
  if (!res.ok) throw new Error(`サンプルデータ（${id}）の読み込みに失敗しました`);
  const file = new File([await res.blob()], `sample-${id}.zip`);
  const out = await parseUploadedTakeoutFiles([file], onProgress);
  const info = SAMPLE_DATASETS.find((d) => d.id === id);
  out.aggregatedProfile.datasetLabel = `サンプルデータ（${info?.label || id}）`;
  return out;
}

export function loadSampleLifeDataset(): {
  normalizedEvents: NormalizedEvent[];
  aggregatedProfile: AggregatedProfile;
} {
  const rawEvents = getSampleRawEvents();
  const { safeEvents, stats } = applyPrivacyGuard(rawEvents);
  const sampleSources: SourceFileSummary[] = [
    {
      fileName: 'takeout-sample-001.zip',
      sizeBytes: 18_450_200,
      entriesParsed: 5,
      eventsExtracted: safeEvents.length,
    },
  ];
  const aggregatedProfile = aggregateEvents(
    safeEvents,
    stats,
    'サンプルデータ',
    sampleSources
  );
  return {
    normalizedEvents: safeEvents,
    aggregatedProfile,
  };
}
