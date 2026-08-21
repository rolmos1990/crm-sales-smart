"use client";

import { useRef, useState, useEffect, useCallback } from "react";

const SKIP_PAN =
  '[role="button"], button, a, input, select, textarea, [data-close-button]';

interface KanbanScrollContainerProps {
  children: React.ReactNode;
  stageColors: string[];
  className?: string;
}

// El scroll (ambos ejes) ya no vive en la fila de columnas de este
// componente — vive en el ancestro data-pipeline-vscroll (ver
// pipeline-wrapper.tsx), porque `position: sticky` en los headers de etapa
// necesita anclarse a ESE contenedor. Esta fila solo arma el layout
// horizontal (flex) y el indicador de puntitos/pan con mouse, leyendo y
// escribiendo el scroll del ancestro en vez del propio.
export function KanbanScrollContainer({
  children,
  stageColors,
  className,
}: KanbanScrollContainerProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [scrollInfo, setScrollInfo] = useState({
    left: 0,
    scrollWidth: 1,
    clientWidth: 1,
  });

  const pan = useRef({
    active: false,
    activated: false,
    startX: 0,
    startY: 0,
    lastY: 0,
    originLeft: 0,
  });

  const getVScroll = useCallback(
    () => rowRef.current?.closest<HTMLElement>("[data-pipeline-vscroll]") ?? null,
    []
  );

  const syncScroll = useCallback(() => {
    const el = getVScroll();
    if (!el) return;
    setScrollInfo({
      left: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    });
  }, [getVScroll]);

  useEffect(() => {
    const el = getVScroll();
    if (!el) return;
    syncScroll();
    el.addEventListener("scroll", syncScroll, { passive: true });
    const ro = new ResizeObserver(syncScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", syncScroll);
      ro.disconnect();
    };
  }, [syncScroll, getVScroll]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest(SKIP_PAN)) return;
      const el = getVScroll();
      if (!el) return;
      pan.current = {
        active: true,
        activated: false,
        startX: e.clientX,
        startY: e.clientY,
        lastY: e.clientY,
        originLeft: el.scrollLeft,
      };
    },
    [getVScroll]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const p = pan.current;
      if (!p.active) return;
      if (!p.activated) {
        if (
          Math.abs(e.clientX - p.startX) < 4 &&
          Math.abs(e.clientY - p.startY) < 4
        )
          return;
        p.activated = true;
        p.lastY = e.clientY;
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }
      const el = getVScroll();
      if (el) {
        el.scrollLeft = p.originLeft - (e.clientX - p.startX);
        el.scrollTop -= e.clientY - p.lastY;
        p.lastY = e.clientY;
      }
    };

    const onUp = () => {
      if (!pan.current.active) return;
      pan.current.active = false;
      pan.current.activated = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [getVScroll]);

  const maxScroll = scrollInfo.scrollWidth - scrollInfo.clientWidth;
  const showIndicator = maxScroll > 4;
  const progress = maxScroll > 0 ? Math.min(1, scrollInfo.left / maxScroll) : 0;
  const colors = stageColors.length > 0 ? stageColors : ["#a8a29e"];

  return (
    <div className="relative">
      <div
        ref={rowRef}
        data-kanban-scroll=""
        // items-stretch explícito (por defecto ya computa igual: `normal` en
        // un flex row equivale a `stretch`) — así todas las columnas quedan a
        // la altura de la más alta sin necesidad de medir nada por JS, ver
        // ColumnaStage en pipeline-kanban-dinamico.tsx.
        className={`flex items-stretch gap-4 ${
          showIndicator ? "pb-7" : "pb-6"
        } ${className ?? ""}`.trim()}
        onMouseDown={onMouseDown}
      >
        {children}
      </div>

      {showIndicator && (
        <div className="absolute bottom-2 right-2 flex items-center gap-[5px] pointer-events-none select-none">
          {colors.map((color, i) => {
            const segSize = 1 / colors.length;
            const isActive = progress >= i * segSize;
            const isCurrent =
              isActive &&
              (i === colors.length - 1
                ? true
                : progress < (i + 1) * segSize);

            return (
              <div
                key={i}
                style={{
                  width: isCurrent ? 10 : 6,
                  height: isCurrent ? 6 : 4,
                  borderRadius: 999,
                  backgroundColor: isActive
                    ? `${color}${isCurrent ? "ee" : "66"}`
                    : "rgba(120,113,108,0.22)",
                  transition: "all 200ms ease",
                  flexShrink: 0,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
