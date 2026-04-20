import { CheckIcon, CopyIcon, ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";
import {
  Children,
  Suspense,
  isValidElement,
  use,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { readNativeApi } from "~/nativeApi";
import { resolveDiffThemeName, type DiffThemeName } from "~/lib/diffRendering";
import { useTheme } from "~/hooks/useTheme";
import { cn } from "~/lib/utils";
import { useCheckpointAssetResolver } from "./useCheckpointAssetResolver";
import { CheckpointImageLightbox } from "./CheckpointImageLightbox";
import {
  createHighlightCacheKey,
  estimateHighlightedSize,
  extractFenceLanguage,
  getHighlighterPromise,
  highlightedCodeCache,
} from "~/lib/codeHighlighting";

function nodeToPlainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((child) => nodeToPlainText(child)).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return nodeToPlainText(node.props.children);
  }
  return "";
}

function extractCodeBlock(
  children: ReactNode,
): { className: string | undefined; code: string } | null {
  const childNodes = Children.toArray(children);
  if (childNodes.length !== 1) {
    return null;
  }

  const onlyChild = childNodes[0];
  if (
    !isValidElement<{ className?: string; children?: ReactNode }>(onlyChild) ||
    onlyChild.type !== "code"
  ) {
    return null;
  }

  return {
    className: onlyChild.props.className,
    code: nodeToPlainText(onlyChild.props.children),
  };
}

function createSlugger() {
  const counts = new Map<string, number>();
  return (value: string) => {
    const normalized = value
      .toLowerCase()
      .trim()
      .replace(/[`*_~]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const base = normalized.length > 0 ? normalized : "section";
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

function HeadingAnchor(props: {
  id: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <a
      href={`#${props.id}`}
      className="document-heading-anchor"
      aria-label="Link to section"
      onClick={(e) => {
        e.preventDefault();
        props.containerRef.current
          ?.querySelector<HTMLElement>(`[data-document-heading-id='${props.id}']`)
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
        history.replaceState(null, "", `#${props.id}`);
      }}
    >
      #
    </a>
  );
}

function DocumentCodeBlock(props: {
  code: string;
  className: string | undefined;
  themeName: DiffThemeName;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const language = extractFenceLanguage(props.className);
  const cacheKey = createHighlightCacheKey(props.code, language, props.themeName);
  const cachedMarkup = highlightedCodeCache.get(cacheKey);

  useEffect(
    () => () => {
      if (copiedTimerRef.current != null) {
        clearTimeout(copiedTimerRef.current);
      }
    },
    [],
  );

  const onCopy = () => {
    if (!navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(props.code).then(() => {
      if (copiedTimerRef.current != null) {
        clearTimeout(copiedTimerRef.current);
      }
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false);
        copiedTimerRef.current = null;
      }, 1200);
    });
  };

  if (cachedMarkup != null) {
    return (
      <div className="document-code-block">
        <button
          type="button"
          className="document-code-copy"
          onClick={onCopy}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        </button>
        <div dangerouslySetInnerHTML={{ __html: cachedMarkup }} />
      </div>
    );
  }

  const highlighter = use(getHighlighterPromise(language));
  const highlightedHtml = useMemo(() => {
    try {
      return highlighter.codeToHtml(props.code, {
        lang: language,
        theme: props.themeName,
      });
    } catch {
      return highlighter.codeToHtml(props.code, {
        lang: "text",
        theme: props.themeName,
      });
    }
  }, [highlighter, language, props.code, props.themeName]);

  highlightedCodeCache.set(
    cacheKey,
    highlightedHtml,
    estimateHighlightedSize(highlightedHtml, props.code),
  );

  return (
    <div className="document-code-block">
      <button
        type="button"
        className="document-code-copy"
        onClick={onCopy}
        aria-label={copied ? "Copied" : "Copy code"}
      >
        {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      </button>
      <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
    </div>
  );
}

function MermaidBlock(props: { code: string }) {
  const { resolvedTheme } = useTheme();
  const renderId = useId().replace(/:/g, "-");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    let disposed = false;
    setSvg(null);
    setError(null);

    void import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: resolvedTheme === "dark" ? "dark" : "neutral",
      });
      try {
        const result = await mermaid.render(renderId, props.code);
        if (!disposed) {
          setSvg(result.svg);
        }
      } catch (nextError) {
        if (!disposed) {
          setError(nextError instanceof Error ? nextError.message : "Failed to render Mermaid.");
        }
      }
    });

    return () => {
      disposed = true;
    };
  }, [props.code, renderId, resolvedTheme]);

  return (
    <div className="document-mermaid-block">
      {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : null}
      {error ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-sm text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <TriangleAlertIcon className="size-4" />
            Mermaid render failed
          </div>
          <p className="mt-1 text-amber-100/80">{error}</p>
          <button
            type="button"
            className="mt-2 text-xs underline underline-offset-4"
            onClick={() => setShowSource((current) => !current)}
          >
            {showSource ? "Hide source" : "Show source"}
          </button>
          {showSource ? (
            <pre className="mt-3 overflow-auto rounded-lg border border-border/60 bg-background/70 p-3 text-xs">
              {props.code}
            </pre>
          ) : null}
        </div>
      ) : null}
      {!svg && !error ? (
        <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
          Rendering Mermaid diagram...
        </div>
      ) : null}
    </div>
  );
}

