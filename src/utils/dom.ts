// @ts-nocheck
export function showFallback(reason) {
  if (reason) console.warn("[webgpu:fallback]", reason);
  const el = document.getElementById("fallback");
  if (!el) return;

  el.hidden = false;
  if (!reason) return;

  const card = el.querySelector(".fallback-card");
  if (!card || card.querySelector("#fallback-debug")) return;

  const pre = document.createElement("pre");
  pre.id = "fallback-debug";
  pre.style.margin = "12px 0 0";
  pre.style.whiteSpace = "pre-wrap";
  pre.style.wordBreak = "break-word";
  pre.style.color = "rgba(255,255,255,0.75)";
  pre.style.font = `12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
  pre.textContent = String(reason);
  card.appendChild(pre);
}
