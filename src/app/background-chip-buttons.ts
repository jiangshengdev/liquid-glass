/**
 * 绑定背景 HTML chip 按钮的点击状态。
 * @param buttons 背景层中的 chip 按钮集合。
 * @returns 无返回值。
 */
export function bindBackgroundChipButtons(
  buttons: Iterable<HTMLButtonElement>,
): void {
  for (const button of buttons) {
    button.dataset.pressed = button.dataset.pressed ?? "false";
    button.setAttribute("aria-pressed", button.dataset.pressed);

    button.addEventListener("click", () => {
      const nextPressed = button.dataset.pressed !== "true";
      button.dataset.pressed = String(nextPressed);
      button.setAttribute("aria-pressed", String(nextPressed));
    });
  }
}