export interface RenderResolvedDocumentImageInput {
  relativePath: string;
  alt: string;
  onOpen: (src: string, alt: string) => void;
}

export function DocumentMarkdownRenderer(props: {
  filePath: string;
  markdown: string;
  onNavigateToPath: (relativePath: string, hash?: string) => void;
  onOpenFileInEditor: (relativePath: string) => void;
  renderResolvedImage?: (input: RenderResolvedDocumentImageInput) => ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const themeName = resolveDiffThemeName(resolvedTheme);
  const { resolveDocumentLink } = useCheckpointAssetResolver({ filePath: props.filePath });
  const headingSlug = useMemo(() => createSlugger(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  useLayoutEffect(() => {
    containerRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [props.filePath, props.markdown]);

  const markdownComponents = useMemo<Components>(
    () => ({
      a({ href, children, ...linkProps }) {
        const resolved = resolveDocumentLink(href);
        if (!resolved) {
          return (
            <a {...linkProps} href={href}>
              {children}
            </a>
          );
        }

        if (resolved.kind === "hash") {
          return (
            <a
              {...linkProps}
              href={href}
              onClick={(event) => {
                event.preventDefault();
                const target = containerRef.current?.querySelector<HTMLElement>(
                  `[data-document-heading-id='${resolved.hash ?? ""}']`,
                );
                target?.scrollIntoView({ block: "start", behavior: "smooth" });
              }}
            >
              {children}
            </a>
          );
        }

        if (resolved.kind === "external") {
          return (
            <a
              {...linkProps}
              href={href}
              onClick={(event) => {
                event.preventDefault();
                const api = readNativeApi();
                if (api) {
                  void api.shell.openExternal(resolved.href);
                }
              }}
            >
              <span>{children}</span>
              <ExternalLinkIcon className="ml-1 inline size-3.5 align-text-bottom" />
            </a>
          );
        }

        return (
          <a
            {...linkProps}
            href={href}
            onClick={(event) => {
              event.preventDefault();
              props.onNavigateToPath(resolved.relativePath ?? props.filePath, resolved.hash);
            }}
          >
            {children}
          </a>
        );
      },
      img({ src, alt = "" }) {
        const resolved = resolveDocumentLink(src);
        if (!resolved || resolved.kind === "external") {
          return (
            <figure className="document-image-figure">
              <button
                type="button"
                className="w-full"
                onClick={() => {
                  if (src) {
                    setLightbox({ src, alt });
                  }
                }}
              >
                <img
                  src={src}
                  alt={alt}
                  className="document-image"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </button>
              {alt.length > 0 ? (
                <figcaption className="document-image-caption">{alt}</figcaption>
              ) : null}
            </figure>
          );
        }
        return (
          props.renderResolvedImage?.({
            relativePath: resolved.relativePath ?? props.filePath,
            alt,
            onOpen: (nextSrc, nextAlt) => setLightbox({ src: nextSrc, alt: nextAlt }),
          }) ?? <div className="document-image-placeholder">Image unavailable.</div>
        );
      },
      pre({ children }) {
        const codeBlock = extractCodeBlock(children);
        if (!codeBlock) {
          return <pre>{children}</pre>;
        }
        if (extractFenceLanguage(codeBlock.className) === "mermaid") {
          return <MermaidBlock code={codeBlock.code} />;
        }
        return (
          <Suspense fallback={<pre>{children}</pre>}>
            <DocumentCodeBlock
              code={codeBlock.code}
              className={codeBlock.className}
              themeName={themeName}
            />
          </Suspense>
        );
      },
      h1({ children, ...headingProps }) {
        const id = headingSlug(nodeToPlainText(children));
        return (
          <h1 {...headingProps} id={id} data-document-heading-id={id}>
            {children}
            <HeadingAnchor id={id} containerRef={containerRef} />
          </h1>
        );
      },
      h2({ children, ...headingProps }) {
        const id = headingSlug(nodeToPlainText(children));
        return (
          <h2 {...headingProps} id={id} data-document-heading-id={id}>
            {children}
            <HeadingAnchor id={id} containerRef={containerRef} />
          </h2>
        );
      },
      h3({ children, ...headingProps }) {
        const id = headingSlug(nodeToPlainText(children));
        return (
          <h3 {...headingProps} id={id} data-document-heading-id={id}>
            {children}
            <HeadingAnchor id={id} containerRef={containerRef} />
          </h3>
        );
      },
      h4({ children, ...headingProps }) {
        const id = headingSlug(nodeToPlainText(children));
        return (
          <h4 {...headingProps} id={id} data-document-heading-id={id}>
            {children}
            <HeadingAnchor id={id} containerRef={containerRef} />
          </h4>
        );
      },
      h5({ children, ...headingProps }) {
        const id = headingSlug(nodeToPlainText(children));
        return (
          <h5 {...headingProps} id={id} data-document-heading-id={id}>
            {children}
            <HeadingAnchor id={id} containerRef={containerRef} />
          </h5>
        );
      },
      h6({ children, ...headingProps }) {
        const id = headingSlug(nodeToPlainText(children));
        return (
          <h6 {...headingProps} id={id} data-document-heading-id={id}>
            {children}
            <HeadingAnchor id={id} containerRef={containerRef} />
          </h6>
        );
      },
    }),
    [headingSlug, props, resolveDocumentLink, themeName],
  );

  const sanitizeSchema = useMemo(
    () => ({
      ...defaultSchema,
      tagNames: [...(defaultSchema.tagNames ?? []), "details", "summary", "img"],
      attributes: {
        ...defaultSchema.attributes,
        img: ["src", "alt", "title"],
        a: ["href", "title"],
      },
    }),
    [],
  );

  return (
    <div className="document-preview-shell relative min-h-0 flex-1 overflow-hidden">
      {lightbox ? (
        <CheckpointImageLightbox
          images={[{ src: lightbox.src, alt: lightbox.alt }]}
          index={0}
          onClose={() => setLightbox(null)}
        />
      ) : null}
      <div className="document-preview-layout h-full min-h-0 overflow-auto" ref={containerRef}>
        <div className="mx-auto min-h-full max-w-[860px] px-4 py-4">
          <article
            className={cn(
              "document-markdown min-w-0 rounded-[28px] border border-border/60 bg-card/55 p-5 shadow-[0_24px_80px_-48px_color-mix(in_srgb,var(--foreground)_42%,transparent)] backdrop-blur-md sm:p-7",
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[[rehypeRaw], [rehypeSanitize, sanitizeSchema]]}
              components={markdownComponents}
            >
              {props.markdown}
            </ReactMarkdown>
            <div className="mt-8 border-t border-border/60 pt-4 text-xs text-muted-foreground/75">
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => props.onOpenFileInEditor(props.filePath)}
              >
                Open source in editor
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
