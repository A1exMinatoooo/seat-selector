import Link from "next/link";

export function AdminBackButton({ href, label }: { href: string; label: string }) {
  return <Link className="admin-back-button" href={href}>← 返回{label}</Link>;
}
