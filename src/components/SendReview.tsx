import React, { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { AggregatedProfile } from '../types/life';
import { buildSystemPrompt } from '../modules/analyzer/geminiAnalyzer';

interface SendReviewProps {
  profile: AggregatedProfile;
  onApprove: () => void;
  onCancel: () => void;
}

/** Shows exactly what will be sent to Gemini and waits for the user's OK. */
export const SendReview: React.FC<SendReviewProps> = ({ profile, onApprove, onCancel }) => {
  const prompt = useMemo(() => buildSystemPrompt(profile), [profile]);
  const d = profile.aiRawDigest;
  const p = profile.privacyStats;

  const sections = [
    { label: 'Google検索ワード（上位）', count: d?.googleSearchTopQueries.length ?? 0, sample: d?.googleSearchTopQueries.slice(0, 5).map((q) => q.query) },
    { label: 'YouTubeチャンネル（上位）', count: d?.youtubeTopChannels.length ?? 0, sample: d?.youtubeTopChannels.slice(0, 5).map((c) => c.name) },
    { label: 'YouTube検索ワード', count: d?.youtubeTopSearches.length ?? 0, sample: d?.youtubeTopSearches.slice(0, 5).map((q) => q.query) },
    { label: 'Geminiに送った文', count: d?.geminiPromptsChronological.length ?? 0, sample: d?.geminiPromptsChronological.slice(0, 3).map((x) => x.prompt) },
    { label: 'マップの場所', count: d?.mapsTopPlaces.length ?? 0, sample: d?.mapsTopPlaces.slice(0, 5).map((x) => x.place) },
    { label: 'NotebookLMのノート名', count: d?.notebooks.length ?? 0, sample: d?.notebooks.slice(0, 3).map((n) => n.title) },
  ].filter((s) => s.count > 0);

  return (
    <div className="space-y-6">
      <div className="border border-black rounded-2xl p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 shrink-0" />
          <h2 className="text-lg font-bold">Geminiに送る内容を確認してください</h2>
        </div>

        <p className="text-sm leading-relaxed text-neutral-700">
          ZIPの読み込みと集計はこの端末の中だけで行いました。ここから先、下の集計データを
          <strong>Google の Gemini API</strong> に送って6つの特徴を分析します。
          あなたが「送信する」を押すまで、何も送られません。
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <Stat label="読み込んだ履歴" value={`${p.totalRawCount.toLocaleString()}件`} />
          <Stat label="除外した項目" value={`${p.filteredCount.toLocaleString()}件`} hint="お金・医療・認証・個人情報など" />
          <Stat label="送信するデータ量" value={`約${Math.round(prompt.length / 1000)}千文字`} />
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold">送信に含まれるもの</div>
          {sections.map((s) => (
            <div key={s.label} className="border border-neutral-200 rounded-lg p-3">
              <div className="text-xs font-bold">
                {s.label} <span className="font-normal text-neutral-500">（{s.count}件）</span>
              </div>
              <div className="text-[11px] text-neutral-600 mt-1 break-words">
                例: {s.sample?.join(' / ')}
              </div>
            </div>
          ))}
          <div className="text-[11px] text-neutral-500">
            ほかに、期間・時間帯別の件数・月ごとの推移・YouTube視聴時間などの集計値も含まれます。
          </div>
        </div>

        <details className="text-xs">
          <summary className="cursor-pointer font-bold">送信する全文を見る</summary>
          <pre className="mt-2 max-h-80 overflow-auto bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-[10px] whitespace-pre-wrap break-words">
            {prompt}
          </pre>
        </details>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 leading-relaxed">
          無料枠のキーを使う場合、送信した内容が Google の製品改善に使われることがあります（課金を有効にしたキーでは使われません）。
          見られたくない内容が含まれていたら、送信せずに戻ってください。
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={onApprove}
            className="px-5 py-2.5 rounded-lg bg-black text-white text-sm font-bold cursor-pointer"
          >
            この内容をGeminiに送信して分析する
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg border border-neutral-300 text-sm cursor-pointer"
          >
            送信せずに戻る
          </button>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="border border-neutral-200 rounded-lg p-3">
    <div className="text-[10px] text-neutral-500">{label}</div>
    <div className="text-sm font-bold">{value}</div>
    {hint && <div className="text-[10px] text-neutral-400">{hint}</div>}
  </div>
);
