# eng-club-quiz

社内英語勉強クラブ用のリアルタイム参加型クイズアプリ。
講師の画面に問題を出し、参加者はスマホで回答してランキングを競う。Kahoot のセルフホスト版。

---

## 1. 背景

### 1-1. なぜ作るか

社内で英語勉強クラブを立ち上げ、初回テーマは「前置詞」。講師が一方的に話すだけだと参加者の集中が続かないため、講義の合間に **参加型クイズ** を挟んでワイワイ盛り上げたい。

選択肢として Kahoot / Quizizz / Slido などの SaaS があるが、

- 社内ネットワーク制約や外部 SaaS への業務利用の可否確認が面倒
- 無料プランの人数・機能制限
- 英語クラブ以外の用途にも転用したい（汎用クイズ基盤として残したい）

…という理由で **自作する**。

### 1-2. なぜ Web アプリか

- 参加者にアプリを入れさせない（URL を開くだけ）
- スマホ・PC・タブレットどれでも動く
- 配布が GitHub Pages の URL を共有するだけで済む

### 1-3. なぜ Firebase か

- リアルタイム同期（講師の出題と参加者の回答）に WebSocket 相当が要る
- 自前のサーバを立てると常時稼働が面倒
- Firebase Realtime Database は無料枠で同時接続 100・月間 10GB 通信まで使え、社内勉強会規模では十分
- SDK が枯れており、リアルタイム同期コードを 50 行程度で書ける

### 1-4. なぜ GitHub Pages か

- 静的サイトを無料で HTTPS 配信できる
- Firebase 側との相性が良い（CORS や HTTPS 要件で詰まらない）
- リポジトリへの push がそのままデプロイになる

---

## 2. 全体構成

```
┌─────────────────┐         ┌──────────────────────┐
│ 講師PC          │         │ Firebase Realtime DB │
│  host.html      │◄───────►│  /rooms/{PIN}/...    │
│  (ホスト画面)    │         └──────────────────────┘
└─────────────────┘                   ▲
        ▲                             │
        │ プロジェクター投影             │
        ▼                             │
┌─────────────────┐                   │
│ 参加者スマホ      │                   │
│  join.html      │◄──────────────────┘
│  (回答画面)      │
└─────────────────┘
```

- **配信**：GitHub Pages（静的 HTML/JS/CSS）
- **同期**：Firebase Realtime Database
- **認証**：なし（PIN コードによる擬似的なルーム分離のみ）

---

## 3. 画面設計

### 3-1. URL 構成

| URL | 用途 |
|-----|------|
| `/` | ランディング（ホスト用 / 参加者用の入り口） |
| `/host.html` | 講師用ホスト画面 |
| `/join.html` | 参加者用回答画面 |

### 3-2. ホスト画面（host.html）の状態遷移

```
[1] 起動
   ↓ 問題セット選択（プルダウンで JSON ファイル選択）
[2] ルーム作成
   ↓ 6 桁 PIN 自動生成、Firebase にルーム書き込み
[3] 参加者待機
   ↓ 大きく PIN 表示、入室済み参加者一覧を表示
   ↓ 「クイズ開始」ボタン
[4] 問題表示
   ↓ 問題文と 4 択を大きく表示
   ↓ カウントダウン（デフォルト 20 秒、設定可）
[5] 回答締切
   ↓ 正解ハイライト、回答分布グラフ、上位 5 名表示
   ↓ 「次の問題」ボタン
[6] 全問終了
   ↓ 最終ランキング表示（上位 10 名）
   ↓ 「ルーム閉じる」ボタン
```

### 3-3. 参加者画面（join.html）の状態遷移

```
[1] 起動
   ↓ PIN 入力 + ニックネーム入力
[2] 入室待機
   ↓ 「講師の合図を待ってください」
[3] 問題受信
   ↓ 4 つのカラーボタンのみ表示（問題文は講師画面で見る）
   ↓ ボタンタップで即座に Firebase に書き込み
[4] 結果受信
   ↓ 正解 / 不正解、現在の自分の順位と得点
[5] 全問終了
   ↓ 最終順位と得点を表示
```

