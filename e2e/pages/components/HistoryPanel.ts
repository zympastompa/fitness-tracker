import type { Locator, Page } from "@playwright/test";

export class HistoryPanel {
  readonly list: Locator;
  readonly refreshButton: Locator;

  constructor(private readonly page: Page) {
    this.list = page.getByTestId("history-list");
    this.refreshButton = page.getByTestId("history-refresh-button");
  }

  itemBySessionId(sessionId: number): Locator {
    return this.page.locator(`[data-testid="history-item"][data-session-id="${sessionId}"]`);
  }

  async openSession(sessionId: number): Promise<void> {
    await this.itemBySessionId(sessionId).getByTestId("history-open-button").click();
  }

  async deleteSession(sessionId: number): Promise<void> {
    await this.itemBySessionId(sessionId).getByTestId("history-delete-button").click();
  }

  async refresh(): Promise<void> {
    await this.refreshButton.click();
  }
}
