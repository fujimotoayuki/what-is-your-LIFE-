import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';
import {
  AggregatedProfile,
  LifeCardProposal,
  NormalizedEvent,
} from './types/life';
import {
  loadSampleLifeDataset,
  parseUploadedTakeoutFiles,
} from './modules/parser/takeoutParser';
import { aggregateEvents } from './modules/parser/aggregator';
import {
  AnalysisCustomOptions,
  analyzeProfileWithGemini,
  buildDynamicFallbackProposal,
  validateLifeCardProposal,
} from './modules/analyzer/geminiAnalyzer';
import { Step1Input } from './components/Step1Input';
import { Step2AnalyzeSelect } from './components/Step2AnalyzeSelect';
import { Step3LifeCard } from './components/Step3LifeCard';

type StepNumber = 1 | 2 | 3;

export const App: React.FC = () => {
  const [step, setStep] = useState<StepNumber>(1);
  const [apiKey, setApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('WIYL_GEMINI_API_KEY') || '';
    } catch {
      return '';
    }
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [normalizedEvents, setNormalizedEvents] = useState<NormalizedEvent[]>([]);
  const [profile, setProfile] = useState<AggregatedProfile | null>(null);
  const [proposal, setProposal] = useState<LifeCardProposal | null>(null);

  const [customOptions, setCustomOptions] = useState<AnalysisCustomOptions>({
    tonePreset: 'sns_pop',
    customInstruction: '',
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<1 | 2 | 3>(1);
  const [progressLogs, setProgressLogs] = useState<string[]>([]);

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    try {
      localStorage.setItem('WIYL_GEMINI_API_KEY', key);
    } catch {
      // ignore
    }
  };

  const appendLog = (msg: string) => {
    setProgressLogs((prev) => [...prev, msg]);
  };

  const runAnalysisPipeline = async (
    events: NormalizedEvent[],
    aggProfile: AggregatedProfile,
    opts: AnalysisCustomOptions = customOptions
  ) => {
    setNormalizedEvents(events);
    setProfile(aggProfile);
    setProposal(null);
    setStep(2);
    setIsAnalyzing(true);
    setAnalysisPhase(2);
    appendLog(
      `全 ${events.length.toLocaleString()} 件の行動履歴を統合・横断集計しました`
    );

    try {
      await new Promise((r) => setTimeout(r, 450));
      setAnalysisPhase(3);
      const result = await analyzeProfileWithGemini(
        aggProfile,
        apiKey,
        (msg) => {
          appendLog(msg);
        },
        opts
      );
      await new Promise((r) => setTimeout(r, 500));
      setProposal(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`エラー: ${msg}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectSample = async () => {
    setErrorMessage(null);
    setIsAnalyzing(true);
    setAnalysisPhase(1);
    setProgressLogs(['サンプルデータセットを展開しています...']);
    setStep(2);

    await new Promise((r) => setTimeout(r, 450));
    const { normalizedEvents: evs, aggregatedProfile: agg } =
      loadSampleLifeDataset();
    await runAnalysisPipeline(evs, agg, customOptions);
  };

  const handleUploadFiles = async (files: File[]) => {
    setErrorMessage(null);
    setIsAnalyzing(true);
    setAnalysisPhase(1);
    setProgressLogs([
      `${files.length}個のファイル（${files.map((f) => f.name).join(', ')}）の読み込みを開始しました...`,
    ]);
    setStep(2);

    try {
      await new Promise((r) => setTimeout(r, 300));
      const { normalizedEvents: evs, aggregatedProfile: agg } =
        await parseUploadedTakeoutFiles(files, (msg) => {
          appendLog(msg);
        });
      await runAnalysisPipeline(evs, agg, customOptions);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'ファイルの解析中にエラーが発生しました。';
      setIsAnalyzing(false);
      setStep(1);
      setErrorMessage(msg);
    }
  };

  const handleReanalyze = async (opts?: AnalysisCustomOptions) => {
    if (!profile) return;
    setProgressLogs(['再解析を開始しています...']);
    const freshProfile =
      normalizedEvents.length > 0
        ? aggregateEvents(
            normalizedEvents,
            profile.privacyStats,
            profile.datasetLabel,
            profile.sourceFiles
          )
        : profile;
    await runAnalysisPipeline(
      normalizedEvents,
      freshProfile,
      opts ?? customOptions
    );
  };

  useEffect(() => {
    if (
      profile &&
      normalizedEvents.length > 0 &&
      proposal &&
      proposal.discoveries.length > 0 &&
      (!profile.aiRawDigest?.timeOfDayBreakdown ||
        proposal.discoveries[0].categoryTag.startsWith('1.'))
    ) {
      const freshProfile = aggregateEvents(
        normalizedEvents,
        profile.privacyStats,
        profile.datasetLabel,
        profile.sourceFiles
      );
      setProfile(freshProfile);
      const upgraded = validateLifeCardProposal(
        buildDynamicFallbackProposal(freshProfile, customOptions),
        freshProfile
      );
      setProposal(upgraded);
    }
  }, [profile, normalizedEvents, proposal, customOptions]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      {/* Minimal Monochrome Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (!isAnalyzing) setStep(1);
            }}
            className="font-bold text-sm tracking-tight text-black cursor-pointer"
          >
            What is your LIFE?
          </button>

          <nav className="flex items-center gap-6 text-xs">
            {[
              { num: 1, label: '1. 入力' },
              { num: 2, label: '2. 選択' },
              { num: 3, label: '3. 名刺' },
            ].map((s) => {
              const active = step === s.num;
              const canJump =
                !isAnalyzing &&
                (s.num === 1 ||
                  (s.num === 2 && profile !== null) ||
                  (s.num === 3 && proposal !== null));

              return (
                <button
                  key={s.num}
                  type="button"
                  disabled={!canJump}
                  onClick={() => canJump && setStep(s.num as StepNumber)}
                  className={`py-1 transition-colors ${
                    active
                      ? 'font-bold text-black border-b-2 border-black'
                      : canJump
                      ? 'text-neutral-500 hover:text-black cursor-pointer'
                      : 'text-neutral-300 cursor-not-allowed'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        {isAnalyzing ? (
          <div className="py-12 space-y-8">
            <div className="border border-black rounded-2xl p-8 md:p-10 bg-white space-y-8">
              {/* Top Spinner & Title */}
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-mono-code uppercase tracking-widest text-neutral-500">
                    ANALYZING YOUR GOOGLE TAKEOUT
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-black">
                    行動履歴データを解析中です...
                  </h2>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden border border-neutral-200">
                  <div
                    className="h-full bg-black transition-all duration-500"
                    style={{
                      width:
                        analysisPhase === 1
                          ? '35%'
                          : analysisPhase === 2
                          ? '68%'
                          : '92%',
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono-code text-neutral-500">
                  <span>STEP {analysisPhase} / 3</span>
                  <span>
                    {analysisPhase === 1
                      ? 'ZIP展開・履歴抽出中'
                      : analysisPhase === 2
                      ? '5サービス横断集計中'
                      : '6つの特徴・キャッチコピー生成中'}
                  </span>
                </div>
              </div>

              {/* 3-Step Checklist */}
              <div className="space-y-3 pt-2 border-t border-neutral-200">
                {[
                  {
                    phase: 1,
                    title:
                      '1. ZIPファイルの展開と5サービス（YouTube・検索・マップ・Gemini・NotebookLM）の抽出',
                  },
                  {
                    phase: 2,
                    title:
                      '2. サービス横断集計・NotebookLM資料カウント・無意識のスキップ時間の算出',
                  },
                  {
                    phase: 3,
                    title:
                      '3. 行動と思考の癖から「6つの特徴」と「名前・キャッチフレーズ」を詳細生成',
                  },
                ].map((item) => {
                  const done = analysisPhase > item.phase;
                  const current = analysisPhase === item.phase;
                  return (
                    <div
                      key={item.phase}
                      className={`flex items-center gap-3 text-xs md:text-sm ${
                        done
                          ? 'text-black font-medium'
                          : current
                          ? 'text-black font-bold'
                          : 'text-neutral-400'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
                      ) : current ? (
                        <Loader2 className="w-4 h-4 text-black animate-spin shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-neutral-300 shrink-0" />
                      )}
                      <span>{item.title}</span>
                    </div>
                  );
                })}
              </div>

              {/* Live Log Console */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-1.5 max-h-48 overflow-y-auto font-mono-code text-[11px] text-neutral-600">
                {progressLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-neutral-400 select-none">&gt;</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {step === 1 && (
              <Step1Input
                apiKey={apiKey}
                onApiKeyChange={handleApiKeyChange}
                onSelectSample={handleSelectSample}
                onUploadFiles={handleUploadFiles}
                errorMessage={errorMessage}
              />
            )}

            {step === 2 && profile && (
              <Step2AnalyzeSelect
                isAnalyzing={isAnalyzing}
                progressLogs={progressLogs}
                normalizedEvents={normalizedEvents}
                profile={profile}
                proposal={proposal}
                customOptions={customOptions}
                onChangeCustomOptions={setCustomOptions}
                onUpdateProposal={setProposal}
                onReanalyze={handleReanalyze}
                onBack={() => setStep(1)}
                onProceedToCard={() => setStep(3)}
              />
            )}

            {step === 3 && profile && proposal && (
              <Step3LifeCard
                profile={profile}
                proposal={proposal}
                normalizedEvents={normalizedEvents}
                onBackToStep2={() => setStep(2)}
                onResetToStep1={() => setStep(1)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