参加者画面に **問題文や選択肢のラベルを出さない** のは、Kahoot 流の「全員が同じ画面（講師画面）に注目する」一体感を再現するため。

---

## 4. データモデル（Firebase Realtime Database）

### 4-1. 全体構造

```
/rooms/{PIN}/
  ├── meta/
  │   ├── createdAt: <unix timestamp>
  │   ├── hostId: <ランダム文字列、ホスト識別用>
  │   ├── quizSetName: "prepositions_v1"
  │   └── status: "waiting" | "playing" | "finished"
  │
  ├── currentQuestion/
  │   ├── index: <0始まりの問題番号>
  │   ├── startedAt: <unix timestamp>
  │   ├── deadline: <unix timestamp、startedAt + 制限秒数>
  │   └── phase: "answering" | "revealed"
  │
  ├── players/
  │   └── {playerId}/
  │       ├── nickname: "Akai"
  │       ├── joinedAt: <unix timestamp>
  │       └── score: 0
  │
  └── answers/
      └── {questionIndex}/
          └── {playerId}/
              ├── choice: 0 | 1 | 2 | 3
              └── answeredAt: <unix timestamp>
```

### 4-2. 設計の意図

- **PIN を URL パスにしない**（クエリにもしない）：参加者は join.html で手入力する。これで Kahoot 風の「PIN 共有 → 入室」体験になる
- **questions（問題本体）は Firebase に置かない**：問題 JSON は GitHub Pages 側に置き、講師画面でロードする。Firebase には「今何問目か」だけ書く。理由：
  - 問題追加・編集が Git 管理できる
  - 参加者画面に問題文を出さない設計と整合する
  - Firebase の書き込み量を減らせる
- **answers を questionIndex 単位で分ける**：「Q3 の回答分布」のような集計クエリが効率的になる
- **score はサーバ側で計算しない**：講師画面がリアルタイム集計し、`players/{playerId}/score` に書き戻す。クライアント集計で十分

---

## 5. 問題 JSON のフォーマット

リポジトリ内の `questions/` 配下に置く。

### 5-1. ファイル例：`questions/prepositions_v1.json`

```json
{
  "name": "前置詞 v1（of, by）",
  "description": "of と by の用法を判定する 4 択クイズ",
  "defaultTimeLimitSec": 20,
  "questions": [
    {
      "id": "of-01",
      "text": "He is a member of the club.\nこの of の用法は？",
      "choices": [
        "①BのA（所属からの分離）",
        "②Bについて",
        "③Bで出来ている",
        "④Bから（分離）"
      ],
      "correct": 0,
      "timeLimitSec": 20,
      "explanation": "クラブというメンバーの集合の中から「彼」を取り出している。"
    },
    {
      "id": "of-02",
      "text": "He robbed me of money.\nこの of の用法は？",
      "choices": [
        "①BのA（所属からの分離）",
        "②Bについて",
        "③Bで出来ている",
        "④Bから（分離）"
      ],
      "correct": 3,
      "timeLimitSec": 20,
      "explanation": "「お金」と「私」を分離させる動作。rob, deprive, strip などはこの用法。"
    }
  ]
}
```

### 5-2. フィールド仕様

| フィールド | 必須 | 型 | 説明 |
|----------|------|---|------|
| `name` | ✅ | string | 問題セット名（ホスト画面のプルダウン表示用） |
| `description` | | string | 説明文 |
| `defaultTimeLimitSec` | ✅ | number | デフォルト制限秒数 |
| `questions[]` | ✅ | array | 問題配列 |
| `questions[].id` | ✅ | string | 問題ID（ユニーク） |
| `questions[].text` | ✅ | string | 問題文（改行は `\n`） |
| `questions[].choices` | ✅ | string[4] | 4 つの選択肢（必ず 4 つ） |
| `questions[].correct` | ✅ | number | 正解インデックス（0-3） |
| `questions[].timeLimitSec` | | number | この問題だけ制限秒数を上書きしたい場合 |
| `questions[].explanation` | | string | 正解発表後に表示する解説 |

---

## 6. 得点計算ルール

Kahoot 方式を踏襲：

