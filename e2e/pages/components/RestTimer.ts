import type { Locator, Page } from "@playwright/test";

export class RestTimer {
  readonly root: Locator;
  readonly timer: Locator;
  readonly value: Locator;
  readonly pauseButton: Locator;
  readonly plusButton: Locator;
  readonly minusButton: Locator;
  readonly skipButton: Locator;
  readonly nextSetButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("rest-timer");
    this.timer = this.root;
    this.value = page.getByTestId("timer-value");
    this.pauseButton = page.getByTestId("timer-pause-button");
    this.plusButton = page.getByTestId("timer-plus-button");
    this.minusButton = page.getByTestId("timer-minus-button");
    this.skipButton = page.getByTestId("timer-skip-button");
    this.nextSetButton = page.getByTestId("timer-next-set-button");
    this.closeButton = page.getByTestId("timer-close-button");
  }

  async pause(): Promise<void> {
    await this.pauseButton.click();
  }

  async resume(): Promise<void> {
    await this.pauseButton.click();
  }

  async add30Seconds(): Promise<void> {
    await this.plusButton.click();
  }

  async subtract15Seconds(): Promise<void> {
    await this.minusButton.click();
  }

  async skip(): Promise<void> {
    await this.skipButton.click();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }

  async secondsRemaining(): Promise<number> {
    const value = await this.value.innerText();
    const [minutes, seconds] = value.split(":").map((part) => Number(part));
    return minutes * 60 + seconds;
  }
}
