// Firebase の設定。
// 値はセットアップ作業（eng-club-quiz_セットアップ作業.md）後、
// Firebase コンソールから取得した firebaseConfig をここに貼り付ける。
//
// 注意：apiKey は公開前提（README §7-3 参照）。
//       Firebase の Web API キーは「どの Firebase プロジェクトに接続するか」を示すだけで、
//       アクセス制御は Realtime Database のセキュリティルール側で行う。
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// 初期化（compat 版 API）
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
