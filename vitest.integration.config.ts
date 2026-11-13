import { defineConfig, loadEnv } from "vite";
Object.assign(process.env, loadEnv("test", process.cwd(), ""));
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30000,
  },
});
