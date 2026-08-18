import type { ReactNode } from "react";

export type CinemaTemplateSummary = {
  id: string;
  name: string;
  hallCount: number;
};

export function HallTemplateExportMenu({ cinemas }: { cinemas: CinemaTemplateSummary[] }) {
  return (
    <details className="export-menu">
      <summary className="button" aria-label="导出影厅模板">
        导出
      </summary>
      <nav className="export-menu-popover" aria-label="影厅模板导出范围">
        <a href="/api/admin/venues/export?scope=all">
          <strong>导出全部</strong>
          <span>包含全部影院和影厅</span>
        </a>
        <span className="export-menu-label">按影院导出</span>
        {cinemas.map((cinema) => (
          <a href={`/api/admin/venues/export?scope=cinema&id=${cinema.id}`} key={cinema.id}>
            <strong>{cinema.name}</strong>
            <span>{cinema.hallCount} 个影厅模板</span>
          </a>
        ))}
      </nav>
    </details>
  );
}

export function HallTemplateGroups({
  groups,
}: {
  groups: Array<CinemaTemplateSummary & { content: ReactNode }>;
}) {
  return (
    <div className="hall-template-groups">
      {groups.map((group) => (
        <details key={group.id}>
          <summary>
            <strong>{group.name}</strong>
            <span>{group.hallCount} 个影厅模板</span>
          </summary>
          {group.content}
        </details>
      ))}
    </div>
  );
}
