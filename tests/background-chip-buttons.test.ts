import { describe, expect, it } from "vitest";

import { bindBackgroundChipButtons } from "../src/app/background-chip-buttons";

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

describe("app/background-chip-buttons", () => {
  it("toggles pressed state when a background chip button is clicked", () => {
    const button = new FakeButton() as unknown as HTMLButtonElement &
      FakeButton;

    bindBackgroundChipButtons([button]);

    expect(button.getAttribute("aria-pressed")).toBe("false");

    button.click();

    expect(button.dataset.pressed).toBe("true");
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });
});
