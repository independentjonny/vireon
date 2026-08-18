import { expect, test } from "playwright/test";

test.describe("Overview review interaction", () => {
  test("opens the exact overview changes, exposes actions and returns to the overview", async ({ page }) => {
    await page.goto("/");

    const landingChanges = page.getByTestId("dashboard-recent-change");
    const changeTitles = await landingChanges.locator("a").allTextContents();
    const reviewPeriod = (await page.getByText(/^Review period:/).textContent())?.replace("Review period: ", "");
    const reviewLink = page.getByTestId("overview-review-link");

    await expect(reviewLink).toHaveAttribute("href", /\/ai-cfo\/daily-review\?from=overview&reviewId=/);
    await reviewLink.click();

    await expect(page).toHaveURL(/\/ai-cfo\/daily-review\?from=overview&reviewId=/);
    const reviewSection = page.getByTestId("overview-review-changes");
    await expect(reviewSection).toBeVisible();
    await expect(reviewSection.getByText(`The same changes shown on your overview · ${reviewPeriod}`)).toBeVisible();

    const reviewChanges = reviewSection.getByTestId("overview-review-change");
    await expect(reviewChanges).toHaveCount(changeTitles.length);
    for (const title of changeTitles) {
      await expect(reviewSection.getByRole("heading", { name: title.trim() })).toBeVisible();
    }

    for (let index = 0; index < changeTitles.length; index += 1) {
      const card = reviewChanges.nth(index);
      await expect(card.getByText("Evidence", { exact: true })).toBeVisible();
      const action = card.getByRole("link").last();
      const href = await action.getAttribute("href");
      expect(href).toBeTruthy();
      expect(href).not.toBe(page.url());
    }

    await reviewSection.getByRole("link", { name: "Back to overview" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("dashboard-recent-changes")).toBeVisible();
  });
});
