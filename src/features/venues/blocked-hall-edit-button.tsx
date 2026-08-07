"use client";

export function BlockedHallEditButton() {
  return <button className="text-button" type="button" onClick={() => window.alert("该影厅模板仍有关联的草稿或进行中活动，暂时不能编辑。请先结束相关活动。")}>编辑</button>;
}
