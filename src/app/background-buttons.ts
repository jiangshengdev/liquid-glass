/**
 * 绑定背景 HTML 按钮的普通点击行为。
 * @param buttons 背景层中的按钮集合。
 * @returns 无返回值。
 */
export function bindBackgroundButtons(
  buttons: Iterable<HTMLButtonElement>,
): void {
  for (const button of buttons) {
    button.dataset.clickCount = button.dataset.clickCount ?? "0";

    button.addEventListener("click", () => {
      const currentCount = Number(button.dataset.clickCount ?? "0");
      button.dataset.clickCount = String(currentCount + 1);
    });
  }
}
