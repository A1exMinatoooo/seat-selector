import { randomBytes, X509Certificate, createPrivateKey } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { isIP } from "node:net";
import { basename, isAbsolute, join, resolve } from "node:path";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../../src/server/security/password";

export const root = resolve(import.meta.dirname, "../..");
export const localDirectory = join(root, "_local-test");
const configFile = join(localDirectory, "config.json");
export const caDirectory = join(
  homedir(),
  "Library/Mobile Documents/com~apple~CloudDocs/custom_ca",
);
const absolutePath = z.string().min(1).refine(isAbsolute, "Expected absolute path");
const port = z.number().int().min(1).max(65535);
const ipv4 = z.string().refine((value) => isIP(value) === 4, "Expected IPv4");
export const localTestConfigSchema = z
  .object({
    lanIp: ipv4,
    appPort: port,
    dbPort: port,
    certFile: absolutePath,
    keyFile: absolutePath.refine(
      (value) => basename(value) !== "CAPrivate.key",
      "CA private key is forbidden",
    ),
    caFile: absolutePath,
    databasePassword: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    appSecret: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    adminPassword: z.string().regex(/^[A-Za-z0-9_-]{24}$/),
    adminPasswordHash: z.string().startsWith("scrypt$"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!verifyPassword(value.adminPassword, value.adminPasswordHash))
      ctx.addIssue({ code: "custom", message: "Administrator password hash mismatch" });
    if (value.appPort === value.dbPort)
      ctx.addIssue({ code: "custom", message: "Application and database ports must differ" });
  });
export type LocalTestConfig = z.infer<typeof localTestConfigSchema>;
export const configOverridesSchema = z
  .object({
    lanIp: ipv4.optional(),
    appPort: port.optional(),
    dbPort: port.optional(),
    certFile: absolutePath.optional(),
    keyFile: absolutePath.optional(),
    caFile: absolutePath.optional(),
  })
  .strict();

export function loadLocalTestConfig(): LocalTestConfig {
  if (!existsSync(configFile))
    throw new Error("Missing local configuration; run pnpm local:init first.");
  const config = localTestConfigSchema.parse(JSON.parse(readFileSync(configFile, "utf8")));
  chmodSync(localDirectory, 0o700);
  chmodSync(configFile, 0o600);
  return config;
}
export function initializeLocalTestConfig(
  overrides: z.infer<typeof configOverridesSchema>,
): LocalTestConfig {
  const validated = configOverridesSchema.parse(overrides);
  let config: LocalTestConfig;
  if (existsSync(configFile))
    config = localTestConfigSchema.parse({ ...loadLocalTestConfig(), ...validated });
  else {
    const interfaces = networkInterfaces();
    const preferred = interfaces.en0?.find(
      (address) => address.family === "IPv4" && !address.internal,
    );
    const fallback = Object.entries(interfaces)
      .filter(([name]) => !/^(lo|utun|docker|bridge)/.test(name))
      .flatMap(([, entries]) => entries ?? [])
      .find(
        (address) =>
          address.family === "IPv4" &&
          !address.internal &&
          /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address),
      );
    const lanIp = validated.lanIp ?? preferred?.address ?? fallback?.address;
    if (!lanIp)
      throw new Error(
        "No physical LAN IPv4 available; connect to LAN or pass --lan-ip explicitly.",
      );
    console.log(
      `LAN source: ${validated.lanIp ? "explicit --lan-ip" : preferred ? "en0" : "physical interface fallback"}`,
    );
    const adminPassword = randomBytes(18).toString("base64url");
    config = localTestConfigSchema.parse({
      lanIp,
      appPort: 3100,
      dbPort: 55432,
      certFile: join(caDirectory, lanIp, `${lanIp}.crt`),
      keyFile: join(caDirectory, "private.key"),
      caFile: join(caDirectory, "CAPrivate.pem"),
      databasePassword: randomBytes(32).toString("base64url"),
      appSecret: randomBytes(32).toString("base64url"),
      adminPassword,
      adminPasswordHash: hashPassword(adminPassword),
      ...validated,
    });
  }
  mkdirSync(localDirectory, { recursive: true, mode: 0o700 });
  chmodSync(localDirectory, 0o700);
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  chmodSync(configFile, 0o600);
  return config;
}
export function appEnvironment(
  config: LocalTestConfig,
  target: "manual" | "e2e",
): NodeJS.ProcessEnv {
  config = localTestConfigSchema.parse(config);
  // Installed Next 16.3 @next/env honors this guard; inherited scrypt dollars must not be expanded by root env files.
  // This environment is complete and validated above, so no dotenv configuration is needed.
  return {
    ...process.env,
    __NEXT_PROCESSED_ENV: "true",
    NODE_EXTRA_CA_CERTS: config.caFile,
    NODE_TLS_REJECT_UNAUTHORIZED: "1",
    DATABASE_URL: `postgresql://pickseat_local_test:${config.databasePassword}@127.0.0.1:${config.dbPort}/${target === "manual" ? "pickseat_local_test" : "pickseat_local_test_e2e"}`,
    APP_URL: `https://${config.lanIp}:${config.appPort}`,
    APP_SECRET: config.appSecret,
    ADMIN_PASSWORD_HASH: config.adminPasswordHash,
    TRUSTED_PROXY_COUNT: "0",
    DEFAULT_TIME_ZONE: "Asia/Shanghai",
    ICP_FILING_NUMBER: "",
    PUBLIC_SECURITY_FILING_NUMBER: "",
    PUBLIC_SECURITY_FILING_URL: "",
    LOCAL_TEST_LAN_IP: config.lanIp,
  };
}
export function validateLocalTestCertificate(config: LocalTestConfig): void {
  try {
    config = localTestConfigSchema.parse(config);
    const leaf = new X509Certificate(readFileSync(config.certFile));
    const ca = new X509Certificate(readFileSync(config.caFile));
    const now = Date.now();
    for (const certificate of [leaf, ca]) {
      if (Date.parse(certificate.validFrom) > now || Date.parse(certificate.validTo) <= now)
        throw new Error("Certificate not currently valid");
    }
    if (!ca.ca) throw new Error("Public CA certificate has no CA flag");
    if (!leaf.checkIP(config.lanIp)) throw new Error("Leaf certificate does not match LAN IP");
    if (!leaf.verify(ca.publicKey)) throw new Error("Leaf is not signed by configured CA");
    if (!leaf.checkPrivateKey(createPrivateKey(readFileSync(config.keyFile))))
      throw new Error("Leaf private key does not match certificate");
  } catch {
    throw new Error(
      `Local HTTPS certificate validation failed. In "${caDirectory}", manually run bash ./generate_cert.sh >/dev/null; enter ${config.lanIp}, then n for extra names and n for default validity. Configure matching cert/key/public CA paths with local:init. Never use CAPrivate.key as the application key.`,
    );
  }
}
