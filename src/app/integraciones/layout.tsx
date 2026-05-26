import { ReactNode } from "react";
import { AppLayout } from "@/shared/ui/app-sidebar";

export default function IntegracionesLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
