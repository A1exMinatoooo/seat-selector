# 开发与提交规范

## 代码边界

- TypeScript 保持 `strict` 和 `noUncheckedIndexedAccess`，禁止无说明的 `any`。
- React 组件只负责展示和交互；领域规则位于 `src/server/domain`。
- Route Handler 和 Server Action 必须执行身份验证和 Zod 输入校验。
- 数据库访问集中在 `src/server/db`；涉及多个写操作时使用事务。
- Server Component 传给 Client Component 的属性必须为可序列化数据。
- 所有触控目标至少 44px；新增交互必须提供可访问名称和错误提示。
- Schema 修改必须包含 Drizzle 迁移、索引理由和相关测试。

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
