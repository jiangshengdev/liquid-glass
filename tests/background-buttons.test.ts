import { describe, expect, it } from "vitest";

import { bindBackgroundButtons } from "../src/app/background-buttons";

class FakeButton {
  dataset: Record<string, string> = {};
  private attributes: Record<string, string> = {};
  private listeners: Array<() => void> = [];

  addEventListener(type: string, listener: () => void): void {
    if (type === "click") this.listeners.push(listener);
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  getAttribute(name: string): string | undefined {
    return this.attributes[name];
  }

  click(): void {
    for (const listener of this.listeners) listener();
  }
}

describe("app/background-buttons", () => {
  it("records clicks without adding toggle semantics", () => {
    const button = new FakeButton() as unknown as HTMLButtonElement &
      FakeButton;

    bindBackgroundButtons([button]);

    expect(button.dataset.clickCount).toBe("0");
    expect(button.getAttribute("aria-pressed")).toBeUndefined();

    button.click();

    expect(button.dataset.clickCount).toBe("1");
    expect(button.getAttribute("aria-pressed")).toBeUndefined();
  });
});
