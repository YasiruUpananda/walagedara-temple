import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";
Object.assign(process.env, loadEnv("test", process.cwd(), ""));
export default defineConfig({
  timeout: 90000,
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  webServer: {
    command: `${process.platform === "win32" ? "npm.cmd" : "npm"} run dev -- --port 5173 --mode test`,
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
