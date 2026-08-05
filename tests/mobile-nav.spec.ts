import { expect, test, devices } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

test.describe("Vireon mobile navigation", () => {
  test("hamburger opens and closes the mobile drawer", async ({ page }) => {
    await page.goto("http://localhost:3000");

    const hamburger = page.getByRole("button", { name: /open navigation menu/i });
    const drawer = page.locator("aside.fixed.inset-y-0.right-0");

    await expect(hamburger).toBeVisible();
    await expect(hamburger).toHaveAttribute("aria-expanded", "false");
    await expect(drawer).toHaveCount(0);

    await page.screenshot({ path: "mobile-before-click.png" });

    await hamburger.click();

    await expect(hamburger).toHaveAttribute("aria-expanded", "true");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Dashboard" })).toBeVisible();

    await page.screenshot({ path: "mobile-after-click.png" });

    await page.keyboard.press("Escape");

    await expect(hamburger).toHaveAttribute("aria-expanded", "false");
    await expect(drawer).toHaveCount(0);

    await hamburger.click();

    await expect(hamburger).toHaveAttribute("aria-expanded", "true");
    await expect(drawer).toBeVisible();

    const backdropCloseButton = page.getByRole("button", {
      name: /close navigation menu/i,
    });
    await backdropCloseButton.click();

    await expect(hamburger).toHaveAttribute("aria-expanded", "false");
    await expect(drawer).toHaveCount(0);

    await hamburger.tap();

    await expect(hamburger).toHaveAttribute("aria-expanded", "true");
    await expect(drawer).toBeVisible();
  });
});
