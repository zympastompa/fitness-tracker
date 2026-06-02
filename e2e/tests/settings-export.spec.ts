import { expect, test } from "../fixtures/test";

test("settings backup and database export are available", async ({ page, ui }) => {
  await ui.goto();
  await ui.settings.open();
  await expect(ui.settings.panel).toBeVisible();

  await test.step("create backup", async () => {
    await ui.settings.createBackup();
    await expect(ui.toast("Резервная копия создана")).toBeVisible();
  });

  await test.step("export database", async () => {
    await ui.settings.open();
    await expect(ui.settings.panel).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    const exportResponsePromise = page.waitForResponse((response) => {
      return response.url().endsWith("/api/export-db");
    });

    await ui.settings.exportDatabase();
    const [download, exportResponse] = await Promise.all([
      downloadPromise,
      exportResponsePromise
    ]);

    expect(download.suggestedFilename()).toBe("fitness_tracker.sqlite3");
    expect(exportResponse.headers()["content-type"]).toContain("application/octet-stream");
    expect(exportResponse.headers()["content-disposition"]).toContain("fitness_tracker.sqlite3");
  });
});
