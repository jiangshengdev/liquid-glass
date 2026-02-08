/**
 * 展示回退层并附加错误详情，便于在不支持 WebGPU 时诊断问题。
 * @param reason 可选失败原因。
 * @returns 无返回值。
 */
export function showFallback(reason?: unknown): void {
  if (reason) console.warn("[webgpu:fallback]", reason);
  const fallbackElement = document.getElementById(
    "fallback",
  ) as HTMLDivElement | null;
  if (!fallbackElement) return;

  fallbackElement.hidden = false;
  if (!reason) return;

  const fallbackCard =
    fallbackElement.querySelector<HTMLDivElement>(".fallback-card");
  if (!fallbackCard || fallbackCard.querySelector("#fallback-debug")) return;

  const debugPre = document.createElement("pre");
  debugPre.id = "fallback-debug";
  debugPre.style.margin = "12px 0 0";
  debugPre.style.whiteSpace = "pre-wrap";
  debugPre.style.wordBreak = "break-word";
  debugPre.style.color = "rgba(255,255,255,0.75)";
  debugPre.style.font =
    "12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace";
  debugPre.textContent = String(reason);

  // 将调试信息追加到卡片尾部，避免破坏原有结构。
  fallbackCard.appendChild(debugPre);
}
