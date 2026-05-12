// 共通ユーティリティ

// 選択肢のマーカー: 番号 + 形状で色覚・投影輝度に頑健にする
const ANSWER_MARKERS = ["① ◆", "② ●", "③ ▲", "④ ■"];

// 6桁の数字 PIN を生成（先頭 0 あり）
function generatePin() {
  const n = Math.floor(Math.random() * 1000000);
  return String(n).padStart(6, "0");
}

// 短いランダム ID（ホスト識別 / プレイヤー識別用）
function randomId(len = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

// HTML エスケープ（ニックネーム表示用）
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 画面切り替え：指定 ID の section だけ表示
function showPhase(activeId) {
  document.querySelectorAll("section.phase").forEach((el) => {
    if (el.id === activeId) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
}
