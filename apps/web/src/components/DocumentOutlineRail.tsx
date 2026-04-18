export interface DocumentOutlineItem {
  readonly id: string;
  readonly text: string;
  readonly depth: number;
}

export function DocumentOutlineRail(props: {
  items: readonly DocumentOutlineItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <aside className="document-outline-rail hidden xl:block">
      <div className="sticky top-4 rounded-2xl border border-border/60 bg-card/55 p-3 backdrop-blur-sm">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
          Outline
        </div>
        <div className="space-y-1">
          {props.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="document-outline-item flex w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
              data-active={item.id === props.activeId ? "true" : "false"}
              style={{ paddingLeft: `${8 + (item.depth - 1) * 10}px` }}
              onClick={() => props.onSelect(item.id)}
            >
              <span className="truncate">{item.text}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
