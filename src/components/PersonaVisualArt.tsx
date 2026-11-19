import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AggregatedProfile, LifeCardProposal } from '../types/life';
import {
  generatePersonaImage,
  PersonaImageResult,
  traitSignature,
} from '../modules/analyzer/personaImage';

interface PersonaVisualArtProps {
  profile: AggregatedProfile;
  proposal: LifeCardProposal;
  apiKey?: string;
}

// One image per analysis result: re-renders / remounts / StrictMode never pay twice.
const imageCache = new Map<string, PersonaImageResult>();
const inFlight = new Map<string, Promise<PersonaImageResult>>();

function requestImage(
  signature: string,
  profile: AggregatedProfile,
  proposal: LifeCardProposal,
  apiKey: string | undefined,
  onLog: (msg: string) => void,
  force: boolean
): Promise<PersonaImageResult> {
  if (!force) {
    const cached = imageCache.get(signature);
    if (cached) return Promise.resolve(cached);
    const pending = inFlight.get(signature);
    if (pending) return pending;
  }
  const p = generatePersonaImage(profile, proposal, apiKey, onLog)
    .then((r) => {
      imageCache.set(signature, r);
      return r;
    })
    .finally(() => inFlight.delete(signature));
  inFlight.set(signature, p);
  return p;
}

/** The license "photo": an illustration generated from the 6 traits. */
export const PersonaVisualArt: React.FC<PersonaVisualArtProps> = ({
  profile,
  proposal,
  apiKey,
}) => {
  const signature = traitSignature(proposal);
  const [result, setResult] = useState<PersonaImageResult | null>(
    () => imageCache.get(signature) ?? null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = (force: boolean) => {
    let active = true;
    setError(null);
    setIsGenerating(true);
    requestImage(signature, profile, proposal, apiKey, (m) => active && setStatus(m), force)
      .then((r) => active && setResult(r))
      .catch((e) => active && setError((e as Error).message))
      .finally(() => active && setIsGenerating(false));
    return () => {
      active = false;
    };
  };

  // A new analysis result → a new image (cached per result).
  useEffect(() => {
    const cached = imageCache.get(signature);
    if (cached) {
      setResult(cached);
      setError(null);
      return;
    }
    setResult(null);
    return run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <div className="relative w-full aspect-[3/4] bg-neutral-900 overflow-hidden rounded-md">
      {result && (
        <img src={result.src} alt={proposal.nickname} className="w-full h-full object-cover block" />
      )}

      {!result && !isGenerating && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-[10px]">
          PHOTO
        </div>
      )}

      {isGenerating && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 text-white p-3 text-center">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <div className="text-[11px] font-bold leading-snug">{status || '準備中...'}</div>
          <div className="text-[9px] opacity-60">Gemini で生成</div>
        </div>
      )}

      {!isGenerating && error && (
        <div
          data-export-ignore="true"
          className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 text-white p-3 text-center"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <div className="text-[10px] leading-snug">{error}</div>
          <button
            type="button"
            onClick={() => run(true)}
            className="px-2.5 py-1 rounded text-[10px] font-bold bg-white text-black cursor-pointer"
          >
            もう一度試す
          </button>
        </div>
      )}

      {result && !isGenerating && (
        <button
          type="button"
          data-export-ignore="true"
          onClick={() => run(true)}
          title="同じ特徴で別の画像を作る"
          className="absolute bottom-1.5 right-1.5 px-2 py-1 rounded bg-black/70 text-white text-[9px] font-bold flex items-center gap-1 cursor-pointer hover:bg-black"
        >
          <RefreshCw className="w-3 h-3" />
          別の画像
        </button>
      )}
    </div>
  );
};