- 正解：基礎点 **1000 点 × (残り時間 / 制限時間)**
- 不正解 / 未回答：0 点
- 制限時間内に最速で正解した人ほど高得点になる

例：制限 20 秒、5 秒で正解 → `1000 × (15/20) = 750 点`

「速さ」を競う設計だと、ゆっくり考えたい人が辛い場合がある。社内勉強会向けに **「速度ボーナスなし、正解者全員 1000 点」モード** も切り替え可能にしておく（ホスト画面の設定で）。

---

## 7. セキュリティ

### 7-1. 想定する脅威レベル

- 社内勉強会の身内利用が前提
- 公開 URL ではあるが、PIN を知らないと入室できない
- 業務機密データは扱わない（前置詞クイズなので）

### 7-2. Firebase セキュリティルール

最低限のルール（テストモードから移行する際）：

```json
{
  "rules": {
    "rooms": {
      "$pin": {
        ".read": true,
        "meta": { ".write": true },
        "currentQuestion": { ".write": true },
        "players": {
          "$playerId": {
            ".write": "newData.child('nickname').isString()"
          }
        },
        "answers": {
          "$qIdx": {
            "$playerId": {
              ".write": "!data.exists()"
            }
          }
        }
      }
    }
  }
}
```

設計上の判断：
- **講師認証はしない**：ホスト判別はクライアント側の `localStorage` 保持の `hostId` のみで行う。社内勉強会で誰かが悪意で乱入する想定はしない
- **回答は一度書いたら上書き不可**（`!data.exists()`）：二度回答での荒らし防止
- **answers の読み取りは許可**：参加者画面で「全員回答済み」を確認したいケースに備える

業務利用に格上げする場合は Firebase Authentication（匿名認証 + カスタムクレーム）を入れる余地を残しておく。

### 7-3. firebaseConfig の公開について

`firebaseConfig` の `apiKey` は **公開前提**。Firebase の Web API キーは「どの Firebase プロジェクトに接続するか」を示すだけで、アクセス制御はセキュリティルール側で行う設計。GitHub Public リポジトリに含めても問題ない。

---

## 8. ディレクトリ構成（予定）

```
eng-club-quiz/
├── README.md                # 本ファイル
├── index.html               # ランディング
├── host.html                # ホスト画面
├── join.html                # 参加者画面
├── css/
│   └── style.css
├── js/
│   ├── firebase-config.js   # firebaseConfig をここに記載
│   ├── host.js
│   ├── join.js
│   └── common.js
├── questions/
│   ├── prepositions_v1.json
│   └── prepositions_v2.json
├── sounds/
│   ├── countdown.mp3
│   ├── correct.mp3
│   └── wrong.mp3
└── docs/
    └── firebase-rules.json  # 本番用セキュリティルール
```

ビルドツールは使わない（素の HTML/JS/CSS）。理由：
- 構成が単純で、ビルド入れるほどの規模ではない
- GitHub Pages にそのまま push すれば動く
- 引き継ぎ・改修のハードルが低い

---

## 9. 想定する開発ステップ

1. **構造とデータモデル確定**（本ドキュメント）
2. **最小実装**：host.html / join.html / firebase 接続コード
   - PIN 生成 → 入室 → 1 問だけ出題 → 回答 → 正解発表、まで一気通貫
3. **複数問対応・ランキング**
4. **演出**：カウントダウン、効果音、回答分布グラフ
5. **問題 JSON 拡充**：`前置詞.md` から of / by の問題を抽出
6. **デプロイ**：GitHub Pages 有効化
7. **本番セキュリティルール適用**
8. **見た目の調整**（テーマは後で決定）

---

## 10. 将来の拡張余地（やらないが残しておく）

- Firebase Authentication（匿名認証）導入による不正回答防止
- 問題セットのバージョン管理と履歴
- チーム戦モード（個人ではなくチーム単位で集計）
- 自由記述問題（前置詞穴埋め）対応
- 講師画面の問題編集 UI（現在は JSON 直編集前提）
- 多言語対応

---

## 11. 参考リンク

- Firebase Realtime Database: https://firebase.google.com/docs/database
- GitHub Pages: https://docs.github.com/pages
- Kahoot（参考にしたインスピレーション元）: https://kahoot.com/
