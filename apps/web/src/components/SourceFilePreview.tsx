import { use, useMemo } from "react";

import { resolveDiffThemeName, type DiffThemeName } from "~/lib/diffRendering";
import { cn } from "~/lib/utils";
import { useTheme } from "~/hooks/useTheme";
import {
  createHighlightCacheKey,
  estimateHighlightedSize,
  getHighlighterPromise,
  highlightedCodeCache,
} from "~/lib/codeHighlighting";

function HighlightedSourceMarkup(props: {
  code: string;
  language: string;
  themeName: DiffThemeName;
}) {
  const cacheKey = createHighlightCacheKey(props.code, props.language, props.themeName);
  const cachedMarkup = highlightedCodeCache.get(cacheKey);
  if (cachedMarkup != null) {
    return (
      <div
        className="source-file-preview-html"
        dangerouslySetInnerHTML={{ __html: cachedMarkup }}
      />
    );
  }

  const highlighter = use(getHighlighterPromise(props.language));
  const highlightedHtml = useMemo(() => {
    try {
      return highlighter.codeToHtml(props.code, {
        lang: props.language,
        theme: props.themeName,
      });
    } catch {
      return highlighter.codeToHtml(props.code, {
        lang: "text",
        theme: props.themeName,
      });
    }
  }, [highlighter, props.code, props.language, props.themeName]);

  highlightedCodeCache.set(
    cacheKey,
    highlightedHtml,
    estimateHighlightedSize(highlightedHtml, props.code),
  );

  return (
    <div
      className="source-file-preview-html"
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
    />
  );
}

export function SourceFilePreview(props: { code: string; language: string; wordWrap: boolean }) {
  const { resolvedTheme } = useTheme();
  const themeName = resolveDiffThemeName(resolvedTheme);

  return (
    <div
      className={cn(
        "source-file-preview min-h-0 overflow-auto rounded-2xl border border-border/60 bg-card/40",
        props.wordWrap && "data-[wrap=true]:[&_pre]:overflow-x-hidden",
      )}
      data-wrap={props.wordWrap ? "true" : "false"}
    >
      <HighlightedSourceMarkup code={props.code} language={props.language} themeName={themeName} />
    </div>
  );
}
