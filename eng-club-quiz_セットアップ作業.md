# eng-club-quiz セットアップ作業チェックリスト

あなた側で手を動かす必要がある作業の一覧。
完了したらチェックを入れて、控えた情報を該当欄に貼り付けて返してください。

---

## 1. GitHub 側

### 1-1. リポジトリ作成
- [ ] https://github.com/new から空リポジトリ作成
  - 名前：`eng-club-quiz`
  - 公開設定：**Public**
  - 初期化オプション：README / .gitignore / ライセンスはいずれも **追加しない**

### 1-2. 控えておく情報

| 項目 | 値 |
|------|----|
| GitHub ユーザー名 | war-lab |
| リポジトリ URL | `https://github.com/war-lab/eng-club-quiz` |
| ローカルクローン先パス | `https://github.com/war-lab/eng-club-quiz.git` |

### 1-3. ローカルへのクローン
- [ ] 任意のディレクトリでクローン
  ```
  git clone https://github.com/war-lab/eng-club-quiz.git
  ```

---

## 2. Firebase 側

### 2-1. プロジェクト作成
- [ ] https://console.firebase.google.com/ にログイン（個人 Google アカウント）
- [ ] 「プロジェクトを追加」
  - プロジェクト名：`eng-club-quiz`
  - Google アナリティクス：**無効**（このプロジェクトでは Google アナリティクスを有効にしないをチェック）

### 2-2. Realtime Database 作成
- [ ] 左メニュー「構築」→「Realtime Database」
- [ ] 「データベースを作成」
  - ロケーション：`asia-southeast1`（シンガポール）
  - セキュリティルール：**テストモードで開始**
- [ ] データベース URL を控える（後述）

### 2-3. Web アプリ登録
- [ ] プロジェクトトップに戻り、画面中央の `</>`（ウェブ）アイコンをクリック
  - アプリのニックネーム：`eng-club-quiz-web`
  - 「このアプリの Firebase Hosting も設定します」は **チェックしない**
- [ ] 「アプリを登録」
- [ ] 表示される `firebaseConfig` オブジェクトを **下の欄にコピー**

### 2-4. 控えておく情報

#### Firebase 設定オブジェクト（そのまま貼り付けてOK）

```javascript
// ここに firebaseConfig を貼り付け
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
```

#### Realtime Database URL
- 値の例：`https://eng-club-quiz-default-rtdb.asia-southeast1.firebasedatabase.app/`
- 控え：`（ここに記入）`

> ※ `firebaseConfig` にも `databaseURL` が含まれているはずなので、そちらが入っていれば二重に書く必要はない。

---

## 3. 動作環境の確認

### 3-1. ブラウザ
- [ ] 講師用 PC で使う想定のブラウザ（Chrome / Edge 等）を確認
- 控え：`（ブラウザ名・バージョン）`

### 3-2. 参加者の端末想定
- [ ] 参加者のスマホ環境（iOS / Android、社内 Wi-Fi 接続可否）
- 控え：`（参加者は社内Wi-Fi/個人回線/混在 のどれか）`

### 3-3. プロジェクター・画面共有
- [ ] 当日の投影方法（HDMI / ワイヤレス / Teams 画面共有 等）
- 控え：`（記入）`

---

## 4. 任意作業（後でもよい）

### 4-1. 効果音素材
- [ ] フリー素材で以下を確保（後でこちらから候補出す）
  - カウントダウン音
  - 正解音
  - 不正解音
- 配置先：`（リポジトリ内の sounds/ ディレクトリに置く想定）`

### 4-2. ロゴ・アイコン
- [ ] 英語クラブのロゴ・アイコン（任意、なくても可）

---

## 5. 最終的にこちらに渡してほしいもの

すべて埋まったら、以下を返してくれれば実装に進めます。

```
[必須]
- GitHub リポジトリ URL：
- firebaseConfig（上の JS ブロックそのまま）：
- Realtime Database のロケーション（asia-southeast1 でいいか確認）：

[あれば]
- 投影環境のメモ：
- 効果音や見た目の好み：
```

---

## 補足：セキュリティルールについて

Realtime Database を「テストモード」で作ると、**30 日後に全アクセスが拒否される**ルールが入る。
30 日以内に本番ルール（PIN 認証ベースの読み書き制御）に差し替える必要があるが、これはこちらで実装時に提示する。
当日の勉強会まで時間がない場合は気にしなくて OK、まずテストモードで動かす。
