# What is your LIFE?

**あなたを、あなたの人生で紹介しよう。**

Google に残っている自分の行動記録を Gemini が読み解いて、「人生免許証」にまとめるアプリです。
出発点は「死ぬ前に、自分の人生のエンドロールを見てみたい」という発想でした。誰と一番話し、何に一番夢中になり、どこに一番通ったのか。自分では分かりようがない自分を、何年分もの記録から描きます。

## 使い方（3ステップ）

1. **Google から書き出す**：[Google データ エクスポート（Takeout）](https://takeout.google.com/) で、マイアクティビティ・YouTube・Chrome などを書き出します（ZIP）。
2. **アプリに読み込む**：ZIP をドロップします。集計はブラウザの中だけで行い、個人情報やセンシティブな項目は除外します。Gemini に送る内容は、送信前に全文を確認できます。
3. **Gemini が分析**：サービスをまたいで記録を分析し、6つの特徴・二つ名・ひとことを作ります。特徴から描いたシルエットの写真付きで、「人生免許証」になります。載せる項目は自分で選べて、PNG で保存できます。

Takeout が手元になくても、同梱のサンプルデータ（3人分）で試せます。

## Gemini API キーについて（必須）

このアプリにはサーバーがなく、API キーも同梱していません。使う人が自分の Gemini API キーを画面に入力します（[Google AI Studio で発行](https://aistudio.google.com/apikey)）。

- **1つのキーで両方**：記録の分析（テキスト）と、免許証の写真の生成（画像）を同じキーで行います。
- **写真の生成には課金を有効にしたキーが必要**です。Gemini の画像生成モデルは無料枠では使えません。無料枠のキーでも分析までは動きます（写真の部分にエラーが出ます）。
- キーはブラウザの localStorage にだけ保存され、Google の API 以外には送られません。

使うモデル（上から順に試し、使えなければ次へ）：

| 用途 | モデル |
|---|---|
| 分析 | `gemini-3-flash-preview` → `gemini-3.8-flash` → `gemini-3.1-flash-lite-preview` → `gemini-3.6-flash` |
| 写真 | `gemini-3-pro-image` → `gemini-3.1-flash-image` → `gemini-2.5-flash-image` |

## 動かし方

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開き、Gemini API キーを入力してから ZIP を読み込むか、サンプルを選んでください。

本番用にビルドする場合は `npm run build`（`dist/` に静的ファイルが出ます。そのまま静的ホスティングに置けます）。

## プライバシー

- ZIP の展開・集計・個人情報の除外は、すべてブラウザの中で行います。
- Gemini に送るのは、集計結果と、除外処理を通した記録の抜粋だけです。送信前に画面で全文を確認し、承認したときだけ送ります。
- 無料枠のキーを使う場合、送信内容が Google の製品改善に使われることがあります（課金を有効にしたキーでは使われません）。

## 構成

```
src/
  App.tsx                     画面の流れ（アップロード → 送信の確認 → 解析 → 免許証）
  components/
    Step1Input.tsx            アップロード・APIキー入力・サンプル
    SendReview.tsx            Gemini に送る内容の確認
    LicenseCard.tsx           人生免許証（載せる項目の選択・PNG保存）
    PersonaVisualArt.tsx      免許証の写真（特徴から生成）
  modules/
    parser/                   Takeout の読み込み・個人情報の除外・横断集計
    analyzer/
      geminiTextClient.ts     Gemini テキスト呼び出し（モデルの切り替え・タイムアウト）
      geminiAnalyzer.ts       6つの特徴の分析
      personaImage.ts         特徴 → 絵の設計 → Gemini で画像生成
public/samples/               サンプルの Takeout データ（架空の人物）
video/                        デモ動画の台本・字幕・モーショングラフィックス
```

React 19 / Vite / TypeScript / Tailwind CSS / `@google/genai`

---

Google AI Challenge（Google 日本法人 25 周年）応募作品
