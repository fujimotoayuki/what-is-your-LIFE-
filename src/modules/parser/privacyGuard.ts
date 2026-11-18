import { NormalizedEvent, PrivacyGuardStats } from '../../types/life';

/**
 * 誤爆（過剰削除）を防ぐため、厳密なドメイン・明確な機微フレーズのみに限定。
 * ※以前のように「うつ」（どうぶつ・うつくしい等に誤爆）や単なる「login」（技術記事等に誤爆）では除外しない。
 * ※また、YouTubeの通常の動画視聴（source === 'youtube'）は原則として成人向け以外はブロックしない。
 */
const FINANCE_PATTERNS = [
  /bk\.mufg\.jp/i,
  /direct\.smbc\.co\.jp/i,
  /mizuhobank\.co\.jp/i,
  /rakuten-bank\.co\.jp/i,
  /rakuten-sec\.co\.jp/i,
  /sbisec\.co\.jp/i,
  /monex\.co\.jp/i,
  / اینترنتバンキング/,
  /インターネットバンキング/,
  /口座残高照会/,
  /クレジットカード明細/,
  /キャッシング枠/,
];

const MEDICAL_PATTERNS = [
  /心療内科/,
  /精神科クリニック/,
  /処方箋\s*予約/,
  /うつ病\s*(診断|治療|症状)/,
  /性感染症\s*検査/,
];

const AUTH_PATTERNS = [
  /accounts\.google\.com\/signin/i,
  /パスワード再設定/,
  /二段階認証\s*コード/,
  /ワンタイムパスワード/,
];

const RECRUITING_OR_ADULT_PATTERNS = [
  /bizreach\.jp/i,
  /rikunabi\.com/i,
  /mynavi\.jp/i,
  /doda\.jp/i,
  /職務経歴書\s*作成/,
  /退職届\s*書き方/,
  /xvideos/i,
  /pornhub/i,
  /fanza/i,
  /dmm\.co\.jp\/adult/i,
];

const PII_PATTERNS = [
  /〒\d{3}-\d{4}/,
  /0[789]0-\d{4}-\d{4}/,
  /[都道府県].+?[市区町村].+?\d+丁目\d+番\d+号/,
  /マイナンバーカード\s*番号/,
];

function maskSensitiveText(text: string): string {
  return text
    .replace(/〒?\d{3}-\d{4}/g, '〒***-****')
    .replace(/0\d{1,4}-\d{1,4}-\d{4}/g, '0**-****-****')
    .replace(/\d+丁目\d+番\d*号?/g, '*丁目*番*号')
    .slice(0, 60);
}

export function applyPrivacyGuard(rawEvents: NormalizedEvent[]): {
  safeEvents: NormalizedEvent[];
  stats: PrivacyGuardStats;
} {
  const stats: PrivacyGuardStats = {
    totalRawCount: rawEvents.length,
    filteredCount: 0,
    passedCount: 0,
    blockedCategories: {
      financeAndPayment: 0,
      medicalAndHealth: 0,
      authAndAccount: 0,
      personalPII: 0,
      recruitingAndAdult: 0,
    },
    blockedSamples: [],
  };

  const safeEvents: NormalizedEvent[] = [];

  for (const ev of rawEvents) {
    const combinedText = `${ev.title} ${ev.channelOrDomain ?? ''} ${ev.subText ?? ''}`;

    const matchedFinance = FINANCE_PATTERNS.find((rx) => rx.test(combinedText));
    if (matchedFinance) {
      stats.filteredCount++;
      stats.blockedCategories.financeAndPayment++;
      if (stats.blockedSamples.length < 30) {
        stats.blockedSamples.push({
          category: '銀行・証券・決済',
          source: ev.source,
          maskedTitle: maskSensitiveText(ev.title),
          matchedRule: String(matchedFinance),
        });
      }
      continue;
    }

    const matchedMedical = MEDICAL_PATTERNS.find((rx) => rx.test(combinedText));
    if (matchedMedical) {
      stats.filteredCount++;
      stats.blockedCategories.medicalAndHealth++;
      if (stats.blockedSamples.length < 30) {
        stats.blockedSamples.push({
          category: '病院・医療・症状',
          source: ev.source,
          maskedTitle: maskSensitiveText(ev.title),
          matchedRule: String(matchedMedical),
        });
      }
      continue;
    }

    const matchedAuth = AUTH_PATTERNS.find((rx) => rx.test(combinedText));
    if (matchedAuth) {
      stats.filteredCount++;
      stats.blockedCategories.authAndAccount++;
      if (stats.blockedSamples.length < 30) {
        stats.blockedSamples.push({
          category: '認証・アカウント',
          source: ev.source,
          maskedTitle: maskSensitiveText(ev.title),
          matchedRule: String(matchedAuth),
        });
      }
      continue;
    }

    const matchedPii = PII_PATTERNS.find((rx) => rx.test(combinedText));
    if (matchedPii) {
      stats.filteredCount++;
      stats.blockedCategories.personalPII++;
      if (stats.blockedSamples.length < 30) {
        stats.blockedSamples.push({
          category: '住所・電話・個人情報',
          source: ev.source,
          maskedTitle: maskSensitiveText(ev.title),
          matchedRule: String(matchedPii),
        });
      }
      continue;
    }

    const matchedRecruit = RECRUITING_OR_ADULT_PATTERNS.find((rx) =>
      rx.test(combinedText)
    );
    if (matchedRecruit) {
      stats.filteredCount++;
      stats.blockedCategories.recruitingAndAdult++;
      if (stats.blockedSamples.length < 30) {
        stats.blockedSamples.push({
          category: '採用・転職・成人向け',
          source: ev.source,
          maskedTitle: maskSensitiveText(ev.title),
          matchedRule: String(matchedRecruit),
        });
      }
      continue;
    }

    safeEvents.push(ev);
    stats.passedCount++;
  }

  return { safeEvents, stats };
}
