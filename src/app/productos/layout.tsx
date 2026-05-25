import { ReactNode } from "react";
import { AppLayout } from "@/shared/ui/app-sidebar";

export default function ProductosLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
