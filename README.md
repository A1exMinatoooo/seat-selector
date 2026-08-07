# 银幕座席（Pick Your Seat）

面向线下集体观影活动的选座系统。组织者可以维护影厅模板、活动地点、票种和参与者清单；参与者通过现场动态二维码、身份校验、设备绑定和定位验证进入座位图。

## 功能

- 响应式活动管理端与移动端选座页
- 自定义影厅行列、过道、不可选座位、中线及黄金观影区
- 多票种和动态票种列 CSV 导入、选座记录 CSV 导出
- 每 30 秒轮换的现场二维码、5 分钟入场凭据
- 手机尾号、姓名首字和手机前缀逐步消歧
- 首次设备绑定及管理员解绑
- 活动坐标、定位半径、确认前二次定位及单人定位豁免
- 3/15 秒自适应状态刷新和 PostgreSQL 原子抢座
- Caddy 自动 HTTPS或接入现有反向代理的单 VPS Compose 部署

## 本地开发

要求 Node.js 24、pnpm 11 和 PostgreSQL 18。

```bash
cp .env.example .env.local
pnpm install
pnpm admin:hash 'replace-with-a-strong-password'
pnpm db:migrate
pnpm dev
```

将密码哈希命令的输出用单引号包裹后写入 `.env.local` 的 `ADMIN_PASSWORD_HASH`。`APP_SECRET` 应使用至少 32 字节随机值，例如：

```bash
openssl rand -base64 48
```

开发环境入口为 `http://localhost:3000`，管理端为 `/admin`。

## CSV 格式

先在活动中配置票种，参与者页面会显示所需表头。示例：

```csv
姓名,手机号或尾号,普通票,学生票
张小明,13800138000,2,0
李华,5678,0,1
```

如果相同尾号、姓名首字仍有碰撞，相关记录必须填写完整手机号，否则整次导入会被拒绝。

## 单 VPS 部署

建议服务器至少 2 vCPU、2 GB RAM、20 GB SSD，并为正式环境配置域名和 HTTPS。网页定位在普通手机浏览器中依赖安全上下文。

### 准备配置

```bash
cp .env.docker.example .env
pnpm admin:hash 'replace-with-a-strong-password'
```

编辑 `.env`：

- `POSTGRES_PASSWORD`：独立的高强度数据库密码。
- `APP_URL`：完整外部 HTTPS 地址，不带末尾斜杠。
- `APP_SECRET`：至少 32 个随机字符。
- `ADMIN_PASSWORD_HASH`：密码哈希完整值；在 `.env` 中用单引号包裹，防止 `$` 被 Compose 展开。
- `TRUSTED_PROXY_COUNT`：内置 Caddy 和单层外部反代均设置为 `1`。

PostgreSQL 数据默认保存在 `compose.yaml` 同级的 `./pgdata` 目录。该目录不会提交到 Git，也不应在 PostgreSQL 运行时直接复制作为备份；请使用后文的逻辑备份命令。

### 方案 A：内置 Caddy

先将域名 A/AAAA 记录指向 VPS，并开放 TCP 80、TCP/UDP 443：

```bash
docker compose -f compose.yaml -f compose.caddy.yaml up -d --build
docker compose -f compose.yaml -f compose.caddy.yaml ps
```

Caddy 会自动申请和续期证书。`DOMAIN` 与 `APP_URL` 必须指向同一站点。

### 方案 B：已有反向代理

```bash
docker compose -f compose.yaml -f compose.external-proxy.yaml up -d --build
```

