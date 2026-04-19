import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface DiffPanelExpandedContextValue {
  panelExpanded: boolean;
  setPanelExpanded: (v: boolean) => void;
}

const DiffPanelExpandedContext = createContext<DiffPanelExpandedContextValue>({
  panelExpanded: false,
  setPanelExpanded: () => {},
});

export function useDiffPanelExpanded() {
  return useContext(DiffPanelExpandedContext);
}

export function DiffPanelExpandedProvider({ children }: { children: ReactNode }) {
  const [panelExpanded, setPanelExpanded] = useState(false);
  const value = useMemo(() => ({ panelExpanded, setPanelExpanded }), [panelExpanded]);
  return <DiffPanelExpandedContext value={value}>{children}</DiffPanelExpandedContext>;
}
