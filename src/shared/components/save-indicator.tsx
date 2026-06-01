"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SaveIndicatorProps {
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error?: Error | null;
  className?: string;
}

export function SaveIndicator({
  isPending,
  isSuccess,
  isError,
  error,
  className,
}: SaveIndicatorProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isPending || isError) {
      setVisible(true);
      return;
    }
    if (isSuccess) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isPending, isSuccess, isError]);

  if (!visible) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium transition-all",
        isPending && "text-muted-foreground",
        isSuccess && "text-emerald-500",
        isError && "text-destructive",
        className,
      )}
    >
      {isPending && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Guardando...
        </>
      )}
      {isSuccess && !isPending && (
        <>
          <Check className="h-3 w-3" />
          Guardado
        </>
      )}
      {isError && !isPending && (
        <>
          <X className="h-3 w-3" />
          {error?.message ?? "Error al guardar"}
        </>
      )}
    </span>
  );
}
