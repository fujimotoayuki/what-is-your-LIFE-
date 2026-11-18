import React, { useRef, useState } from 'react';
import { Upload, Trash2, KeyRound, ChevronDown, ChevronUp } from 'lucide-react';

interface Step1InputProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onSelectSample: () => void;
  onUploadFiles: (files: File[]) => void;
  errorMessage: string | null;
}

export const Step1Input: React.FC<Step1InputProps> = ({
  apiKey,
  onApiKeyChange,
  onSelectSample,
  onUploadFiles,
  errorMessage,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [showApiKeyBox, setShowApiKeyBox] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const envKey =
    ((import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '').trim();
  const hasCustomKey = apiKey.trim().length > 10;
  const hasEnvKey = envKey.length > 10;
  const isKeyActive = hasCustomKey || hasEnvKey;

  const addFilesToStage = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;
    setStagedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const uniqueNew = incoming.filter(
        (f) => !existingNames.has(`${f.name}-${f.size}`)
      );
      return [...prev, ...uniqueNew];
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToStage(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-8">
      {/* Title & Concept */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-black">
          あなたを、あなたの人生で紹介しよう。
        </h1>
        <p className="text-xs md:text-sm text-neutral-600 leading-relaxed">
          Google Takeout の行動履歴から、複数サービスを横断した「累計時間・検索回数・無意識の行動クセ」を集計し、イメージイラスト付きの人生の名刺を生成します。データはブラウザ内でのみ処理されます。
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 border border-black bg-neutral-50 text-black text-xs">
          {errorMessage}
        </div>
      )}

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border border-dashed rounded-xl p-10 text-center transition-colors ${
          isDragging
            ? 'border-black bg-neutral-100'
            : 'border-neutral-300 bg-white hover:border-black'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".zip,.json,.html,.htm,.csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              addFilesToStage(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer space-y-2.5"
        >
          <Upload className="w-5 h-5 mx-auto text-neutral-500" />
          <div className="text-sm font-bold text-black">
            Google Takeout の ZIP ファイルをドロップ（複数選択可）
          </div>
          <div className="text-xs text-neutral-500">
            クリックしてファイルを選択（.zip / .json / .html / .csv）
          </div>
        </div>

        {stagedFiles.length > 0 && (
          <div className="mt-6 pt-6 border-t border-neutral-200 text-left space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-black">
                選択中のファイル ({stagedFiles.length})
              </span>
              <button
                type="button"
                onClick={() => setStagedFiles([])}
                className="text-neutral-500 hover:text-black underline cursor-pointer"
              >
                クリア
              </button>
            </div>

            <div className="space-y-1.5">
              {stagedFiles.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="px-3 py-2 border border-neutral-200 rounded-lg flex items-center justify-between text-xs"
                >
                  <span className="truncate font-mono-code text-black">
                    {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setStagedFiles((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-neutral-400 hover:text-black cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onUploadFiles(stagedFiles)}
              className="w-full py-3 rounded-lg bg-black hover:bg-neutral-800 text-white text-xs font-bold cursor-pointer"
            >
              選択したファイルを解析する
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Gemini API Key Box (Optional) */}
      <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
        <button
          type="button"
          onClick={() => setShowApiKeyBox((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 text-xs">
            <KeyRound className="w-4 h-4 text-neutral-500" />
            <span className="font-bold text-black">
              Gemini APIキー設定（任意・自分のキーでAI分析したい場合）
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono-code border ${
                isKeyActive
                  ? 'bg-black text-white border-black'
                  : 'bg-neutral-100 text-neutral-500 border-neutral-200'
              }`}
            >
              {hasCustomKey
                ? 'キー入力済み'
                : hasEnvKey
                ? '設定済み (.env適用中)'
                : '未入力（ローカル分析対応）'}
            </span>
          </div>
          {showApiKeyBox ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </button>

        {showApiKeyBox && (
          <div className="px-4 pb-4 pt-2 border-t border-neutral-200 space-y-2.5 bg-neutral-50">
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Google AI Studio で取得した Gemini API キーを入力すると、AIモデル（Gemini 3.6 / 3.5 Flash等）による高精度なパーソナリティ分析が実行されます。空欄のままでも内蔵のローカル分析エンジンで動作します。キーはお使いのブラウザ（localStorage）にのみ保存されます。
            </p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder="AIza... または AQ... から始まるAPIキーを入力"
                className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-mono-code text-black focus:outline-none focus:border-black"
              />
              {apiKey && (
                <button
                  type="button"
                  onClick={() => onApiKeyChange('')}
                  className="px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs text-neutral-600 hover:text-black cursor-pointer"
                >
                  クリア
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sample Data Button */}
      <div className="pt-2 border-t border-neutral-200 flex items-center justify-between gap-4">
        <div className="text-xs text-neutral-500">
          手元にファイルがない場合は、サンプルデータで動作を確認できます。
        </div>
        <button
          type="button"
          onClick={onSelectSample}
          className="px-4 py-2 rounded-lg border border-black bg-white hover:bg-black hover:text-white text-xs font-bold text-black transition-colors shrink-0 cursor-pointer"
        >
          サンプルデータで試す →
        </button>
      </div>
    </div>
  );
};
