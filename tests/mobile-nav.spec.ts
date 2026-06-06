import { expect, test, devices } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

test.describe("Neven mobile navigation", () => {
  test("hamburger opens and closes the mobile drawer", async ({ page }) => {
    await page.goto("http://localhost:3000");

    const hamburger = page.getByRole("button", { name: /open navigation menu/i });
    const drawer = page.locator("aside.fixed.inset-y-0.right-0");

    await expect(hamburger).toBeVisible();
    await expect(hamburger).toHaveAttribute("aria-expanded", "false");
    await expect(drawer).toHaveCSS("pointer-events", "none");

    await page.screenshot({ path: "mobile-before-click.png" });

    await hamburger.click();

    await expect(hamburger).toHaveAttribute("aria-expanded", "true");
    await expect(drawer).toHaveCSS("pointer-events", "auto");
    await expect(drawer.getByRole("link", { name: "Overview" })).toBeVisible();

    await page.screenshot({ path: "mobile-after-click.png" });

    await page.keyboard.press("Escape");

    await expect(hamburger).toHaveAttribute("aria-expanded", "false");
    await expect(drawer).toHaveCSS("pointer-events", "none");

    await hamburger.click();

    await expect(hamburger).toHaveAttribute("aria-expanded", "true");
    await expect(drawer).toHaveCSS("pointer-events", "auto");

    const backdropCloseButton = page.getByRole("button", {
      name: /close navigation menu/i,
    });
    await backdropCloseButton.click();

    await expect(hamburger).toHaveAttribute("aria-expanded", "false");
    await expect(drawer).toHaveCSS("pointer-events", "none");

    await hamburger.tap();

    await expect(hamburger).toHaveAttribute("aria-expanded", "true");
    await expect(drawer).toHaveCSS("pointer-events", "auto");
  });
});