应用仅监听 `127.0.0.1:${APP_PORT}`。Nginx 示例：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    client_max_body_size 3m;
    proxy_read_timeout 60s;
}
```

外部代理必须覆盖而不是追加不可信客户端传入的转发头，并负责 HTTPS 和证书续期。

### 使用 Docker tar 包部署

仓库的 `Build Docker tar packages` GitHub Actions 工作流支持两种发布方式：

- 推送 `v*` 标签时，构建产物会自动发布到该标签对应的 GitHub Release。
- 手动运行时必须输入尚不存在的版本标签（例如 `v1.0.0`）；工作流会在所选提交上创建并推送标签，再创建对应的 GitHub Release。

版本标签必须采用 `v1.0.0` 或 `v1.0.0-rc.1` 形式。每次发布分别生成以下构建产物：

- `amd64`：用于常见 Intel/AMD x86-64 服务器。
- `arm64`：用于 ARM64/AArch64 服务器。

在 GitHub Releases 页面下载与服务器架构对应的 tar 包，然后导入镜像：

```bash
docker load --input pick-your-seat-v1.0.0-amd64.tar
docker image inspect pick-your-seat:latest --format '{{.Os}}/{{.Architecture}}'
```

ARM64 服务器将文件名替换为 `pick-your-seat-v1.0.0-arm64.tar`。将仓库中的 Compose 文件、Caddy 配置和 `.env` 一并放到服务器后，无需在服务器安装 Node.js 或 pnpm 即可启动：

```bash
docker compose -f compose.yaml -f compose.caddy.yaml up -d --no-build
docker compose -f compose.yaml -f compose.caddy.yaml ps
```

使用已有反向代理时，将第二个 Compose 文件替换为 `compose.external-proxy.yaml`。tar 包同时包含 `pick-your-seat:latest`、发布版本和提交 SHA 三个镜像标签；如需固定版本，在 `.env` 中设置：

```dotenv
APP_IMAGE=pick-your-seat:v1.0.0
```

PostgreSQL 和 Caddy 镜像仍会从镜像仓库拉取。完全离线部署时，还需提前在联网机器上分别拉取并通过 `docker save` 打包 `postgres:18-alpine` 和 `caddy:2-alpine`。

## 更新与回滚

更新前先备份数据库：

```bash
./scripts/backup.sh
git pull --ff-only
docker compose -f compose.yaml -f compose.caddy.yaml up -d --build
docker compose -f compose.yaml -f compose.caddy.yaml ps
```

`migrate` 服务在应用启动前执行向前迁移。迁移失败时应用不会启动。回滚应用时切换到上一版本代码或镜像；如果新版本已经执行不兼容迁移，应先停止服务并从逻辑备份恢复，不能直接回退数据库文件。

## 备份与恢复

手动备份：

```bash
./scripts/backup.sh
```

默认写入 `./backups` 并删除 7 天前的备份。宿主机 cron 示例：

```cron
15 3 * * * cd /opt/pick-your-seat && ./scripts/backup.sh >> /var/log/pickseat-backup.log 2>&1
```

从使用 `postgres_data` 命名卷的旧版本升级时，应先在旧版本运行 `./scripts/backup.sh`。更新 Compose 文件后再按下面的恢复流程把备份写入新的 `./pgdata` 目录，避免误以为空目录中的新数据库是原数据库。

恢复前先停止应用和迁移服务，再恢复到空数据库：

```bash
docker compose stop app migrate
docker compose exec -T db dropdb -U pickseat --if-exists pickseat
docker compose exec -T db createdb -U pickseat pickseat
docker compose exec -T db pg_restore -U pickseat -d pickseat --clean --if-exists < backups/pickseat-YYYYMMDDTHHMMSSZ.dump
docker compose up -d migrate app
```

不要在 PostgreSQL 运行时直接复制数据卷作为备份。应定期在另一台机器上验证 `pg_restore`。

## 健康检查与日志

- `/api/health/live`：应用进程存活。
- `/api/health/ready`：应用可以访问数据库。
- `docker compose logs -f app`：查看应用结构化日志。
- `docker compose logs -f db`：查看数据库日志。

日志不得包含手机号、Cookie、精确坐标、二维码令牌或设备凭据。

## 测试

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

负载测试需要安装 k6，并准备一个已经完成身份和设备验证的测试会话：

```bash
BASE_URL=https://seats.example.com \
EVENT_CODE=public-event-code \
PARTICIPANT_COOKIE='ps_participant=...; ps_device=...' \
k6 run tests/load/seating.js
```

## 安全边界

动态二维码、短期入场凭据、定位、身份信息和设备绑定能显著降低普通截图及链接转发的可用性，但纯网页无法完全阻止实时转播二维码、Cookie 导出、远程控制或系统级模拟定位。遇到换机、清除浏览器数据或现场定位异常时，由管理员执行设备解绑或单人定位豁免。

开发与提交规范见 [CONTRIBUTING.md](./CONTRIBUTING.md)。
