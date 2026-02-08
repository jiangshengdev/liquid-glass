/**
 * 展示回退层并附加错误详情，便于在不支持 WebGPU 时诊断问题。
 * @param reason 可选失败原因。
 * @returns 无返回值。
 */
export function showFallback(reason?: unknown): void {
  // 有原因时输出控制台告警。
  if (reason) console.warn("[webgpu:fallback]", reason);
  // 获取回退容器。
  const fallbackElement = document.getElementById(
    "fallback",
  ) as HTMLDivElement | null;
  // 未找到容器直接返回。
  if (!fallbackElement) return;

  // 展示回退层。
  fallbackElement.hidden = false;
  // 无原因则不追加调试信息。
  if (!reason) return;

  // 获取回退卡片容器。
  const fallbackCard =
    fallbackElement.querySelector<HTMLDivElement>(".fallback-card");
  // 已存在调试信息时不重复追加。
  if (!fallbackCard || fallbackCard.querySelector("#fallback-debug")) return;

  // 创建预格式化文本区域。
  const debugPre = document.createElement("pre");
  // 设置调试区域 ID。
  debugPre.id = "fallback-debug";
  // 设置外边距。
  debugPre.style.margin = "12px 0 0";
  // 允许换行。
  debugPre.style.whiteSpace = "pre-wrap";
  // 允许长单词断行。
  debugPre.style.wordBreak = "break-word";
  // 设置文字颜色。
  debugPre.style.color = "rgba(255,255,255,0.75)";
  // 设置等宽字体样式。
  debugPre.style.font =
    "12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace";
  // 写入原因文本。
  debugPre.textContent = String(reason);

  // 将调试信息追加到卡片尾部，避免破坏原有结构。
  fallbackCard.appendChild(debugPre);
}
