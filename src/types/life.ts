export type ServiceSource = 'youtube' | 'chrome' | 'gemini' | 'maps' | 'notebooklm';

export type ActionType =
  | 'watch'
  | 'search'
  | 'visit'
  | 'prompt'
  | 'location'
  | 'study_note';

export interface NormalizedEvent {
  id: string;
  source: ServiceSource;
  timestamp: string; // ISO 8601 string
  actionType: ActionType;
  title: string;
  channelOrDomain?: string;
  subText?: string;
}

export type TopicGenre =
  | 'oshikatsu'
  | 'money'
  | 'hobby_culture'
  | 'maps_outing'
  | 'ai_tech_career'
  | 'youtube_creator'
  | 'general';

export interface TopicSummary {
  evidenceId: string;
  keyword: string;
  genre?: TopicGenre;
  count: number;
  watchHours?: number;
  ytWatchCount?: number;
  ytSearchCount?: number;
  gSearchCount?: number;
  mapsCount?: number;
  geminiCount?: number;
  notebookCount?: number;
  matchedSubKeywords?: { word: string; count: number }[];
  services: ServiceSource[];
  peakHour: number;
  sampleTitles: string[];
}

export interface ActivitySpike {
  evidenceId: string;
  date: string; // YYYY-MM-DD
  count: number;
  hours?: number;
  mainService: ServiceSource;
  topKeyword: string;
  sampleTitles: string[];
}

export interface CrossServicePattern {
  evidenceId: string;
  services: ServiceSource[];
  patternTitle: string;
  metricSummary: string;
  detail: string;
}

export interface MonthlyTrend {
  evidenceId: string;
  month: string; // YYYY-MM
  totalCount: number;
  dominantService: ServiceSource;
  topKeywords: string[];
}

export interface BlockedItemSample {
  category:
    | '銀行・証券・決済'
    | '病院・医療・症状'
    | '認証・アカウント'
    | '住所・電話・個人情報'
    | '採用・転職・成人向け';
  source: ServiceSource;
  maskedTitle: string;
  matchedRule: string;
}

export interface PrivacyGuardStats {
  totalRawCount: number;
  filteredCount: number;
  passedCount: number;
  blockedCategories: {
    financeAndPayment: number;
    medicalAndHealth: number;
    authAndAccount: number;
    personalPII: number;
    recruitingAndAdult: number;
  };
  blockedSamples: BlockedItemSample[];
}

export interface SourceFileSummary {
  fileName: string;
  sizeBytes: number;
  entriesParsed: number;
  eventsExtracted: number;
}

export interface UnconsciousStats {
  totalWatchHours: number;
  totalDaysEquivalent: number;
  rapidSkip15sCount: number;
  rapidSkipRatioPct: number;
  maxSingleDayDate: string;
  maxSingleDayHours: number;
}

export interface AiRawDigest {
  overview: {
    totalEvents: number;
    youtubeWatchCount: number;
    uniqueYoutubeChannels: number;
    youtubeSearchCount: number;
    googleSearchCount: number;
    uniqueGoogleSearchQueries: number;
    googleImageSearchCount: number;
    geminiPromptCount: number;
    notebookLmCount: number;
    mapsCount: number;
  };
  notebooks: {
    title: string;
    date: string;
    sourceCount: number;
    sampleSources: string[];
  }[];
  geminiPatternCounts: Record<string, number>;
  geminiPromptsChronological: {
    date: string;
    prompt: string;
  }[];
  googleSearchPatternCounts: Record<string, number>;
  googleSearchTopQueries: { query: string; count: number }[];
  googleSearchDailyBursts: {
    date: string;
    count: number;
    queries: string[];
  }[];
  youtubeTopChannels: { name: string; count: number; hours: number }[];
  youtubeTopSearches: { query: string; count: number }[];
  mapsTopPlaces: { place: string; count: number }[];
  timeOfDayBreakdown?: {
    slot: string;
    count: number;
    ratioPct: number;
    topSearches: string[];
    topChannels: string[];
  }[];
  pastBooms?: {
    item: string;
    type: 'search' | 'youtube_channel' | 'gemini_topic' | 'maps';
    peakPeriod: string;
    pastCount: number;
    recentCount: number;
    sampleTitles: string[];
  }[];
  monthlyBreakdown?: {
    month: string;
    totalCount: number;
    topSearches: string[];
    topChannels: string[];
    samplePrompts: string[];
  }[];
}

export interface AggregatedProfile {
  generatedAt: string;
  datasetLabel: string;
  sourceFiles?: SourceFileSummary[];
  period: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  totalEvents: number;
  serviceCounts: Record<ServiceSource, number>;
  unconsciousStats?: UnconsciousStats;
  aiRawDigest?: AiRawDigest;
  topChannels: { name: string; count: number; hours?: number }[];
  hourlyDistribution: number[]; // length 24 (0..23)
  peakHour: number;
  lateNightRatio: number; // 0:00 - 4:59 percentage (0-100)
  weekendRatio: number; // Sat/Sun percentage (0-100)
  topTopics: TopicSummary[];
  spikes: ActivitySpike[];
  crossServicePatterns: CrossServicePattern[];
  monthlyTrends: MonthlyTrend[];
  privacyStats: PrivacyGuardStats;
  evidenceCatalog: Record<
    string,
    {
      evidenceId: string;
      label: string;
      services: ServiceSource[];
      metric: string;
      detail: string;
    }
  >;
}

export interface EraChapter {
  periodLabel: string;
  themeTitle: string;
  summary: string;
}

export interface ServiceBreakdownChip {
  service: string;
  stat: string;
}

export interface DiscoveryItem {
  id: string;
  headline: string;
  factStatement: string;
  metricLabel: string;
  categoryTag: string;
  serviceBreakdown?: ServiceBreakdownChip[];
  evidenceIds: string[];
  enabled?: boolean;
}

export interface LifeCardProposal {
  catchphrase: string;
  eraChapters: EraChapter[];
  discoveries: DiscoveryItem[];
  analysisSource?: 'gemini-api' | 'local-fallback';
  lastSystemPrompt?: string;
  validationReport?: {
    totalGenerated: number;
    verifiedCount: number;
    droppedCount: number;
  };
}

export type CardTheme = 'midnight-endroll' | 'bereal-pop' | 'minimal-card';

export interface UnifiedTakeoutExport {
  version: '1.0';
  exportedAt: string;
  normalizedEvents: NormalizedEvent[];
  aggregatedProfile: AggregatedProfile;
}
