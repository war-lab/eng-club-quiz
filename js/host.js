// =========================================
// ホスト画面ロジック
// =========================================

// ----- 状態 -----
const hostId = randomId(16);
let currentPin = null;
let currentQuizSet = null;          // 読み込んだ JSON 全体
let currentQuestionIndex = -1;       // 現在の問題インデックス
let scoreMode = "speed";            // "speed" | "flat"
let timerHandle = null;
let answersListenerRef = null;
let playersListenerRef = null;
let revealed = false;                // 現在問題が締切済みか

// ----- DOM 取得 -----
const $ = (id) => document.getElementById(id);
const setupSection = $("phase-setup");
const waitingSection = $("phase-waiting");
const questionSection = $("phase-question");
const finishedSection = $("phase-finished");

// ----- 起動 -----
window.addEventListener("DOMContentLoaded", async () => {
  await loadQuizSetList();
  bindEvents();
});

// ----- 参加用QRコード描画 -----
// 同じURLでも再描画できるよう、毎回コンテナをクリアしてから生成する
function renderJoinQr(url) {
  const el = $("qr-code");
  if (!el) return;
  el.innerHTML = "";
  if (typeof QRCode === "undefined") {
    el.textContent = "QRライブラリが読み込めません";
    return;
  }
  new QRCode(el, {
    text: url,
    width: 180,
    height: 180,
    colorDark: "#111827",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}

// ----- 問題セット一覧の読み込み -----
// questions/index.json に { sets: [ {file, name}, ... ] } の形式で並べる
async function loadQuizSetList() {
  const select = $("quiz-set-select");
  try {
    const res = await fetch("questions/index.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("index.json が読み込めません");
    const idx = await res.json();
    select.innerHTML = "";
    for (const item of idx.sets) {
      const opt = document.createElement("option");
      opt.value = item.file;
      opt.textContent = item.name;
      select.appendChild(opt);
    }
  } catch (e) {
    console.error(e);
    $("setup-error").textContent = "問題セット一覧の読み込みに失敗しました: " + e.message;
  }
}

// ----- イベント登録 -----
function bindEvents() {
  $("btn-create-room").addEventListener("click", onCreateRoom);
  $("btn-start-quiz").addEventListener("click", onStartQuiz);
  $("btn-reveal").addEventListener("click", () => revealAnswer(/* manual */ true));
  $("btn-next").addEventListener("click", onNextQuestion);
  $("btn-close-room").addEventListener("click", onCloseRoom);

  document.querySelectorAll('input[name="score-mode"]').forEach((el) => {
    el.addEventListener("change", (e) => { scoreMode = e.target.value; });
  });
}

// ----- ルーム作成 -----
async function onCreateRoom() {
  $("setup-error").textContent = "";
  const file = $("quiz-set-select").value;
  if (!file) {
    $("setup-error").textContent = "問題セットを選択してください";
    return;
  }

  // 問題 JSON 読み込み
  try {
    const res = await fetch("questions/" + file, { cache: "no-cache" });
    if (!res.ok) throw new Error("問題ファイルが読み込めません: " + file);
    currentQuizSet = await res.json();
  } catch (e) {
    $("setup-error").textContent = e.message;
    return;
  }

  // PIN 生成（衝突は社内規模なら現実的に無視）
  currentPin = generatePin();

  // Firebase 書き込み
  const roomRef = db.ref("rooms/" + currentPin);
  await roomRef.set({
    meta: {
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      hostId: hostId,
      quizSetName: file.replace(/\.json$/, ""),
      status: "waiting"
    }
  });

  // localStorage にホスト識別を保存（リロード時の再接続余地）
  try { localStorage.setItem("eng-club-quiz:hostId:" + currentPin, hostId); } catch (_) {}

  // 画面遷移
  $("pin-value").textContent = currentPin;
  const joinUrl = location.origin + location.pathname.replace(/host\.html$/, "") + "join.html";
  $("join-url-hint").textContent = joinUrl;
  renderJoinQr(joinUrl);
  showPhase("phase-waiting");

  // 参加者の入室を監視
  playersListenerRef = db.ref("rooms/" + currentPin + "/players");
  playersListenerRef.on("value", (snap) => {
    const players = snap.val() || {};
    const list = Object.values(players);
    $("player-count").textContent = list.length;
    const ul = $("player-list");
    ul.innerHTML = "";
    list
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
      .forEach((p) => {
        const li = document.createElement("li");
        li.textContent = p.nickname;
        ul.appendChild(li);
      });
    $("btn-start-quiz").disabled = list.length === 0;
  });
}

// ----- クイズ開始 -----
async function onStartQuiz() {
  if (!currentQuizSet) return;
  await db.ref("rooms/" + currentPin + "/meta/status").set("playing");
  $("q-total").textContent = currentQuizSet.questions.length;
  currentQuestionIndex = -1;
  await showNextQuestion();
}

// ----- 次の問題表示 -----
async function showNextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex >= currentQuizSet.questions.length) {
    await onAllFinished();
    return;
  }
  const q = currentQuizSet.questions[currentQuestionIndex];
  const limitSec = q.timeLimitSec || currentQuizSet.defaultTimeLimitSec || 20;
  const startedAt = Date.now();
  const deadline = startedAt + limitSec * 1000;
  revealed = false;

  // 画面更新
  showPhase("phase-question");
  $("q-index").textContent = currentQuestionIndex + 1;
  $("q-text").textContent = q.text;
  const choicesEl = $("q-choices");
  choicesEl.innerHTML = "";
  q.choices.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "choice c" + i;
    div.innerHTML =
      '<span class="choice-marker">' + ANSWER_MARKERS[i] + '</span>' +
      '<span class="choice-text">' + escapeHtml(c) + '</span>';
    div.dataset.idx = i;
    choicesEl.appendChild(div);
  });
  $("q-stats").classList.add("hidden");
  $("btn-reveal").classList.remove("hidden");
  $("btn-next").classList.add("hidden");

  // 回答済み人数カウンタ初期化
  const playersSnap = await db.ref("rooms/" + currentPin + "/players").get();
  const players = playersSnap.val() || {};
  $("total-players").textContent = Object.keys(players).length;
  $("answered-count").textContent = "0";

  // Firebase に出題 (前問の correct を残さないため明示的に上書き)
  await db.ref("rooms/" + currentPin + "/currentQuestion").set({
    index: currentQuestionIndex,
    startedAt: startedAt,
    deadline: deadline,
    phase: "answering",
    correct: null
  });

  // タイマー開始（締切で自動的に reveal）
  startTimer(deadline);

  // 回答監視 (回答中: 司会者向けに「回答済み n / m」をリアルタイム更新)
  if (answersListenerRef) answersListenerRef.off();
  answersListenerRef = db.ref("rooms/" + currentPin + "/answers/" + currentQuestionIndex);
  answersListenerRef.on("value", (snap) => {
    const answers = snap.val() || {};
    $("answered-count").textContent = Object.keys(answers).length;
  });
}

