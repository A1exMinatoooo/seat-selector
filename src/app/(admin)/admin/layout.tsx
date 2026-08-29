import type { ReactNode } from "react";
import { AdminToastProvider } from "@/features/admin/admin-toast";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminToastProvider>{children}</AdminToastProvider>;
}
