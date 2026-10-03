---
name: Pick Your Seat · Reservation Results
description: 以已确认座位为中心的现代电子票根；仅记录本次结果页范围。
colors:
  ink: "#15201d"
  muted: "#65716d"
  cream: "#f3f0e8"
  paper: "#fffdf7"
  green: "#174f42"
  lime: "#d6ef73"
  line: "#dcd8cc"
  lime-hover: "#cbe465"
typography:
  seats:
    fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "48px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  compact-seats:
    fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  prizes:
    fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.45
  metadata:
    fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
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
- 原始持票鸭 icon、单行深绿截图 pill、暖纸色平面票根。
- 长内容完整换行，多个记录垂直排列。

## Colors

颜色取自 `src/app/globals.css`：cream 为页面与中性结果底，paper 为票面，ink 为正文，muted 为票面辅助标签，green 为截图提醒与历史标记，lime 为中奖带与今日记录入口，line 为细边框和虚线分隔。

未中奖保持 cream 底、14px 常规字重，但使用 ink，避免原 muted 配 cream 的 4.46:1 对比度。实际移动端与桌面运行测得 ink / cream 为 14.68:1。中奖带不用于未中奖；没有抽奖结果不显示结果区。

## Typography

继承 Arial、PingFang SC、Microsoft YaHei、sans-serif，不引入新字体。座位：普通成功页 48px/800/1.2；今日记录、连签与紧凑状态票 32px/800/1.2。中奖结果 24px/700/1.45。活动标题 22px/1.4；票种摘要 16px/700/1.5；票面标签 14px/1.5；确认时间、手机尾号与开始时间 12px/1.6，数字使用 tabular-nums。

截图提醒字体 `clamp(12px, 3.3vw, 14px)`，文案不换行；icon 为 24px × 24px，完整图案 contain，不裁切。

## Layout

票面、截图提醒和结果入口最大宽度 560px；窄屏随可用宽度缩小，不采用固定高度。票面主体 padding 20px、组间距 20px。座位列表 flex-wrap，8px × 20px gap；长标签可完整换行。票根元数据 padding 16px 20px、行间距 6px。完整内容允许页面纵向滚动，不通过省略号或裁切压缩。

普通成功页标题和实时钟在票外；今日记录日期是辅助信息；连签保持流程顺序。两个今日记录空态沿用各自说明，不填装饰性票根。已检查 390px 手机、1440px 桌面、320px 长内容与 768px 宽度。

## Elevation & Depth

这些结果票不使用阴影。纸色、1px 边框、6px 彩色字段与虚线元数据区产生浅层次；不制造发光、纹理或摄影式深度。

## Shapes

票面 8px 圆角，结果字段与历史标记 6px 圆角。票根分隔线为 1px dashed line，两端使用 cream 色半圆缺口。截图提醒为 999px 圆角的紧凑单行 pill。

## Components

### ReservationTicket

共享于三种结果页面。接受已有活动、座位、票种、抽奖结果、时间及可选详情。票头、座位、预约级中奖带、预约级未中奖区、票种摘要、元数据依次展示。不在单个座位旁附奖品。

### ScreenshotNotice

原始 `/icon.svg` 与“请截图保存本页，方便后续核对座位”同一行。背景 green、文字 paper；容器 min-height 36px、padding 6px 12px、gap 6px。

### Draw results

中奖带 lime 底与 24px 粗体；未中奖 cream 底与 14px 常规体。混合结果分区但各次结果仍携带原编号。无抽奖结果时整个区域不渲染，不显示伪造的未中奖。

### Records link and historical marker

今日记录入口 lime 底、ink 字、min-height 48px；hover 使用 #cbe465；focus-visible 为 3px green 外描边，offset 4px。历史标记 green 底、paper 字，并保留“此前已完成”。

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
