import { GoogleGenAI, Schema } from '@google/genai';

/**
 * Free-tier Gemini text models, tried in order.
 * gemini-3-flash-preview answered fastest in testing; 3.6-flash was very slow / often 429.
 */
export const GEMINI_TEXT_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.6-flash',
];

/** The user's own key (entered in the app, kept only in their browser). No server-side keys exist. */
export function getGeminiKey(userKey?: string): string {
  return (userKey && userKey.trim()) || '';
}

export function hasUsableKey(userKey?: string): boolean {
  return getGeminiKey(userKey).length > 10;
}

function describeError(e: unknown): string {
  const err = e as Error;
  if (err?.name === 'AbortError') return 'タイムアウト';
  const msg = String(err?.message || e);
  const code = msg.match(/"code":\s*(\d{3})/)?.[1] || msg.match(/HTTP (\d{3})/)?.[1];
  if (code === '429') return '429 利用上限に到達';
  if (code === '503') return '503 混雑中';
  if (code === '404') return '404 このモデルは使えない';
  if (code === '401' || code === '403') return `${code} APIキーが無効です`;
  return msg.slice(0, 120);
}

export interface GeminiJsonResult<T> {
  data: T;
  model: string;
}

/**
 * Ask Gemini for a JSON reply.
 * Calls Gemini directly from the browser with the key the user entered (BYOK).
 */
export async function geminiJson<T>(
  prompt: string,
  opts: {
    apiKey?: string;
    schema?: Schema;
    validate?: (v: unknown) => v is T;
    timeoutMs?: number;
    temperature?: number;
    onLog?: (msg: string) => void;
  } = {}
): Promise<GeminiJsonResult<T> | null> {
  const userKey = getGeminiKey(opts.apiKey);
  if (!hasUsableKey(userKey)) {
    opts.onLog?.('Gemini APIキーが入力されていません');
    return null;
  }
  const ai = new GoogleGenAI({ apiKey: userKey });
  const timeoutMs = opts.timeoutMs ?? 180_000;

  for (const model of GEMINI_TEXT_MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const t0 = Date.now();
    const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
    opts.onLog?.(`${model} に送信中...`);
    try {
      const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            ...(opts.schema ? { responseSchema: opts.schema } : {}),
            temperature: opts.temperature ?? 0.4,
            abortSignal: ctrl.signal,
          },
        });
      const text = res.text || '';

      if (!text) {
        opts.onLog?.(`× ${model}: 空の返答（${secs()}秒）`);
        continue;
      }
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch (e) {
        opts.onLog?.(
          `× ${model}: JSONが壊れていた（${secs()}秒・${text.length}文字）${(e as Error).message.slice(0, 60)}`
        );
        continue;
      }
      if (opts.validate && !opts.validate(data)) {
        opts.onLog?.(`× ${model}: 返答の形式が足りない（${secs()}秒）`);
        continue;
      }
      opts.onLog?.(`✓ ${model} から返答を受信（${secs()}秒）`);
      return { data: data as T, model };
    } catch (e) {
      const reason = ctrl.signal.aborted ? 'タイムアウト' : describeError(e);
      opts.onLog?.(`× ${model}: ${reason}（${secs()}秒）`);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
