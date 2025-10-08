import { useState, useCallback, useMemo } from "react";

export interface UseBulkSelectionReturn {
  selectedIds: Set<string>;
  toggleSelectAll: () => void;
  toggleSelectItem: (id: string) => void;
  clearSelection: () => void;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  hasSelection: boolean;
  selectedCount: number;
  selectedArray: string[];
}

export const useBulkSelection = (items: Array<{ id: string }>): UseBulkSelectionReturn => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Toggle all items
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === items.length) {
        // All selected, deselect all
        return new Set();
      } else {
        // Some or none selected, select all
        return new Set(items.map((item) => item.id));
      }
    });
  }, [items]);

  // Toggle individual item
  const toggleSelectItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Derived state
  const isAllSelected = useMemo(
    () => selectedIds.size === items.length && items.length > 0,
    [selectedIds.size, items.length]
  );

  const isIndeterminate = useMemo(
    () => selectedIds.size > 0 && selectedIds.size < items.length,
    [selectedIds.size, items.length]
  );

  const hasSelection = useMemo(() => selectedIds.size > 0, [selectedIds.size]);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds.size]);

  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return {
    selectedIds,
    toggleSelectAll,
    toggleSelectItem,
    clearSelection,
    isAllSelected,
    isIndeterminate,
    hasSelection,
    selectedCount,
    selectedArray,
  };
};
