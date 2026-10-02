import { defineConfig, devices } from "@playwright/test";
import { z } from "zod";

const localE2e = process.env.LOCAL_TEST_E2E === "1";
const e2eBaseUrl = localE2e
  ? z.string().url().parse(process.env.E2E_BASE_URL)
  : "http://localhost:3000";
const storageState = "_local-test/e2e-admin.json";

export default defineConfig({
  testDir: "./tests/e2e",
  ...(localE2e ? { outputDir: "_local-test/e2e-results" } : {}),
  use: { baseURL: e2eBaseUrl, trace: "on-first-retry" },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  projects: localE2e
    ? [
        { name: "local-auth", testMatch: "local-auth.setup.ts" },
        {
          name: "desktop",
          use: { ...devices["Desktop Chrome"], storageState },
          dependencies: ["local-auth"],
        },
        {
          name: "safari",
          use: { ...devices["Desktop Safari"], storageState },
          dependencies: ["local-auth"],
        },
        {
          name: "mobile",
          use: { ...devices["iPhone 14"], storageState },
          dependencies: ["local-auth"],
        },
      ]
    : [
        { name: "desktop", use: { ...devices["Desktop Chrome"] } },
        { name: "safari", use: { ...devices["Desktop Safari"] } },
        { name: "mobile", use: { ...devices["iPhone 14"] } },
      ],
  webServer: [
    {
      command: localE2e ? "pnpm exec tsx scripts/local-test.ts e2e-dev" : "pnpm dev",
      url: localE2e ? `${e2eBaseUrl}/api/health/ready` : "http://localhost:3000",
      reuseExistingServer: localE2e ? false : true,
    },
    {
      command: "node tests/browser-fixture/server.mjs",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: localE2e ? false : true,
    },
  ],
});
