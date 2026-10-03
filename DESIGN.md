---
name: Pick Your Seat · Reservation Results
description: 以已确认座位为中心的现代电子票根；仅记录本次结果页范围。
colors:
  ink: "#15201d"
  muted: "#596760"
  cream: "#f3f0e8"
  paper: "#fffdf7"
  green: "#174f42"
  lime: "#d6ef73"
  line: "#dcd8cc"
  lime-hover: "#cbe465"
typography:
  seats:
    fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif'
    fontSize: "48px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  compact-seats:
    fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif'
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  prizes:
    fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif'
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.45
  metadata:
    fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  field: "6px"
  ticket: "8px"
  pill: "999px"
spacing:
  field: "12px"
  body: "20px"
  stub: "16px 20px"
components:
  reservation-ticket:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ticket}"
    width: "min(560px, 100%)"
  winning-field:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "{spacing.field}"
  losing-field:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "{spacing.field}"
  records-link:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ticket}"
  records-link-hover:
    backgroundColor: "{colors.lime-hover}"
---

# Design System: Pick Your Seat · Reservation Results

## Overview

**Creative North Star: "完整可核对的电子票根"**

本记录限定普通选座成功、今日选座记录、连签结果及其边界状态，不替代管理员、选座器或抽奖弹窗的既有设计。依据用户批准的五分区概念检查板与实际运行后的组件、样式和截图，不将生成图中的尺寸误差固化为规范。

**Key Characteristics:**
- 一次预约一张票；奖品属于整个预约。
- 座位第一焦点，中奖第二焦点，票种与时间随后。
- 原始持票鸭 icon、暖米色单行截图 pill、深绿成功页与暖纸色平面票根。
- 长内容完整换行，多个记录垂直排列。

## Colors

颜色取自 `src/app/globals.css`：普通成功页与连签结果页使用 green 页面底色及座位号，票外标题和实时钟使用 paper，连签副标题使用 cream；截图提醒为 cream 底、green 字。今日记录页继续使用 cream 页面底色及 ink 座位号。paper 为票面，ink 为票面正文，muted 为票面辅助标签，green 为历史标记，lime 为中奖带与今日记录入口，line 为细边框和虚线分隔。

未中奖保持 cream 底、14px 常规字重，但使用 ink，避免原 muted 配 cream 的 4.46:1 对比度。实际移动端与桌面运行测得 ink / cream 为 14.68:1。中奖带不用于未中奖；没有抽奖结果不显示结果区。

## Typography

继承 Arial、PingFang SC、Microsoft YaHei，之后追加已安装的 Noto Sans CJK SC、Noto Sans SC 回退；不下载字体，不将 system-ui 改为首选。座位：普通成功页 48px/800/1.2；今日记录、连签与紧凑状态票 32px/800/1.2。中奖结果 24px/700/1.45。活动标题 22px/1.4；票种摘要 16px/700/1.5；票面标签 14px/1.5；确认时间、手机尾号与开始时间 12px/1.6，数字使用 tabular-nums。

截图提醒字体 `clamp(12px, 3.3vw, 14px)`，文案不换行；icon 为 24px × 24px，完整图案 contain，不裁切。

## Layout

票面、截图提醒和结果入口最大宽度 560px；窄屏随可用宽度缩小，不采用固定高度。票面主体 padding 20px、组间距 20px。座位列表 flex-wrap，8px × 20px gap；长标签可完整换行。票根元数据 padding 16px 20px、行间距 6px。完整内容允许页面纵向滚动，不通过省略号或裁切压缩。

普通成功页标题和实时钟在票外；今日记录日期是辅助信息；连签保持流程顺序。两个今日记录空态沿用各自说明，不填装饰性票根。已检查 390px 手机、1440px 桌面、320px 长内容与 768px 宽度。

## Elevation & Depth

