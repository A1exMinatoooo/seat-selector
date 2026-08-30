import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function AdminBackButton({ href, label }: { href: string; label: string }) {
  return (
    <Link className="admin-back-button" href={href}>
      <ArrowLeft aria-hidden="true" size={20} strokeWidth={2} />
      返回{label}
    </Link>
  );
}
