---
version: 1
slug: "src-features-seating-success-view-tsx"
primary_target: "src/features/seating/success-view.tsx"
related_targets: ["src/features/records/today-records-view.tsx","src/features/seating/consecutive-seat-flow.tsx"]
---

# Reservation results

Mode: Operate. Scope: ordinary success, today's records, consecutive results, lottery result summaries, both records empty states. Preserve API contracts, reservation sorting, pending draw flow and original icon. User approved the five-section concept board and explicitly authorized implementation.

## Direction contract

THESIS: One rectangular electronic ticket per reservation or consecutive step; seat labels are first focus and reservation-wide prizes second. Never pair a prize with one seat.

OWN-WORLD: Existing cream #f3f0e8, paper #fffdf7, ink #15201d, green #174f42, lime #d6ef73, line #dcd8cc and Arial/PingFang SC/Microsoft YaHei. 8px ticket corners, dashed horizontal metadata stub with side notches. No new fonts, textures, QR or decoration.

STORY: Confirm all seats, read each draw without losing non-winners, retain screenshot, optionally visit today's ordered reservations. Historical consecutive steps remain identifiable.

FIRST VIEWPORT: 390px reference, 20px page and ticket padding. Ordinary success and consecutive results use a green #174f42 canvas, paper #fffdf7 external title and clock, cream #f3f0e8 consecutive subtitle, and cream single-line reminder pill with green text and the exact original project icon. Ticket paper stays #fffdf7; seat text is green, 48px hero / 32px compact. Side notches match the green canvas. Today's records retain the cream canvas, ink seats and cream notches. Prizes stay 24px; metadata at least12px. Lime winning band follows seats; ticket types then metadata stub; records action outside with a paper focus ring on green. Lists remain vertical, allow natural scroll.

FORM: User-pinned modern electronic ticket; no seed competition. Approved reference: /var/folders/gh/xjp2r2ps3jg1n4324kkh_80c0000gn/T/seat-ticket-final-review.png. Synthetic sample data is not business logic. Long labels wrap completely; empty draw arrays never become losing results. Only existing original artwork ships; no newly generated raster.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Approved color refinement

User approved the ordinary-success color preview and requested the same treatment for consecutive results. Shared `.success-page` rules implement both without changing ticket paper, lottery fields, copy, result order or today's records. No new raster assets ship.

Finish verdict: approved preview matched in running fixtures at 390px mobile and 1440px desktop. Both consecutive tickets and the historical marker remain visible through natural scroll. 320px long-content and consecutive checks have no horizontal overflow; the screenshot reminder fits one line. Green/cream contrast is 8.26:1; green/paper contrast is 9.24:1. Lint, typecheck, 257 unit tests, 18 result-ticket Playwright cases across desktop/Safari/mobile and isolated production build passed. Full isolated business E2E was attempted but blocked by the existing LAN HTTPS service on port 3100; no existing process was stopped.