这些结果票不使用阴影。纸色、1px 边框、6px 彩色字段与虚线元数据区产生浅层次；不制造发光、纹理或摄影式深度。

## Shapes

票面 8px 圆角，结果字段与历史标记 6px 圆角。票根分隔线为 1px dashed line，两端半圆缺口跟随所在页面底色：普通成功页及连签结果页为 green，今日记录页为 cream。截图提醒为 999px 圆角的紧凑单行 pill。

## Components

### ReservationTicket

共享于三种结果页面。接受已有活动、座位、票种、抽奖结果、时间及可选详情。票头、座位、预约级中奖带、预约级未中奖区、票种摘要、元数据依次展示。不在单个座位旁附奖品。

### ScreenshotNotice

原始 `/icon.svg` 与“请截图保存本页，方便后续核对座位”同一行。背景 cream、文字 green；容器 min-height 36px、padding 6px 12px、gap 6px。

### Draw results

中奖带 lime 底与 24px 粗体；未中奖 cream 底与 14px 常规体。混合结果分区但各次结果仍携带原编号。无抽奖结果时整个区域不渲染，不显示伪造的未中奖。

### Records link and historical marker

今日记录入口 lime 底、ink 字、min-height 48px；hover 使用 #cbe465；focus-visible 为 3px paper 外描边，offset 4px，在深绿页面上保持可见。历史标记 green 底、paper 字，并保留“此前已完成”。

## Do's and Don'ts

### Do:
- **Do** 保留完整数据与预约归属，活动名、票种和奖品自然换行。
- **Do** 直接引用项目原始 icon，保留完整截图提醒。
- **Do** 分别保留今日记录顺序与连签场次顺序。
- **Do** 使用字号与字重弱化未中奖，不牺牲小字可读性。

### Don't:
- **Don't** 按座位拆票或将奖品配对至单个座位。
- **Don't** 为普通成功页补造影院、影厅、开始时间、二维码、编号或兑换操作。
- **Don't** 将无抽奖结果当作未中奖，或以中奖色强调未中奖。
- **Don't** 省略长标签、截图提醒或为了首屏截断票面。

## 系统表单控件

本节扩展至管理端与参与者入口的文本、密码、数值、文件、选择、日期、时间、开关与单选/复选控件；上文电子票根规范保持不变。沿用既有字体与暖纸色/深绿色，不替换页面布局、业务文案、字段名或提交格式。

- 普通字段最小高度 48px、圆角 10px、16px/24px 字体，内边距 11px 14px；长选择项允许增高、完整换行。
- 控件边框 `#89958e`，占位与禁用文字 `#596760`，禁用背景 `#eeeee8`，错误边框与提示 `#b42318`。键盘焦点为 2px 深绿描边、3px offset；组合字段在容器上显示焦点，内部按钮仍有独立焦点。
- 下拉选中项使用浅绿底、深绿粗体及 Lucide Check；键盘焦点独立描边。搜索列表支持上下方向键、Home/End、Escape，禁用字段及展开按钮均不可操作。
- 日期保留 React Aria 分段输入；日历单元 44px，今日下划线、选中深绿底、键盘焦点单独表达。320px 屏幕压缩弹层内边距并减少定位安全边距，不缩小日期触控目标。
- 时间使用时钟图标，小时/分钟各自滚动，分钟选项为 `00、05、10…55`；预览草稿，“完成”才写入 `HH:mm`，Escape/关闭保留已提交值。已有非五分钟时间不自动取整。必填错误将焦点交回可见控件。新建活动以默认显示时区 `Asia/Shanghai` 预填当天日期及严格晚于当前时间的下一五分钟刻度；跨午夜时日期保持当天，时间回绕到 `00:00`。
- 开关标签至少 44px，单选分段与数量选择至少 48px；复选框依靠完整标签扩大操作区域。文件字段保留原生文件选择行为。
- 错误文字自然换行，不为不存在的错误预留固定空行；数值校验沿用现有约束。减少动态效果偏好关闭控件过渡。

