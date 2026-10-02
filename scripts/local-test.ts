import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { z } from "zod";
import {
  appEnvironment,
  caDirectory,
  configOverridesSchema,
  initializeLocalTestConfig,
  loadLocalTestConfig,
  localDirectory,
  root,
  validateLocalTestCertificate,
  type LocalTestConfig,
} from "./local-test/config";
import {
  prepareLocalTestDatabase,
  readLocalTestDatabaseInfo,
  withLocalTestDb,
} from "../src/server/db/local-test-database";
import { readLocalTestFixtureManifest, seedLocalTestData } from "../src/server/db/local-test-seed";
import { createParticipantCsvTemplate } from "../src/features/participants/import";

process.chdir(root);
function composeArgs(args: string[]): string[] {
  return [
    "compose",
    "--env-file",
    "/dev/null",
    "-p",
    "pickseat-local-test",
    "-f",
    "compose.local-test.yaml",
    ...args,
  ];
}
function composeEnv(config: LocalTestConfig): NodeJS.ProcessEnv {
  return {
    ...process.env,
    POSTGRES_PASSWORD: config.databasePassword,
    LOCAL_TEST_DB_PORT: String(config.dbPort),
  };
}
function capture(command: string, args: string[], env = process.env): string {
  const result = spawnSync(command, args, { cwd: root, env, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(`${command} ${args[0] ?? ""} failed (exit ${result.status ?? "unavailable"}).`);
  return result.stdout.trim();
}
async function run(command: string, args: string[], env = process.env): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
    const interrupt = () => {
      child.kill("SIGINT");
    };
    const terminate = () => {
      child.kill("SIGTERM");
    };
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    const cleanup = () => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
    };
    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      cleanup();
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code ?? signal}`));
    });
  });
}
async function assertFree(port: number, host: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Port ${host}:${port} unavailable; stop your local:dev before reset/e2e, or explicitly configure a free port. No existing process was stopped.`,
        ),
      ),
    );
    server.listen(port, host, () => server.close((error) => (error ? reject(error) : resolve())));
  });
}
function prerequisites(): void {
  if (Number(process.versions.node.split(".")[0]) !== 24) throw new Error("Node 24 required");
  if (!capture("pnpm", ["--version"]).startsWith("11.")) throw new Error("pnpm 11 required");
  capture("docker", ["info", "--format", "{{.ServerVersion}}"]);
}
const inspectionSchema = z
  .array(
    z.object({
      Config: z.object({ Labels: z.record(z.string(), z.string()) }),
      NetworkSettings: z.object({
        Ports: z.record(
          z.string(),
          z.array(z.object({ HostIp: z.string(), HostPort: z.string() })).nullable(),
        ),
      }),
    }),
  )
  .length(1);
