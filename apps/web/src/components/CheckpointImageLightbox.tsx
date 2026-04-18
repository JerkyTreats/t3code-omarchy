import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useEffect } from "react";

import { cn } from "~/lib/utils";

interface LightboxImage {
  src: string;
  alt: string;
}

export function CheckpointImageLightbox(props: {
  images: readonly LightboxImage[];
  index: number;
  onClose: () => void;
  onNavigate?: (direction: -1 | 1) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
        return;
      }
      if (event.key === "ArrowLeft" && props.images.length > 1) {
        props.onNavigate?.(-1);
      }
      if (event.key === "ArrowRight" && props.images.length > 1) {
        props.onNavigate?.(1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [props]);

  const activeImage = props.images[props.index];
  if (!activeImage) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/92 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close image preview"
        className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md border border-border/70 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
        onClick={props.onClose}
      >
        <XIcon className="size-4" />
      </button>
      {props.images.length > 1 ? (
        <button
          type="button"
          aria-label="Previous image"
          className="absolute left-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => props.onNavigate?.(-1)}
        >
          <ChevronLeftIcon className="size-4" />
        </button>
      ) : null}
      <div className="flex max-h-full max-w-full flex-col items-center gap-3 px-12 py-8">
        <img
          src={activeImage.src}
          alt={activeImage.alt}
          className="max-h-[80vh] max-w-[90vw] rounded-xl border border-border/70 bg-card/50 object-contain shadow-2xl"
        />
        {activeImage.alt.length > 0 ? (
          <p className="max-w-2xl text-center text-sm text-muted-foreground">{activeImage.alt}</p>
        ) : null}
      </div>
      {props.images.length > 1 ? (
        <button
          type="button"
          aria-label="Next image"
          className={cn(
            "absolute right-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground transition-colors hover:text-foreground",
          )}
          onClick={() => props.onNavigate?.(1)}
        >
          <ChevronRightIcon className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
