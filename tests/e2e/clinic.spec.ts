import { test, expect } from "@playwright/test";
const configured = Boolean(
  process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
test("missing configuration gives honest setup instructions", async ({
  page,
}) => {
  test.skip(configured, "Configured environments use real backend tests.");
  await page.goto("/");
  await expect(
    page.getByText("ආරම්භ කිරීමට විහාරස්ථාන පද්ධතිය සම්බන්ධ කරන්න"),
  ).toBeVisible();
  await expect(page.getByText("000", { exact: true })).toHaveCount(0);
});
test.describe("real backend and separate devices", () => {
  test.skip(
    !configured ||
      !process.env.TEST_ADMIN_EMAIL ||
      !process.env.TEST_ADMIN_PASSWORD,
    "Requires a disposable Supabase backend and a provisioned admin.",
  );
  test("doctor controls the independent TV and manages advertisements", async ({
    browser,
    page,
  }) => {
    const tvContext = await browser.newContext({
      // A separate browser context has its own session and storage.
      viewport: { width: 1920, height: 1080 },
    });
    const tv = await tvContext.newPage();
    await tv.goto("/");
    await page.goto("/admin/login");
    await page.getByLabel("ඊමේල් ලිපිනය").fill(process.env.TEST_ADMIN_EMAIL!);
    await page
      .getByLabel("මුරපදය", { exact: true })
      .fill(process.env.TEST_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "පිවිසෙන්න" }).click();
    await expect(page).toHaveURL(/admin\/appointments/);
    await page.getByLabel("සෙත් කවි කියවීමේ අංකය ඇතුළත් කරන්න").fill("24");
    await page.getByRole("button", { name: "අංකය සකසන්න", exact: true }).click();
    await expect(tv.getByText("024", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "ඊළඟ බැතිමතා" }).click();
    await expect(tv.getByText("025", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "පෙර අංකය" }).click();
    await expect(tv.getByText("024", { exact: true })).toBeVisible();
    await page.reload();
    await tv.reload();
    await expect(tv.getByText("024", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "නිවේදන", exact: true }).click();
    await expect(page.getByRole("button", { name: "ඊළඟ බැතිමතා" })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "නිවේදනයක් එක් කරන්න" }).first().click();
    const title = `E2E ${Date.now()}`;
    await page.getByLabel("හඳුනාගැනීමේ නම").fill(title);
    await page.getByLabel("නිවේදන මාතෘකාව").fill("Please have a seat");
    await page
      .getByLabel("නිවේදන පණිවිඩය")
      .fill("The doctor will see you shortly.");
    await page.getByRole("button", { name: "නිවේදනය සුරකින්න" }).click();
    await expect(tv.getByText("Please have a seat")).toBeVisible();
    const number = await tv.locator(".number-section").boundingBox();
    const ad = await tv.locator(".temple-notice-section").boundingBox();
    expect(ad!.y).toBeGreaterThanOrEqual(number!.y + number!.height - 1);
    await page
      .getByRole("button", { name: `සංස්කරණය කරන්න: ${title}`, exact: true })
      .click();
    await page.getByLabel("පෙන්වන කාලය (තත්පර)").fill("3");
    await page.getByRole("button", { name: "නිවේදනය සුරකින්න" }).click();
    const imageTitle = `${title} image`;
    await page.getByRole("button", { name: "නිවේදනයක් එක් කරන්න" }).first().click();
    await page.getByLabel("නිවේදන වර්ගය").selectOption("image");
    await page.getByLabel("හඳුනාගැනීමේ නම").fill(imageTitle);
    await page.getByLabel("පෙන්වන කාලය (තත්පර)").fill("3");
    await page.getByLabel("නිවේදන රූපය").setInputFiles({
      name: "sample.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1kAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page.getByRole("button", { name: "නිවේදනය සුරකින්න" }).click();
    await expect(
      tv.getByRole("img", { name: "විහාරස්ථාන නිවේදන රූපය" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(tv.getByText("Please have a seat")).toBeVisible({
      timeout: 10000,
    });
    await page
      .getByRole("button", { name: `ඉහළට ගෙනයන්න: ${imageTitle}`, exact: true })
      .click();
    await expect(page.locator(".ad-card").first()).toContainText(imageTitle);
    await page
      .getByRole("switch", { name: `සක්‍රිය කරන්න: ${imageTitle}`, exact: true })
      .click();
    await expect(
      tv.getByRole("img", { name: "විහාරස්ථාන නිවේදන රූපය" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: `මකන්න: ${imageTitle}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "නිවේදනය මකන්න", exact: true })
      .click();
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await tv.setViewportSize(viewport);
      expect(
        await tv.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await tvContext.setOffline(true);
    await expect(tv.getByText(/සම්බන්ධතාව බිඳී ඇත/)).toBeVisible();
    await page.getByRole("link", { name: "සෙත් කවි කියවීමේ අංක පාලනය" }).click();
    await page.getByRole("button", { name: "ඊළඟ බැතිමතා" }).click();
    await tvContext.setOffline(false);
    await expect(tv.getByText("025", { exact: true })).toBeVisible({
      timeout: 25000,
    });
    await page.getByRole("link", { name: "නිවේදන", exact: true }).click();
    await page.getByRole("switch", { name: `සක්‍රිය කරන්න: ${title}` }).click();
    await expect(tv.getByText("Please have a seat")).toHaveCount(0);
    await expect(tv.locator(".temple-notice-section")).toHaveCount(0);
    await expect(tv.locator(".public-display")).not.toHaveClass(/has-notice/);
    await page
      .getByRole("button", { name: `මකන්න: ${title}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "නිවේදනය මකන්න", exact: true })
      .click();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "සෙත් කවි කියවීමේ අංක පාලනය" }).click();
    await page.getByRole("button", { name: "අංකය මුලට සකසන්න" }).click();
    await page.getByRole("button", { name: "000 ලෙස සකසන්න" }).click();
    await expect(tv.getByText("000", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "ඉවත් වන්න" }).click();
    await page.goto("/admin/advertisements");
    await expect(page).toHaveURL(/admin\/login/);
    await tvContext.close();
  });
});