function validateContainer(config: LocalTestConfig): void {
  const id = capture("docker", composeArgs(["ps", "-q", "db"]), composeEnv(config));
  if (!id || id.includes("\n")) throw new Error("Expected one running managed database container");
  const [container] = inspectionSchema.parse(JSON.parse(capture("docker", ["inspect", id])));
  const labels = container!.Config.Labels;
  const ports = container!.NetworkSettings.Ports["5432/tcp"];
  if (
    labels["com.docker.compose.project"] !== "pickseat-local-test" ||
    labels["com.docker.compose.service"] !== "db" ||
    ports?.length !== 1 ||
    ports[0]?.HostIp !== "127.0.0.1" ||
    ports[0]?.HostPort !== String(config.dbPort)
  )
    throw new Error("Managed database labels or published loopback port mismatch");
}
const basicRows = [
  ["测试单人", "9001", 1, 0],
  ["测试双人", "9002", 1, 1],
  ["测试三人", "9003", 2, 1],
  ["测试豁免", "9004", 1, 0],
  ["测试已选一", "9005", 1, 0],
  ["测试已选二", "9006", 2, 0],
  ["碰撞完整甲", "00000008001", 1, 0],
  ["碰撞完整乙", "00000018001", 1, 0],
  ["碰撞尾号", "8001", 1, 0],
  ["候选尾号甲", "8002", 1, 0],
  ["候选尾号乙", "8002", 1, 0],
  ["测试混合票", "9007", 1, 2],
];
function writeFixtures(): void {
  const directory = join(localDirectory, "fixtures");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const header = createParticipantCsvTemplate([
    { id: "normal", name: "普通票" },
    { id: "student", name: "学生票" },
  ]);
  for (const [name, rows] of [
    ["preregistered.csv", basicRows],
    [
      "import-valid.csv",
      [
        ["导入甲", "9101", 1, 0],
        ["导入乙", "9102", 0, 2],
      ],
    ],
    ["import-invalid.csv", [["导入错误", "9103", -1, 0]]],
  ] as const)
    writeFileSync(
      join(directory, name),
      header + rows.map((row) => row.join(",")).join("\r\n") + "\r\n",
      { mode: 0o600 },
    );
}
async function prepare(
  config: LocalTestConfig,
  target: "manual" | "e2e",
  reset = false,
): Promise<void> {
  validateContainer(config);
  const input = { port: config.dbPort, password: config.databasePassword, target };
  const status = await prepareLocalTestDatabase({ ...input, reset });
  await run("pnpm", ["db:migrate"], appEnvironment(config, target));
  if (status === "seeded") return;
  await withLocalTestDb(input, (db) => seedLocalTestData(db, { now: new Date() }));
  if (target === "manual") writeFixtures();
  console.log(`${target} synthetic baseline prepared.`);
}
async function init(
  overrides: z.infer<typeof configOverridesSchema> = {},
): Promise<LocalTestConfig> {
  prerequisites();
  const existing = existsSync(join(localDirectory, "config.json"))
    ? loadLocalTestConfig()
    : undefined;
  if (existing) {
    await assertFree(overrides.appPort ?? existing.appPort, overrides.lanIp ?? existing.lanIp);
    const running = capture("docker", composeArgs(["ps", "-q", "db"]), composeEnv(existing));
    if (running) {
      validateContainer(existing);
      await prepareLocalTestDatabase({
        port: existing.dbPort,
        password: existing.databasePassword,
        target: "manual",
        reset: false,
      });
    }
    if (!running || (overrides.dbPort !== undefined && overrides.dbPort !== existing.dbPort))
      await assertFree(overrides.dbPort ?? existing.dbPort, "127.0.0.1");
  }
  const config = initializeLocalTestConfig(overrides);
  await run("docker", composeArgs(["up", "-d", "--wait", "db"]), composeEnv(config));
  await prepare(config, "manual");
  try {
    validateLocalTestCertificate(config);
    console.log("HTTPS certificate verified.");
  } catch (error) {
    console.log((error as Error).message);
  }
  return config;
}
async function dev(config: LocalTestConfig, target: "manual" | "e2e"): Promise<void> {
  validateLocalTestCertificate(config);
  validateContainer(config);
  await assertFree(config.appPort, config.lanIp);
  await run(
    "pnpm",
    [
      "exec",
      "next",
      "dev",
      "--hostname",
      config.lanIp,
      "--port",
      String(config.appPort),
      "--experimental-https",
      "--experimental-https-key",
      config.keyFile,
      "--experimental-https-cert",
      config.certFile,
      "--experimental-https-ca",
      config.caFile,
    ],
    appEnvironment(config, target),
  );
}
function overrides(args: string[]): z.infer<typeof configOverridesSchema> {
  const names: Record<string, string> = {
    "--lan-ip": "lanIp",
    "--app-port": "appPort",
    "--db-port": "dbPort",
    "--cert-file": "certFile",
    "--key-file": "keyFile",
    "--ca-file": "caFile",
  };
  const result: Record<string, unknown> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = names[args[index]!];
    const value = args[index + 1];
    if (!key || !value || value.startsWith("--") || key in result)
      throw new Error("Unknown, repeated, or incomplete init argument");
    result[key] = key.endsWith("Port") ? Number(value) : value;
  }
  return configOverridesSchema.parse(result);
}
async function main(): Promise<void> {
  const [command, ...raw] = process.argv.slice(2);
  const args = raw[0] === "--" ? raw.slice(1) : raw;
  if (command === "init") {
    await init(overrides(args));
    return;
  }
  const allowed = z
    .enum(["dev", "reset", "stop", "info", "credentials", "exec", "e2e", "e2e-dev"])
    .parse(command);
  if (
    allowed !== "exec" &&
    !(allowed === "reset" && args.length === 1 && args[0] === "--yes") &&
    args.length
  )
    throw new Error("Unknown command arguments");
  const config = loadLocalTestConfig();
  switch (allowed) {
    case "dev":
      await dev(await init(), "manual");
      break;
    case "stop":
      await run("docker", composeArgs(["stop", "db"]), composeEnv(config));
      break;
    case "credentials":
      console.log(`Local test administrator password: ${config.adminPassword}`);
      break;
    case "exec":
      if (!args.length) throw new Error("exec requires a command");
      await run(args[0]!, args.slice(1), appEnvironment(config, "manual"));
      break;
    case "reset": {
      await assertFree(config.appPort, config.lanIp);
      validateContainer(config);
      if (args[0] !== "--yes") {
        const reader = createInterface({ input: process.stdin, output: process.stdout });
        try {
          if (
            (await reader.question("Type pickseat_local_test to destroy manual test data: ")) !==
            "pickseat_local_test"
          )
            throw new Error("Reset not confirmed; database unchanged");
        } finally {
          reader.close();
        }
      }
      await prepare(config, "manual", true);
      break;
    }
    case "e2e": {
      await assertFree(config.appPort, config.lanIp);
      await assertFree(3101, "127.0.0.1");
      validateLocalTestCertificate(config);
      prerequisites();
      await run("docker", composeArgs(["up", "-d", "--wait", "db"]), composeEnv(config));
      validateContainer(config);
      await prepareLocalTestDatabase({
        port: config.dbPort,
        password: config.databasePassword,
        target: "e2e",
        reset: false,
      });
      await prepare(config, "e2e", true);
      await run("pnpm", ["test:e2e"], {
        ...appEnvironment(config, "e2e"),
        LOCAL_TEST_E2E: "1",
        E2E_BASE_URL: appEnvironment(config, "e2e").APP_URL,
        E2E_ADMIN_PASSWORD: config.adminPassword,
        NODE_EXTRA_CA_CERTS: config.caFile,
      });
      break;
    }
    case "e2e-dev": {
      if (process.env.LOCAL_TEST_E2E !== "1") throw new Error("e2e-dev is internal to local:e2e");
      validateContainer(config);
      const status = await prepareLocalTestDatabase({
        port: config.dbPort,
        password: config.databasePassword,
        target: "e2e",
        reset: false,
      });
      if (status !== "seeded") throw new Error("E2E database must already be seeded");
      await dev(config, "e2e");
      break;
    }
    case "info": {
      const url = appEnvironment(config, "manual").APP_URL;
      console.log(
        `HTTPS: ${url}\nAdmin: ${url}/admin\nCA directory: ${caDirectory}\nCertificate: ${config.certFile}\nLeaf key path: ${config.keyFile}\nPublic CA: ${config.caFile}\nCSV: ${join(localDirectory, "fixtures")}\nCredentials: pnpm local:credentials (only explicit command reveals password)`,
      );
      console.log(
        "Scenarios: preregistered, onsite, location (0/0; edit only 手机定位测试地点 for phone), lottery, consecutive A/B, left/right locked halves, draft, ended.",
      );
      console.table(
        basicRows.map(([nickname, phone, normal, student]) => ({
          nickname,
          phone,
          normal,
          student,
        })),
      );
      try {
        validateContainer(config);
        const manifest = await withLocalTestDb(
          { port: config.dbPort, password: config.databasePassword, target: "manual" },
          readLocalTestFixtureManifest,
        );
        console.log("DB: managed and reachable");
        console.table(
          await withLocalTestDb(
            { port: config.dbPort, password: config.databasePassword, target: "manual" },
            readLocalTestDatabaseInfo,
          ),
        );
        console.log(
          "Startup preserves manual edits/deletions; restore missing fixtures only with explicit local:reset.",
        );
        for (const [code, id] of Object.entries(manifest.eventIds))
          console.log(
            `${code}: ${url}/e/${code} | ${url}/admin/events/${id} | ${url}/admin/events/${id}/checkin`,
          );
        if (Object.keys(manifest.eventIds).length !== 10)
          console.log("Fixtures modified/deleted; explicit reset can restore baseline.");
      } catch {
        console.log("DB: stopped/unavailable or ownership invalid; run local:init to verify.");
      }
      break;
    }
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Local test command failed.");
  process.exitCode = 1;
});
