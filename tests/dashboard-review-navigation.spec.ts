import { expect, test } from "playwright/test";

test.describe("Overview review interaction", () => {
  test("each dashboard change opens its exact Daily Review finding and Back returns to Dashboard", async ({ page }) => {
    await page.goto("/");

    const landingChanges = page.getByTestId("dashboard-recent-change");
    await expect(landingChanges).toHaveCount(3);

    for (let index = 0; index < await landingChanges.count(); index += 1) {
      const card = landingChanges.nth(index);
      await expect(card.getByText("Evidence", { exact: true })).toBeVisible();
      const title = (await card.getByRole("heading").textContent())?.trim();
      const action = card.getByRole("link");
      const href = await action.getAttribute("href");
      expect(href).toBeTruthy();
      expect(href).toMatch(/\/ai-cfo\/daily-review\?reviewId=.*#finding-/);

      await action.click();
      await expect(page).toHaveURL(/\/ai-cfo\/daily-review\?reviewId=.*#finding-/);
      const target = page.locator(decodeURIComponent(new URL(page.url()).hash));
      await expect(target).toBeVisible();
      await expect(target.getByRole("heading", { name: title })).toBeVisible();

      await page.getByRole("link", { name: "Back to Dashboard" }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByTestId("dashboard-recent-changes")).toBeVisible();
    }
  });
});
