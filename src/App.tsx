import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { AggregatedProfile, LifeCardProposal } from './types/life';
import {
  loadSampleDatasetById,
  parseUploadedTakeoutFiles,
  SampleDatasetInfo,
} from './modules/parser/takeoutParser';
import { analyzeProfileWithGemini } from './modules/analyzer/geminiAnalyzer';
import { Step1Input } from './components/Step1Input';
import { LicenseCard } from './components/LicenseCard';
import { SendReview } from './components/SendReview';

/**
 * Flow: 1. upload ZIP → parse + privacy filter + aggregate (local)
 *       → 2. user reviews what will be sent and approves
 *       → 3. Gemini finds 6 traits → 4. license card (photo = image generated from the traits).
 */
type Step = 1 | 2 | 3 | 4;
type Phase = 'parse' | 'analyze' | 'error';

export const App: React.FC = () => {
  const [step, setStep] = useState<Step>(1);
  const [apiKey, setApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('WIYL_GEMINI_API_KEY') || '';
    } catch {
      return '';
    }
  });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<AggregatedProfile | null>(null);
  const [proposal, setProposal] = useState<LifeCardProposal | null>(null);
  const [phase, setPhase] = useState<Phase>('parse');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const log = (msg: string) => setLogs((prev) => [...prev, msg]);

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    try {
      localStorage.setItem('WIYL_GEMINI_API_KEY', key);
    } catch {
      // ignore
    }
  };

  const analyze = async (agg: AggregatedProfile) => {
    setPhase('analyze');
    setAnalysisError(null);
    setProposal(null);
    try {
      const result = await analyzeProfileWithGemini(agg, apiKey, log);
      setProposal(result);
      setStep(4);
    } catch (e) {
      setAnalysisError((e as Error).message);
      setPhase('error');
    }
  };

  const loadAndAnalyze = async (
    firstLog: string,
    load: () => Promise<{ aggregatedProfile: AggregatedProfile }>
  ) => {
    if (apiKey.trim().length <= 10) {
      setUploadError('先に Gemini APIキーを入力してください（下の「Gemini APIキー」欄）。');
      return;
    }
    setUploadError(null);
    setLogs([firstLog]);
    setPhase('parse');
    setProfile(null);
    setStep(3);
    try {
      const { aggregatedProfile } = await load();
      setProfile(aggregatedProfile);
      log(
        `全 ${aggregatedProfile.totalEvents.toLocaleString()} 件を集計（個人情報・センシティブ項目 ${aggregatedProfile.privacyStats.filteredCount.toLocaleString()} 件を除外）`
      );
      setStep(2); // wait for the user's approval before sending anything to Gemini
    } catch (e) {
      setUploadError((e as Error).message || 'ファイルの解析中にエラーが発生しました。');
      setStep(1);
    }
  };

  const handleUploadFiles = (files: File[]) =>
    loadAndAnalyze(`${files.map((f) => f.name).join(', ')} を読み込んでいます...`, () =>
      parseUploadedTakeoutFiles(files, log)
    );

  const handleSelectSample = (id: SampleDatasetInfo['id']) =>
    loadAndAnalyze('サンプルデータを読み込んでいます...', () => loadSampleDatasetById(id, log));

  const handleReanalyze = () => {
    if (!profile) return;
    setLogs(['同じデータでもう一度分析します（毎回ちがう結果になります）...']);
    setStep(3);
    analyze(profile);
  };

  const approveSend = () => {
    if (!profile) return;
    log('ユーザーの承認を受けて Gemini に送信します');
    setStep(3);
    analyze(profile);
  };

  const restart = () => {
    setStep(1);
    setProfile(null);
    setProposal(null);
  };

  const steps: { num: Step; label: string }[] = [
    { num: 1, label: '1. アップロード' },
    { num: 2, label: '2. 送信の確認' },
    { num: 3, label: '3. 解析' },
    { num: 4, label: '4. 免許証' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-sm tracking-tight">What is your LIFE?</span>
          <nav className="flex items-center gap-5 text-xs">
            {steps.map((s) => (
              <span
                key={s.num}
                className={
                  step === s.num
                    ? 'font-bold border-b-2 border-black py-1'
                    : 'text-neutral-400 py-1'
                }
              >
                {s.label}
              </span>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        {step === 1 && (
          <Step1Input
            apiKey={apiKey}
            onApiKeyChange={handleApiKeyChange}
            onSelectSample={handleSelectSample}
            onUploadFiles={handleUploadFiles}
            errorMessage={uploadError}
          />
        )}

        {step === 2 && profile && (
          <SendReview profile={profile} onApprove={approveSend} onCancel={restart} />
        )}

        {step === 3 && (
          <div className="border border-black rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                {phase === 'error' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Loader2 className="w-5 h-5 animate-spin" />
                )}
              </div>
              <h2 className="text-xl font-bold">
                {phase === 'error' ? '分析できませんでした' : '行動履歴を解析中です...'}
              </h2>
            </div>

            <div className="space-y-2.5 text-sm">
              {[
                { key: 'parse', label: 'ZIPの展開・個人情報の除外・横断集計' },
                { key: 'analyze', label: 'Geminiが6つの特徴を分析（数十秒〜数分）' },
              ].map((item, i) => {
                const done = i === 0 ? phase !== 'parse' : false;
                const current = phase === item.key;
                return (
                  <div
                    key={item.key}
                    className={`flex items-center gap-3 ${done || current ? 'text-black' : 'text-neutral-400'}`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : current ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                    <span className={current ? 'font-bold' : ''}>{item.label}</span>
                  </div>
                );
              })}
            </div>

            {phase === 'error' && analysisError && (
              <div className="space-y-3">
                <p className="text-sm text-red-600">{analysisError}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => profile && analyze(profile)}
                    className="px-4 py-2 rounded-lg bg-black text-white text-xs font-bold cursor-pointer"
                  >
                    もう一度分析する
                  </button>
                  <button
                    type="button"
                    onClick={restart}
                    className="px-4 py-2 rounded-lg border border-neutral-300 text-xs cursor-pointer"
                  >
                    最初に戻る
                  </button>
                </div>
              </div>
            )}

            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-1 max-h-56 overflow-y-auto font-mono-code text-[11px] text-neutral-600">
              {logs.map((l, i) => (
                <div key={i}>&gt; {l}</div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && profile && proposal && (
          <LicenseCard
            profile={profile}
            proposal={proposal}
            apiKey={apiKey}
            onReanalyze={handleReanalyze}
            onRestart={restart}
          />
        )}
      </main>
    </div>
  );
};

export default App;
