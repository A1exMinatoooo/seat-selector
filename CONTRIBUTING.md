# 开发与提交规范

## 代码边界

- TypeScript 保持 `strict` 和 `noUncheckedIndexedAccess`，禁止无说明的 `any`。
- React 组件只负责展示和交互；领域规则位于 `src/server/domain`。
- Route Handler 和 Server Action 必须执行身份验证和 Zod 输入校验。
- 数据库访问集中在 `src/server/db`；涉及多个写操作时使用事务。
- Server Component 传给 Client Component 的属性必须为可序列化数据。
- 所有触控目标至少 44px；新增交互必须提供可访问名称和错误提示。
- Schema 修改必须包含 Drizzle 迁移、索引理由和相关测试。

## 本地模拟测试环境

### 用途与隔离

开发中需要真实 PostgreSQL、管理员/参与者完整流程、设备绑定、定位、抢座或连续签到模拟时，使用此环境。Docker 只运行独立 PostgreSQL 18；Next 在宿主机绑定物理 LAN IPv4，以 HTTPS 提供服务。只使用合成数据；全部业务环境变量由验证后的测试配置注入，不使用既有 `.env`、`.env.local` 的业务配置，也不覆盖或挂载它们、`pgdata` 或备份。Next 仍可能在启动日志中列出根目录 env 文件；测试进程阻止其 dotenv 展开改写已注入的配置。

独立 Compose project 为 `pickseat-local-test`，文件为 `compose.local-test.yaml`，数据库默认仅发布到 `127.0.0.1:55432`，数据保存在独立命名卷。人工验收库 `pickseat_local_test` 与自动回归库 `pickseat_local_test_e2e` 分离。不要叠加生产 Compose。

配置、合成 CSV、认证 storageState 和回归产物位于 Git/Docker 忽略的 `_local-test/`。目录权限为 0700，秘密配置文件为 0600。首次随机生成数据库密码、APP_SECRET 和管理员口令并保存；普通启动及 reset 不轮换凭据。

### 首次准备

从仓库根执行，要求 Node 24、pnpm 11、Docker daemon 可用：

```bash
pnpm install --frozen-lockfile
pnpm local:init
pnpm local:info
```

`local:init` 启动独立数据库、迁移并首次填充。缺少证书只报告人工前提，不阻止数据库准备。`local:info` 显示当前规范 LAN HTTPS URL、证书路径、活动及签到入口和合成身份；不要把某次运行的 IP 当作固定地址。

