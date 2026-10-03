# 已批准的全系统 refine 实施计划

## 状态与新会话入口

用户已确认修复方案，要求本会话准备计划、**新会话实施**。本文件是实施交接，不是再次征求设计方向。当前生产组件尚未应用方案。

新会话可直接使用以下指令：

> 按 `.impeccable/review/system-refine-plan.md` 实施已批准的全系统 refine。先读 CONTRIBUTING.md、PRODUCT.md、DESIGN.md 和完整检查报告，运行一次 Impeccable context；保持现有色彩和业务规则，完成全部阶段，不只修三个高优先级问题。依照已确认检查板落地全站 polish、普通/连签成功 delight、表单 harden/clarify 和中文 typeset；真实隔离环境验证，完整回归，更新文档并按功能提交。

### 已有证据

- `.impeccable/review/system-refine-checkboard.html`：29个页面/组件样例的当前/建议方案、边界与完成动效；可离线打开，是已批准视觉参考。
- `.impeccable/review/system-refine-checkboard.png`：当前检查板总览。
- `.impeccable/review/system-refine-audit.md`：完整表单矩阵、源码事实、浏览器实测、风险与具体文案建议。
- 检查板初始提交 `b13c41f`；补充检查及截图修正提交 `15d4f91`。以最新工作区和历史为准，不回滚用户后续修改。
- `_local-test/refine-review/proposal.css`：本机保留的预览样式，不受版本控制，**不是实施前提**。缺失时依照已提交HTML中的样式演示及本计划实现；不得将整份预览CSS直接追加到生产。

## 必须保留的边界

1. 这是 refinement，不是 redesign：保留品牌icon/二维码图案、页面内容事实、路由、操作资格、定位/设备绑定/票额/抢座/抽奖/连签领域规则，以及稳定公共错误码。
2. 原主色：深绿 `#174f42`、青柠 `#d6ef73`、米色 `#f3f0e8`、暖纸 `#fffdf7`、深墨 `#15201d`、分隔 `#dcd8cc`。辅助文字可按批准方案从 `#65716d` 修正为 `#596760`；座位状态语义色不变。
3. 保留既有 React Aria 日期/时间/选择器和 NumericInput 的可访问错误模式；不另建第二套控件、表单框架或校验规则。
4. 不修改数据库schema，不计划迁移；领域规则仍在 `src/server/domain`，数据库访问仍在 `src/server/db`。若执行中发现必须改schema或业务语义，说明具体证据并单独确认，不借UI修正扩大范围。
5. 没有复现的风险先复现，不把隐藏半径、长连签提示、短屏弹窗等静态推断写成已发生故障，也不为它们无条件增加默认值/重试/权限。
6. 不改礼仪/抽奖弹窗既有自动关闭时间，不加入声音、循环、随机庆祝、挡内容的动画或额外等待。
7. 预览中的 `nextjs-portal { display:none }` 仅是截图处理，**禁止带入生产**；全局减少动态的预览覆盖与 `!important` 也不能照搬，应仅处理本次拥有的动效。

## 启动与实施约定

- 先读 CONTRIBUTING.md；本次生产实施写代码前读 `node_modules/next/dist/docs/` 中相关指南，不能套旧版Next API。
- 新会话执行一次 `/Users/alex/.agents/skills/impeccable/scripts/impeccable context`，使用它给出的现有设计与表面约束；读 polish、delight、layout、harden、clarify、typeset 对应参考。方向已批准，不重新选择视觉世界。
- 真正UI编辑前读 craft-floor；planning-only 不需要为了写计划做UI检查。
- 以源码现有约定定位ActionState、表单和调用者。修改导出类型/符号前查LSP references，迁移全部调用点和受影响测试，不留兼容别名或旧路径。
- 可并行的切片：危险操作与恢复、表单错误呈现、成功页delight。只有依赖和共享契约明确后再委派；共享全局CSS由一个集成负责人维护。中途不重复跑完整构建/格式化/测试；集成后统一验证。

## 阶段1：安全操作与恢复路径

### 目标

- `src/app/(admin)/admin/events/[id]/participants/page.tsx` 及其actions：清除参与者选座的后果确认。
- `src/features/entry/qr-board.tsx`：现场二维码撤销、活跃连签撤销的后果确认；连签撤销对应行pending；预录动态二维码的初次失败恢复。
- `src/features/entry/participant-entry.tsx`：候选失效后的重新输入入口及字段/错误的可访问关联。
- 共用 `src/features/admin/admin-action-form.tsx`、`admin-submit-button.tsx`：优先复用已有确认/pending机制；不强迫不相干操作迁移。

### 实施

- 清除选座说明删除记录并释放占用，不承诺原本关闭的座位重新开放。
- 连签/二维码撤销说明已有后果，取消确认不发请求；请求中仅禁用对应操作，失败解除pending并保留当前列表/配额。
- 预录二维码初次失败显示准确错误/恢复入口；不再无限显示“正在生成”。沿用现有刷新节奏和不重叠请求，不额外建立重试策略。
- 身份候选失效可返回原来的输入步骤，清除无效候选/claim而非丢失所有有效输入。保持尾号4位、手机号前段1–11位，不强制中国11位手机号。

