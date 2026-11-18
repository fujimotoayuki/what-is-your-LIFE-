import React, { useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';

interface Step1InputProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onSelectSample: () => void;
  onUploadFiles: (files: File[]) => void;
  errorMessage: string | null;
}

export const Step1Input: React.FC<Step1InputProps> = ({
  onSelectSample,
  onUploadFiles,
  errorMessage,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
          Google Takeout の行動履歴から、複数サービスを横断した「累計時間・検索回数・無意識の行動クセ」を集計し、人生の名刺を生成します。データはブラウザ内でのみ処理されます。
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