外部 CA 目录为 `$HOME/Library/Mobile Documents/com~apple~CloudDocs/custom_ca`，路径含空格，需要引用。用户另开终端手动执行：

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/custom_ca"
bash ./generate_cert.sh >/dev/null
```

IP 输入 `local:info` 的当前 LAN IP，额外域名/IP 选 `n`，默认有效期选 `n`。stdout 丢弃是为了抑制该脚本末尾的私钥回显；不要把输出捕获到日志。应用使用匹配的叶子证书和 `private.key`，绝不使用 CA 私钥 `CAPrivate.key`。

先检查各设备是否已有此 CA 信任，缺失时由用户手动安装**公开 CA** `CAPrivate.pem`。只分享公开 CA，不复制/回显 `CAPrivate.key` 或 `private.key`，不把密钥放进仓库、public 或容器。iOS 安装描述文件后还需开启完全信任，参见 [Apple 官方指引](https://support.apple.com/en-us/102390)；Android 按设备 CA 证书设置操作，Wi-Fi 专用证书入口不等于浏览器 CA 信任。

```bash
pnpm local:dev
```

`pnpm local:phone` 是可重复运行的人工签发、信任检查和手机验收交互向导；不会自动签发、安装信任或修改网络设置。手机结果须由人实际确认。

### 日常启动与确认可用

已有配置/证书时，`pnpm local:dev` 会迁移后启动，并保留人工修改、删除及已有选座。另一终端执行：

```bash
pnpm local:info
pnpm local:credentials
```

仅 `local:credentials` 显式显示测试管理员口令；不要把口令复制到回复或日志。桌面和手机使用同一个规范 HTTPS URL，不另用 localhost 写入 Origin。Next 绑定指定 LAN IP，不绑定 VPN 默认路由或 0.0.0.0。

按 info 中的实际路径和地址检查：

```bash
curl --cacert "<caFile>" "<APP_URL>/api/health/ready"
```

应得 HTTP 200；浏览器页面无 TLS 警告且是安全上下文；管理端正常登录后，检查活动、参与者及座位图。命令返回成功不能替代真实页面验收。

基准包含十个活动：预登记、现场发票、定位、抽奖、连续首场/后场、左半区锁定/右半区锁定、草稿、结束。锁定一侧表示该侧禁止选座。小型影厅有 72 网格单元、60 实体座位，A1 模板不可选；基础场另关闭 B10，初始已有 A2、A3/A4 预订。基础尾号 9001/9002 用于单人/双人，8001 用于完整号码/尾号候选消歧，8002 用于昵称候选。身份、实际 IDs、票数及占座以 `local:info` 为准。

生成 CSV 位于 `_local-test/fixtures/`：`preregistered.csv`、`import-valid.csv`、`import-invalid.csv`，含 UTF-8 BOM 和系统中文表头。普通启动不覆盖人工修改的文件或重新补回删除的 fixture；显式 reset 才恢复基准。日期固定为首次 seed/reset 的上海本地日期，跨日需要当天场景时显式 reset；不伪造长效 QR、设备 cookie、workflow 或抽奖结果。

### 停止与重置

先 Ctrl-C 结束前台 `local:dev`，再执行：

```bash
pnpm local:stop
```

此命令只停止测试数据库，不删除卷或数据，不停止其他项目。需要恢复合成基准且确定可丢弃人工修改时：

```bash
pnpm local:reset
pnpm local:dev
```

reset 要求输入 `pickseat_local_test` 确认；应用端口仍被占用时拒绝，不向端口进程发信号。它清空且只重建人工验收库，保留口令、证书和命名卷。`--yes` 仅供已获授权的自动验收，不建议日常使用。未知数据库 marker、非空无 marker 数据库、坏配置或端口冲突均拒绝接管；不要使用生产 Compose 的 `down -v`。

### 真实回归

停止 `local:dev` 后执行：

```bash
pnpm local:e2e
```

首次缺浏览器时先执行 `pnpm exec playwright install chromium webkit`。此入口只重建专用 e2e 库，迁移/填充后运行全部 Playwright。使用同一 LAN IP、应用端口和证书，独立 HTTPS 进程由 Playwright 收回；组件 fixture 的 3101 端口必须空闲。管理员正常登录一次并保存忽略目录中的 storageState；保持 TLS 校验、串行执行和现有业务限流。

既有 mocked/browser-fixture 用例仍在 desktop/safari/mobile 运行；新增真实 DB 业务验收只在 desktop 运行，使用真实二维码、cookie、抢座、定位、抽奖和连场 API，不 mock 业务接口。人工验收库及人工修改不受失败/重跑影响。结束后重新 `pnpm local:dev` 做人工验收。

需要在完整测试 env 中运行宿主机命令时：

```bash
pnpm local:exec -- pnpm db:migrate
pnpm local:exec -- pnpm build
```

生产 build 在宿主机执行，不构建生产应用镜像。提交前仍按下文运行 lint、typecheck、unit tests，并运行 `local:e2e` 和上述 build。

### 地址、证书与定位前提

地址变化须显式更新配置并由用户手动重新签发匹配证书：

```bash
pnpm local:init -- --lan-ip NEW_IP --cert-file "<新crt绝对路径>"
```

可用 `--app-port`、`--db-port`、`--key-file`、`--ca-file` 覆盖端口/绝对路径。默认应用端口 3100、数据库端口 55432；冲突时选择空闲值并显式保存，不停止他人服务。3101 fixture 冲突时先解决该端口占用，不复用未知服务。

验证证书有效期、CA 标志、IP、叶子私钥匹配及 CA 签名；不自动重签、解密密钥、换 CA、回退 HTTP 或忽略 TLS。Mac/手机必须处于可互访 LAN；客户端隔离、防火墙、VPN 或设备证书策略问题由用户处理，不自动关闭防火墙/VPN或创建隧道。

浏览器定位模拟使用合成 0/0。真实手机验收仅在管理端把“手机定位测试地点”改为当前地点，再体验拒绝/授权及范围校验；其他活动不受影响。私人坐标只留在隔离数据库，不写入源码、CSV、phone.env 或回复。

### Agent 使用规则

开发时需要本地模拟、真实 DB 或端到端业务验证的 agent，先按本节启动已有隔离环境，使用 info 的规范 URL 和合成数据。自动回归使用 `local:e2e`，不要自行接入既有 env、生产数据库或真实数据。

证书签发、设备信任和设备权限由用户操作；缺证书时先完成可达的 DB/fixture 准备，再指出精确人工前提，不把缺失的 HTTPS/手机验收声称通过。对人工验收库执行 reset 前必须获得用户明确授权；自动回归仅重建 e2e 库。凭据从本地忽略配置使用，不回显私钥或在回复/日志复制管理员明文口令。

## Conventional Commits

提交格式：

```text
<type>(<scope>): <description>
```

允许的 type：`feat`、`fix`、`refactor`、`perf`、`test`、`docs`、`build`、`ci`、`chore`。

常用 scope：`auth`、`venues`、`locations`、`events`、`participants`、`entry`、`seating`、`admin`、`db`、`docker`、`deploy`。

每个提交只完成一个可测试、可回滚的功能点。功能实现、对应迁移和测试应放在同一提交；不要混入无关格式化或重构。Husky 的 `commit-msg` hook 会运行 commitlint。

提交前运行：

```bash
pnpm lint
pnpm typecheck
pnpm test
```

合并前额外运行 `pnpm test:e2e` 和 `pnpm build`。