### 验收

取消确认零请求；确认一次产生对应操作；处理中重复点击不重复提交；失败可恢复且不丢上下文；成功反映真实结果。身份流程恢复到可再次解析的状态。已有结束/重开/地点删除/模板归档的确认与领域限制不退化。

建议提交：`fix(admin): guard destructive participant and workflow actions`；身份/二维码恢复按独立功能另行提交。

## 阶段2：全表单错误定位与规则说明

### 目标

完整覆盖audit矩阵中的登录、活动新建/编辑、定位、票种/抽奖/奖品、连签设置、开放范围、CSV/手工参与者、影院/影厅/JSON导入、地点/地图导入及参与者身份输入。优先涉及：

- `src/features/admin/admin-action-form.tsx` 与项目已有ActionState定义。
- `src/features/events/{ticket-type-fields,location-check-fields,consecutive-checkin-fields,event-seat-management-form}.tsx`。
- `src/features/venues/{hall-template-edit-form,hall-template-import-form,seat-layout-editor}.tsx`。
- `src/features/locations/{location-preset-fields,location-preset-create-form,location-preset-edit-form}.tsx`。
- 对应 `src/app/(admin)/admin/**` 页面、actions与现有Zod schemas；共享 `src/features/forms`。

### 契约与实施

- 保留现有结果状态、message和稳定code。在原契约上附加**可序列化、安全的字段错误**；保留表单级业务错误。不要向客户端泄漏数据库、口令、claim或内部异常。
- Zod issues关联真实字段/动态行。票种/奖品发生增删或重排后错误不得错接到另一行；提交后清晰概括并聚焦首个可修正错误。
- 字段提供标签、`aria-invalid`、`aria-describedby`；表单提供合理busy/结果播报。已有NumericInput模式直接复用，隐藏的React Aria native提交节点不误判为可见无标签字段。
- 提交失败保留用户字段、动态行和文件选择；只有既有成功reset路径清空。无需为登录新增密码持久化。
- 按现有schema提供长度/数量帮助及输入限制：活动100；票种40且1–20种；奖品80且最多100项；影院/影厅/地点80；布局行列1–50、标签12；连签目标最多20；地图URL4096。查最新schema再镜像，不只依赖本计划数值。
- CSV说明非空、最多2,000,000字节/2000行；JSON最多10MiB。模板“删除”改为真实“归档”；保存新版说明归档当前版；连签候选说明既有筛选条件。
- 通用错误不承诺尚不存在的字段关联。领域冲突、权限、结束/占用等错误继续以稳定code及现有准确消息呈现，不能全部降成字段校验失败。

### 验收

空值/超限/重名/跨字段依赖/动态行错误准确指向可修改位置；读屏能关联错误；失败保留数据；修复后真实提交成功；业务冲突消息与资格不变。保留已有正确空态、只读态与pending机制。

建议提交按共享契约和消费者迁移作为完整功能点组织，不提交未迁移的中间契约。

## 阶段3：小屏布局与全站polish/typeset

### 目标

`src/app/globals.css`、`src/app/page.module.css`，相关管理页面/表单、`src/features/seating/seat-grid-viewport.tsx`、普通/连签选座、发行/入口/记录组件。覆盖29个检查板页面/样例及audit完整表单矩阵，不能只改截图中的几个首屏。

### 实施

- 修复 `.seat-grid-viewport-toolbar` 的 `nowrap + justify-content:flex-end` 在窄容器中把左侧缩小按钮挤到负坐标的问题。按容器可用宽度合理换行/布局，保证所有按钮可见可触达；不靠外层页面无横溢判断通过。
- 按已批准视觉参考调整共享按钮、焦点、标题、卡片密度、表单组间距、移动活动列表时间、行操作、表格表头/首列参照、登录/入口/QR/选座/记录的层级和反馈。把规则并入已有样式和合适token，不叠加一份覆盖CSS。
- 普通与连签底栏继续使用正确的 `left:50% + translateX(-50%) + 有界宽度` 或等价单一定位方案，**禁止恢复错误left/right覆盖**。保留移动安全区，正文留白适配底栏真实高度、长座位名及放大文字。
- 表格内部横向滚动保留，不为了消除屏外坐标删除字段/动作；保证滚动和焦点可发现。长中文选项/值完整换行，不以截断隐藏关键输入。
- 中文标题接近0字距、约1.15–1.25行高；英文短眉题保留高tracking，中文/混排眉题降到接近0–.02em。表单16px/24px保持，数字tabular-nums继续使用。统一少量角色，而非逐页任意字号。
- 字体保留现有Latin/数字风格，系统栈可在原候选后追加Noto CJK/SC fallback，不下载大中文字库，不默认换成system-ui首选。实际命中按设备测量，不能只凭CSS栈宣称所有平台一致。
- 批准的辅助字调整、青柠返回链接对比修正、44px行操作/至少44px触控目标落地；减少圆角/阴影和空白时保持现有品牌，不变成新视觉世界。