验收入口：`tests/browser-fixture/?kind=forms`（由 fixture server 提供）；回归覆盖搜索键盘选择、禁用状态、时间确认/取消、必填焦点、真实 FormData 值与窄屏日历定位。

## 已批准全系统 refine

本节覆盖管理端、发行/身份入口、普通/连签选座及结果；是既有深绿、青柠、米色和暖纸色世界的精修，不改变领域资格、座位状态语义色、路由、品牌图案或预约归属。

- 辅助文字统一 `#596760`。中文/混排眉题字距 `.02em`，中文标题字距 `0`、行高约 `1.2`；英文 `NOW SHOWING` 保留 `.18em`。任务标题 `clamp(30px, 4vw, 44px)`，移动管理标题 32px，成功标题 30px；表单仍为 16px/24px。
- 共享主按钮 48px、10px 圆角；行操作及移除目标至少 44px、8px 圆角。面板 16px 圆角、24px 内边距（移动 20px）；登录和身份卡去除阴影，保留品牌色与阅读顺序。
- 座位缩放工具栏依据容器换行，不用右对齐横向溢出隐藏左侧按钮。表格保留内部横向滚动、说明及键盘焦点；移动首列作为参照，不删字段和操作。短屏影厅预览允许整段滚动。
- 普通/连签底栏只使用 `left:50%` 与 `translateX(-50%)`、有界宽度。底部安全区保留；`ResizeObserver` 根据实际确认条高度调整正文留白，长座位标签完整换行。
- 表单级摘要保留稳定公共错误消息；安全字段错误同时出现在字段旁并通过 `aria-describedby` 关联，摘要可定位可见控件。动态行以稳定 key 关联提交错误，移除后不把旧错误转交新行；失败不重置用户输入或文件。
- 完成反馈只用于新完成结果：32px 青柠底、深绿短勾线 420ms；票根轻落定 420ms，连签统一延迟 160ms、总序列 580ms。内容第一帧可读；历史票和今日记录无庆祝，普通状态更新不重新播放。减少动态时为静态勾线、无位移；页面隐藏时暂停，卸载自然移除。

实际设备字体证据：本机 Chromium 的“建立选座活动”命中 PingFang SC / PingFangSC-Semibold，6 个中文 glyph、非自定义字体。系统回退声明不等于 Windows/Android/Linux 的实际命中；手机键盘、安全区、系统文字放大须按对应设备记录，不能由 CSS 宽度模拟宣称通过。

验收产物：`.impeccable/review/system-refine-implemented.html` 与同名 PNG。四宽度 116 次表面观察没有页面横溢，缩放按钮都在容器内。320px 普通确认条增高至约 135px 时，正文底部留白同步约 175px；390px 普通/连签确认条边界为 12–378px、底边 832px（844px 视口）。确认条截图使用真实视口，不以全页截图代替 fixed 布局证据。

新建、草稿、影厅实测 Chrome 原生 `defaultZoom=2`：1440px 窗口的 `innerWidth=720`、DPR=4，工具栏完整且无页面横溢；完成后恢复为 1。320×480px 影厅预览：438px 可视高度、654px 内容高度，`overflow-y:auto`，关闭按钮可见，滚动 216px 到达底部。

完成动效在 Chromium/WebKit 的现有三项目回归中验证新票落定、时钟更新不重播、历史票与今日记录零庆祝，以及减少动态时无位移。后台暂停使用 `visibilitychange` 与卸载清理实现；当前自动化上下文切页/最小化仍返回 `document.hidden=false`，因此真实后台切换未标为设备验收通过。

最终一次 Impeccable detect 返回 1 项 Arial 常见字体 warning 和 209 项字号/圆角/颜色规范 advisory。保留 Arial 是已批准的字体边界；规范扫描提醒未当作零问题证明，也不为了消除提醒修复无关 sidecar 漂移。
