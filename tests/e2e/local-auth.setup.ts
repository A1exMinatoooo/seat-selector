import { chmod } from "node:fs/promises";
import { expect, test as setup } from "@playwright/test";

const authFile = "_local-test/e2e-admin.json";

setup("authenticate the local-test administrator through the login UI", async ({ page }) => {
  if (process.env.LOCAL_TEST_E2E !== "1") {
    throw new Error("The local admin setup is only available in LOCAL_TEST_E2E mode");
  }
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required for local E2E authentication");

  await page.goto("/admin/login");
  await page.getByLabel("管理员口令").fill(password);
  await page.getByRole("button", { name: "登录管理端" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.context().storageState({ path: authFile });
  await chmod(authFile, 0o600);
});
