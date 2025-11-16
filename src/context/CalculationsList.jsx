// src/components/CalculationsList.jsx - OPTIMISÉ, SILENCIEUX, FLUIDE
import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCalculation } from "../context/CalculationContext";
import { useDebouncedCallback } from "use-debounce";

export default function CalculationsList() {
  const { savedCalculations, fetchSavedCalculations, loading, currentProjectType } = useCalculation();
  const parentRef = useRef(null);

  // === VIRTUALIZER (plus performant que useVirtual) ===
  const rowVirtualizer = useVirtualizer({
    count: savedCalculations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  // === DEBOUNCED FETCH ===
  const debouncedFetch = useDebouncedCallback(() => {
    if (loading) return;
    fetchSavedCalculations({ projectType: currentProjectType, offset: savedCalculations.length });
  }, 200);

  // === SCROLL INFINI ===
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = parent;
      if (scrollTop + clientHeight >= scrollHeight - 150 && !loading) {
        debouncedFetch();
      }
    };

    parent.addEventListener("scroll", handleScroll, { passive: true });
    return () => parent.removeEventListener("scroll", handleScroll);
  }, [debouncedFetch, loading, savedCalculations.length, currentProjectType]);

  // === RECHARGE AU CHANGEMENT DE PROJET ===
  useEffect(() => {
    fetchSavedCalculations({ projectType: currentProjectType, offset: 0 });
  }, [currentProjectType, fetchSavedCalculations]);

  // === MEMO: ÉVITE RENDUS INUTILES ===
  const virtualItems = useMemo(() => rowVirtualizer.getVirtualItems(), [rowVirtualizer]);

  if (!savedCalculations.length && !loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Aucun calcul disponible
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto border border-gray-200 rounded-lg"
    >
      <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
        {virtualItems.map((virtualRow) => {
          const calc = savedCalculations[virtualRow.index];
          if (!calc) return null;

          return (
            <div
              key={calc._id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={`px-4 py-3 border-b border-gray-100 ${
                virtualRow.index % 2 === 0 ? "bg-gray-50" : "bg-white"
              }`}
            >
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-gray-900">
                  {calc.calculationType}
                </span>
                <span className="text-gray-500">
                  {calc.projectType}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(calc.savedAt).toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="sticky bottom-0 w-full text-center py-3 bg-white border-t border-gray-100 text-sm text-gray-500">
            Chargement...
          </div>
        )}
      </div>
    </div>
  );
}