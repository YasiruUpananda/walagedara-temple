import { test, expect, type Page } from "@playwright/test";

// Layout-only fixtures: no real user session or backend writes are used.
const notice = {
  id: "layout-notice",
  title: "විහාරස්ථානයේ විශේෂ සෙත් කවි වැඩසටහන පිළිබඳ දැනුම්දීම",
  type: "text",
  heading: "සෙත් කවි කියවීමේ වැඩසටහන",
  message: "කරුණාවෙන් ඔබගේ වාරය පැමිණෙන තුරු රැඳී සිටින්න. ".repeat(7),
  image_url: null,
  storage_path: null,
  duration_seconds: 10,
  display_order: 0,
  is_active: true,
};
async function fixtures(page: Page) {
  await page.route("**/src/lib/supabase.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "export const configured=true; export const supabase=null; export const client=()=>({auth:{signOut:async()=>({error:null})}});",
    }),
  );
  await page.route("**/src/features/auth/AuthProvider.tsx*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'export const AuthProvider=({children})=>children; export const useAuth=()=>({ready:true,admin:!location.pathname.endsWith("login"),session:{},recheck:async()=>true});',
    }),
  );
  await page.route("**/src/features/display/DisplayProvider.tsx*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export const DisplayProvider=({children})=>children; export const useDisplay=()=>({connected:true,refresh:async()=>{},state:{id:1,current_number:9999,revision:1,service_paused:location.search.includes('paused'),active_ads:location.search.includes('empty')?[]:[${JSON.stringify(notice)}]}});`,
    }),
  );
  await page.route("**/src/lib/api.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export const listAds=async()=>[${JSON.stringify(notice)}]; export const rpc=async()=>({}); export const cleanupImage=async()=>{}; export const saveAd=async()=>({oldPath:null});`,
    }),
  );
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const dialog = page.locator("dialog[open]");
  if (await dialog.count()) {
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
}
for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 1920, height: 1080 },
]) {
  test(`Sinhala layouts fit ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await fixtures(page);
    await page.goto("/");
    await expect(page.getByText("9999", { exact: true })).toBeVisible();
    await fits(page);
    const number = await page.locator(".number-section").boundingBox();
    const ad = await page.locator(".ad-section").boundingBox();
    expect(ad!.y).toBeGreaterThanOrEqual(number!.y + number!.height - 1);
    const logo = await page.locator(".public-logo").boundingBox();
    expect(logo!.y).toBeGreaterThanOrEqual(0);
    await page.goto("/?empty");
    await expect(page.locator(".ad-section")).toHaveCount(0);
    await fits(page);
    await page.goto("/?paused");
    await expect(page.getByText("මේ දිනවල සෙත් කවි කියන්නේ නොමැති බව කරුණාවෙන් සලකන්න.")).toBeVisible();
    await expect(page.locator('.public-number')).toHaveCount(0);
    await fits(page);
    await page.goto("/admin/login");
    await expect(page.locator(".login-card")).toBeVisible();
    await fits(page);
    await page.goto("/admin/appointments");
    await expect(page.locator(".appointment-card")).toBeVisible();
    await fits(page);
    await page.locator(".reset-button").click();
    await fits(page);
    await page.locator(".dialog-heading button").click();
    await page.goto("/admin/advertisements");
    await expect(page.locator(".ad-card")).toBeVisible();
    await fits(page);
    await page.locator(".ads-heading button").click();
    await expect(page.locator("dialog")).toBeVisible();
    await fits(page);
    await page.locator("dialog select").selectOption("image");
    await fits(page);
    await page.screenshot({
      path: `test-results/notice-form-${viewport.width}.png`,
      fullPage: true,
    });
    await page.locator(".dialog-heading button").click();
    await page.locator(".ad-buttons .delete").click();
    await fits(page);
  });
}
