import type { Locator, Page, Response } from "@playwright/test";

export class SettingsPanel {
  readonly panel: Locator;
  readonly openButton: Locator;
  readonly closeButton: Locator;
  readonly backupButton: Locator;
  readonly exportLink: Locator;

  constructor(private readonly page: Page) {
    this.panel = page.getByTestId("settings-panel");
    this.openButton = page.getByTestId("settings-open-button");
    this.closeButton = page.getByTestId("settings-close-button");
    this.backupButton = page.getByTestId("backup-create-button");
    this.exportLink = page.getByTestId("database-export-link");
  }

  async open(): Promise<void> {
    await this.openButton.click();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }

  async createBackup(): Promise<Response> {
    const responsePromise = this.page.waitForResponse((response) => {
      return response.url().endsWith("/api/backup") && response.request().method() === "POST";
    });
    await this.backupButton.click();
    return responsePromise;
  }

  async exportDatabase(): Promise<void> {
    await this.exportLink.click();
  }
}