### 验收

活动新建、草稿编辑和影厅管理在320px的缩小/放大/适配完整可见；320、390、768、1440px均无页面横溢或关键控件裁切。长中文名称、动态行、表格内部滚动和键盘焦点可用。实际200%浏览器缩放与系统文字放大另测；720px等效重排不能替代真缩放证明。

建议将工具栏行为修复与全站类型/视觉统一分成 focused commits。

## 阶段4：普通及连签成功delight

### 目标

`src/features/seating/success-view.tsx`、`consecutive-seat-flow.tsx` 中结果组件、`reservation-ticket.tsx`、`src/features/records/today-records-view.tsx` 及必要样式。以检查板普通/连签动态演示为准。

### 实施

- 成功标题前短促完成勾线；新完成票根轻落定。完成勾线约420ms、票根约420ms，连签总序列不超过580ms。
- 内容从第一帧可读；不推迟抽奖/跳转/确认状态，不重播普通渲染更新，不为每张票/每个元素叠加无意义动画。
- 连签保持真实场次顺序；`historical`/“此前已完成”票据不参与新的落定或庆祝。今日记录不重新庆祝旧结果。
- 减少动态时去掉位移/勾线运动，仅保留必要静态确认或很短明暗反馈；页面隐藏/卸载时终止非必要动画。
- 长活动/座位/票种/奖品、多座位、多抽次、中奖/未中/无抽奖、历史票、缺设备/空记录全部真实显示；一次预约一张票的结构不变。

### 验收

真实普通/连签成功路径能立即读票；历史场次零庆祝；减少动态下无位移；键盘/读屏与内容完整性不退化。组件fixture用于视觉边界，不能当作跨场真实业务验收。

建议提交：`feat(seating): refine completion feedback for single and consecutive results`。

## 阶段5：集成验收与交付

### 真实环境与安全

- 使用 `pnpm local:info` 获取当前规范URL和合成场景，再启动/使用已有 `pnpm local:dev`。上次人工环境已恢复；服务名/端口状态跨会话不可假定。
- 仅使用 CONTRIBUTING 的独立PostgreSQL/HTTPS环境；不接入生产、不打印秘密、不覆盖env或证书、不重置人工验收库。缺证书/设备权限时先完成可达工作，再明确人工前提。
- 真业务检查使用真实登录、二维码、cookie、设备绑定、定位、选座、抽奖及连签API；不通过mock成功响应证明业务成立。
- 上轮连签视觉fixture心跳POST返回404、占座GET返回HTML，截图使用明确声明的合成响应。不要把该截图/fixturetransport表现归因于生产API；业务证明使用隔离Next环境。修fixture服务器或pg弃用警告不属于本方案自动附带范围。

### 行为与视觉验收

1. 安全操作确认取消/确认、重复点击、失败恢复；错误定位、动态行增删、数据保留及成功reset；二维码初次失败和身份恢复。
2. 活动新建/草稿编辑、影厅布局、地点/地图、名单导入/手工录入、发行和连签设置的真实保存路径；状态资格/稳定错误码不变。
3. 普通与跨场连签真实成功、含此前已完成场次、奖品状态，以及今日记录/缺设备/空态；触发实际新增动效。
4. 覆盖全部29个检查板表面与audit表单矩阵。320/390/768/1440、真实200%缩放、长中文/数字/无空格字串、短屏、焦点和减少动态；手机键盘/安全区与跨平台字体只按实际观测报告。
5. UI完整构建后桌面/手机**一轮批量截图和检查**，集中修复问题，最多一轮确认，不无界抛光。真实行为smoke与自动回归是交付必需，不以截图代替。
6. 新增永久测试仅覆盖消费者可见行为、边界/状态/错误；更新受契约变化影响的现有测试。不编写检查CSS源码、复制文案、mock echo或wiring的脆弱测试。

### 完整工程检查

在集成后运行一次：

```sh
pnpm lint
pnpm typecheck
pnpm test
# 停止自己拥有的local:dev；确保3101 fixture端口空闲
pnpm local:e2e
pnpm local:exec -- pnpm build
# 回归后恢复人工环境
pnpm local:dev
```

上轮基线：lint/typecheck通过，257项单测；Playwright129通过/4跳过；build成功。此为历史证据，**不是新代码通过证明**。日志中的fixture审计404、pg并发query弃用警告须如实披露，不能用“所有检查通过”暗示已修。

### 完成条件

- 四个实施阶段全部落地，影响的调用者/契约/状态/测试完整迁移；不保留预览覆盖、临时mock、隐藏debug层或未实现恢复入口。
- 更新README/相关使用说明和必要设计记录，记录实际实现的字体/排版/交互规则；本次设计变化可同步DESIGN，不能顺手修复无关Impeccable漂移。
- 新的运行截图/检查板明确区分**已实现页面**与历史建议方案；更新audit为已修正/已验证/明确设备前提，不能提前标done。
- 按功能使用合法scope的Conventional Commits；不夹带用户修改、生成秘密或无关重构。最终给出改动、证据、跳过项/警告、提交和验收产物。
