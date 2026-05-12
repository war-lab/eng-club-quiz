// 共通ユーティリティ

// 選択肢のマーカー: 番号 + 形状で色覚・投影輝度に頑健にする
// 数字はプレーン半角 (CSS で円を描く) — Unicode 丸数字 ①②③④ はフォント間で
// 描画メトリクスが揃わず特に ① ③ が大きく見えるため使わない
const ANSWER_NUMBERS = ["1", "2", "3", "4"];
const ANSWER_SHAPES = ["◆", "●", "▲", "■"];
// 結果表示・分布ラベルなど横並びの小さい表示用 (文字)
const ANSWER_MARKERS = ANSWER_NUMBERS.map((n, i) => n + " " + ANSWER_SHAPES[i]);

// 大きく表示するシェイプは Unicode だとフォントごとに大きさが揃わないため SVG 化する
// viewBox は 24x24 で固定、面積をそろえるため各図形の頂点を調整 (◆ ● ▲ ■)
const ANSWER_SHAPE_SVGS = [
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="12,2 22,12 12,22 2,12" fill="currentColor"/></svg>',
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>',
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="12,2.5 22,21.5 2,21.5" fill="currentColor"/></svg>',
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" fill="currentColor"/></svg>'
];

// 問題 JSON の選択肢先頭にある ①②③④ (マーカーと重複) を取り除く
function stripLeadingCircledNumber(s) {
  return String(s).replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "");
}

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
