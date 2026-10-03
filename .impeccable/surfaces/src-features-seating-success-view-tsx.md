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

FIRST VIEWPORT: 390px reference, 20px page and ticket padding. Compact green single-line reminder pill includes exact original project icon. Restrained state title and external clock above ticket. Seat text 48px hero / 32px compact; prizes 24px; metadata at least12px. Lime winning band follows seats; ticket types then metadata stub; records action outside. Lists remain vertical, allow natural scroll.

FORM: User-pinned modern electronic ticket; no seed competition. Approved reference: /var/folders/gh/xjp2r2ps3jg1n4324kkh_80c0000gn/T/seat-ticket-final-review.png. Synthetic sample data is not business logic. Long labels wrap completely; empty draw arrays never become losing results. Only existing original artwork ships; no newly generated raster.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