function startTimer(deadlineMs) {
  if (timerHandle) clearInterval(timerHandle);
  const tick = () => {
    const remain = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
    $("q-timer").textContent = remain;
    if (remain <= 5) $("q-timer").parentElement.classList.add("danger");
    else $("q-timer").parentElement.classList.remove("danger");
    if (remain <= 0) {
      clearInterval(timerHandle);
      timerHandle = null;
      if (!revealed) revealAnswer(/* manual */ false);
    }
  };
  tick();
  timerHandle = setInterval(tick, 250);
}

// ----- 正解発表 -----
async function revealAnswer(manual) {
  if (revealed) return;
  revealed = true;
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }

  const q = currentQuizSet.questions[currentQuestionIndex];
  const limitSec = q.timeLimitSec || currentQuizSet.defaultTimeLimitSec || 20;

  // 回答スナップショット読み込み
  const snap = await db.ref("rooms/" + currentPin + "/answers/" + currentQuestionIndex).get();
  const answers = snap.val() || {};

  // 各 choice の票数集計
  const counts = [0, 0, 0, 0];
  for (const pid in answers) {
    const a = answers[pid];
    if (typeof a.choice === "number" && a.choice >= 0 && a.choice < 4) counts[a.choice]++;
  }
  const total = counts.reduce((a, b) => a + b, 0);

  // 選択肢ハイライト
  document.querySelectorAll("#q-choices .choice").forEach((el) => {
    const idx = Number(el.dataset.idx);
    if (idx === q.correct) el.classList.add("correct");
    else el.classList.add("wrong");
  });

  // 分布表示
  const distEl = $("q-distribution");
  distEl.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
    const bar = document.createElement("div");
    bar.className = "dist-bar";
    bar.innerHTML =
      '<div class="dist-label">' + ["①", "②", "③", "④"][i] + ' (' + counts[i] + ')</div>' +
      '<div class="dist-fill ' + (i === q.correct ? "correct-fill" : "") + '" ' +
      'style="height: ' + Math.max(8, pct) + '%;">' + pct + '%</div>';
    distEl.appendChild(bar);
  }

  // 解説
  $("q-explanation").textContent = q.explanation || "（解説なし）";

  // スコア計算と書き込み（クライアント集計）
  // - players ノードを取得して、回答済みの正解者にスコア加算
  const playersSnap = await db.ref("rooms/" + currentPin + "/players").get();
  const players = playersSnap.val() || {};
  const startedAtSnap = await db.ref("rooms/" + currentPin + "/currentQuestion/startedAt").get();
  const startedAt = startedAtSnap.val() || Date.now();

  const updates = {};
  for (const pid in players) {
    const a = answers[pid];
    let gained = 0;
    if (a && a.choice === q.correct) {
      if (scoreMode === "flat") {
        gained = 1000;
      } else {
        const elapsedSec = Math.max(0, ((a.answeredAt || startedAt) - startedAt) / 1000);
        const remainRatio = Math.max(0, (limitSec - elapsedSec) / limitSec);
        gained = Math.round(1000 * remainRatio);
      }
    }
    const newScore = (players[pid].score || 0) + gained;
    updates["players/" + pid + "/score"] = newScore;
    // 各プレイヤーごとに「直近の獲得点」を書いておく（参加者画面で表示）
    updates["players/" + pid + "/lastGained"] = gained;
    updates["players/" + pid + "/lastQuestionIndex"] = currentQuestionIndex;
  }
  await db.ref("rooms/" + currentPin).update(updates);

  // スコア書き込み完了後に phase を revealed に進める
  // （参加者側は phase === "revealed" を検知して lastGained を読みに行くので、
  //   先に phase を書くと前問の lastGained が読まれて誤判定になる）
  // 同時に correct を書き込んで、参加者画面で正解番号を表示できるようにする
  await db.ref("rooms/" + currentPin + "/currentQuestion").update({
    phase: "revealed",
    correct: q.correct
  });

  // 上位 5 名表示
  const updatedSnap = await db.ref("rooms/" + currentPin + "/players").get();
  const updatedPlayers = updatedSnap.val() || {};
  const ranked = Object.values(updatedPlayers).sort((a, b) => (b.score || 0) - (a.score || 0));
  const top5 = $("q-top5");
  top5.innerHTML = "";
  ranked.slice(0, 5).forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.nickname + " — " + (p.score || 0) + " 点";
    top5.appendChild(li);
  });

  // ボタン切替
  $("q-stats").classList.remove("hidden");
  $("btn-reveal").classList.add("hidden");
  $("btn-next").classList.remove("hidden");
}

// ----- 次の問題 -----
async function onNextQuestion() {
  await showNextQuestion();
}

// ----- 全問終了 -----
async function onAllFinished() {
  await db.ref("rooms/" + currentPin + "/meta/status").set("finished");
  await db.ref("rooms/" + currentPin + "/currentQuestion/phase").set("finished");

  // 最終ランキング
  const playersSnap = await db.ref("rooms/" + currentPin + "/players").get();
  const players = playersSnap.val() || {};
  const ranked = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0));
  const ol = $("final-ranking");
  ol.innerHTML = "";
  ranked.slice(0, 10).forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.nickname + " — " + (p.score || 0) + " 点";
    ol.appendChild(li);
  });

  showPhase("phase-finished");
}

// ----- ルームを閉じる -----
async function onCloseRoom() {
  if (!currentPin) return;
  if (!confirm("ルームを閉じて全データを削除します。よろしいですか？")) return;
  await db.ref("rooms/" + currentPin).remove();
  alert("ルームを閉じました。");
  location.reload();
}
