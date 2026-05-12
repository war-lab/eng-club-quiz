// =========================================
// 参加者画面ロジック
// =========================================

// ----- 状態 -----
const playerId = randomId(16);
let currentPin = null;
let myNickname = "";
let currentQIndex = -1;
let timerHandle = null;
let questionListenerRef = null;
let metaListenerRef = null;
let myScoreListenerRef = null;
let myChoice = null;
let mySubmittedQ = -1;

const $ = (id) => document.getElementById(id);

window.addEventListener("DOMContentLoaded", () => {
  $("btn-join").addEventListener("click", onJoin);
  document.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => onAnswer(Number(btn.dataset.choice)));
  });

  // URL クエリ ?pin=123456 で自動入力
  const params = new URLSearchParams(location.search);
  if (params.has("pin")) $("input-pin").value = params.get("pin");
});

// ----- 入室 -----
async function onJoin() {
  $("entry-error").textContent = "";
  const pin = ($("input-pin").value || "").trim();
  const nick = ($("input-nick").value || "").trim();

  if (!/^\d{6}$/.test(pin)) {
    $("entry-error").textContent = "PIN は 6 桁の数字で入力してください";
    return;
  }
  if (!nick) {
    $("entry-error").textContent = "ニックネームを入力してください";
    return;
  }

  // ルームの存在確認
  const metaSnap = await db.ref("rooms/" + pin + "/meta").get();
  if (!metaSnap.exists()) {
    $("entry-error").textContent = "そのPINのルームは存在しません";
    return;
  }
  const meta = metaSnap.val();
  if (meta.status === "finished") {
    $("entry-error").textContent = "このルームは既に終了しています";
    return;
  }

  currentPin = pin;
  myNickname = nick;

  // players に書き込み
  await db.ref("rooms/" + currentPin + "/players/" + playerId).set({
    nickname: nick,
    joinedAt: firebase.database.ServerValue.TIMESTAMP,
    score: 0
  });

  // 画面遷移
  $("hello-nick").textContent = "ようこそ、" + nick + " さん";
  showPhase("phase-waiting");

  // 出題リッスン
  startListeningQuestion();
  // 自分のスコア・ルーム状態リッスン
  startListeningMeta();
  startListeningMyScore();
}

function startListeningMeta() {
  metaListenerRef = db.ref("rooms/" + currentPin + "/meta/status");
  metaListenerRef.on("value", (snap) => {
    const status = snap.val();
    if (status === "finished") onFinished();
  });
}

function startListeningMyScore() {
  myScoreListenerRef = db.ref("rooms/" + currentPin + "/players/" + playerId);
  myScoreListenerRef.on("value", (snap) => {
    const p = snap.val();
    if (!p) return;
    $("my-score-wait").textContent = p.score || 0;
  });
}

function startListeningQuestion() {
  if (questionListenerRef) questionListenerRef.off();
  questionListenerRef = db.ref("rooms/" + currentPin + "/currentQuestion");
  questionListenerRef.on("value", (snap) => {
    const q = snap.val();
    if (!q) return;

    if (q.phase === "answering") {
      if (q.index !== currentQIndex) {
        // 新しい問題
        currentQIndex = q.index;
        myChoice = null;
        mySubmittedQ = -1;
        enterAnswerPhase(q);
      }
    } else if (q.phase === "revealed") {
      if (currentQIndex === q.index) {
        enterResultPhase();
      }
    } else if (q.phase === "finished") {
      onFinished();
    }
  });
}

// ----- 回答フェーズ -----
function enterAnswerPhase(q) {
  showPhase("phase-answer");
  $("j-q-index").textContent = (q.index || 0) + 1;
  $("answer-state").textContent = "";
  document.querySelectorAll(".choice-btn").forEach((b) => {
    b.disabled = false;
    b.classList.remove("selected");
  });
  startTimer(q.deadline);
}

function startTimer(deadlineMs) {
  if (timerHandle) clearInterval(timerHandle);
  const tick = () => {
    const remain = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
    $("j-q-timer").textContent = remain;
    if (remain <= 0) {
      clearInterval(timerHandle);
      timerHandle = null;
      document.querySelectorAll(".choice-btn").forEach((b) => { b.disabled = true; });
      if (myChoice === null) $("answer-state").textContent = "時間切れ";
    }
  };
  tick();
  timerHandle = setInterval(tick, 250);
}

async function onAnswer(choice) {
  if (currentQIndex < 0) return;
  if (mySubmittedQ === currentQIndex) return; // 二重送信防止
  myChoice = choice;
  mySubmittedQ = currentQIndex;

  document.querySelectorAll(".choice-btn").forEach((b) => {
    b.disabled = true;
    if (Number(b.dataset.choice) === choice) b.classList.add("selected");
  });
  $("answer-state").textContent = "回答を送信しました。他の参加者の回答を待っています…";

  try {
    await db.ref("rooms/" + currentPin + "/answers/" + currentQIndex + "/" + playerId).set({
      choice: choice,
      answeredAt: firebase.database.ServerValue.TIMESTAMP
    });
  } catch (e) {
    // 二重書き込みを禁止するセキュリティルールに引っかかる可能性あり（!data.exists()）
    $("answer-state").textContent = "送信に失敗しました: " + e.message;
  }
}

// ----- 結果フェーズ -----
async function enterResultPhase() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }

  // 直近データ取得
  const [meSnap, ansSnap] = await Promise.all([
    db.ref("rooms/" + currentPin + "/players/" + playerId).get(),
    db.ref("rooms/" + currentPin + "/answers/" + currentQIndex + "/" + playerId).get()
  ]);
  const me = meSnap.val() || { score: 0, lastGained: 0 };
  const myAns = ansSnap.val();

  // 正解判定（参加者画面に「正解の選択肢インデックス」を出していいかは設計上微妙だが、
  //   問題文・選択肢ラベルは出さない設計を保ちつつ、index だけ番号で表示する）
  // 正解の choice は currentQuestion に持っていないので、players.lastGained > 0 で判定する
  const isCorrect = (me.lastGained || 0) > 0 && me.lastQuestionIndex === currentQIndex;

  $("my-choice").textContent = myAns ? ["①", "②", "③", "④"][myAns.choice] : "未回答";
  $("correct-choice").textContent = isCorrect
    ? (myAns ? ["①", "②", "③", "④"][myAns.choice] : "?")
    : "（講師画面を確認）";
  $("gained-points").textContent = me.lastGained || 0;
  $("my-score").textContent = me.score || 0;

  $("result-headline").textContent = isCorrect ? "正解！" : (myAns ? "残念…" : "未回答");
  $("result-headline").className = isCorrect ? "correct" : "wrong";

  // 順位算出
  const playersSnap = await db.ref("rooms/" + currentPin + "/players").get();
  const players = playersSnap.val() || {};
  const ranked = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0));
  const myIdx = ranked.findIndex((p) => p.nickname === me.nickname);
  $("my-rank").textContent = myIdx >= 0 ? myIdx + 1 : "-";

  showPhase("phase-result");
}

// ----- 終了 -----
async function onFinished() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  const meSnap = await db.ref("rooms/" + currentPin + "/players/" + playerId).get();
  const me = meSnap.val() || { score: 0 };
  const playersSnap = await db.ref("rooms/" + currentPin + "/players").get();
  const players = playersSnap.val() || {};
  const ranked = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0));
  const myIdx = ranked.findIndex((p) => p.nickname === me.nickname);

  $("final-score").textContent = me.score || 0;
  $("final-rank").textContent = myIdx >= 0 ? myIdx + 1 : "-";
  showPhase("phase-finished");
}
