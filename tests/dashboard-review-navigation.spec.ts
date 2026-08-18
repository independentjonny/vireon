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
      expect(href).toMatch(/\/ai-cfo\/daily-review\?reviewId=.*&findingId=/);

      await action.click();
      await expect(page).toHaveURL(/\/ai-cfo\/daily-review\?reviewId=.*&findingId=/);
      const target = page.getByTestId("daily-review-selected-finding");
      await expect(target).toBeVisible();
      await expect(target.getByText("Evidence and assumptions", { exact: true })).toBeVisible();
      await expect(target.getByRole("heading", { name: title })).toBeVisible();
      await expect(page.getByRole("heading", { name: title })).toHaveCount(1);
      await expect(target.getByText(/compared/i).first()).toBeVisible();

      const selectedToggle = target.getByRole("button").first();
      await expect(selectedToggle).toHaveAttribute("aria-expanded", "true");
      await selectedToggle.click();
      await expect(selectedToggle).toHaveAttribute("aria-expanded", "false");
      await expect(target.getByText("Evidence and assumptions", { exact: true })).toBeHidden();
      await selectedToggle.click();
      await expect(target.getByText("Evidence and assumptions", { exact: true })).toBeVisible();

      await page.getByRole("link", { name: "Back to Dashboard" }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByTestId("dashboard-recent-changes")).toBeVisible();
    }
  });

  test("dashboard and detailed review stack without horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("dashboard-recent-change")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.getByTestId("dashboard-recent-change").first().getByRole("link").click();
    await expect(page.getByTestId("daily-review-selected-finding")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole("link", { name: "Back to Dashboard" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
