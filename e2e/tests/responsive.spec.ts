import { expect, test } from "../fixtures/test";
import { expectNoHorizontalScroll } from "../assertions/layoutAssertions";

const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "mobile", width: 390, height: 844 }
];

for (const viewport of viewports) {
  test(`responsive smoke at ${viewport.name} viewport`, async ({ page, ui }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height
    });
    await ui.goto();

    await expect(ui.workouts.tabs).toBeVisible();
    await ui.workouts.select("B");
    await expect(ui.session.activeArea).toContainText("Тренировка B");

    await ui.settings.open();
    await expect(ui.settings.panel).toBeVisible();
    await ui.settings.close();
    await expect(ui.settings.panel).toBeHidden();

    await expectNoHorizontalScroll(page);
  });
}
