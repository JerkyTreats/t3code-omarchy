import { HighlightedCodeBlock } from "./ChatMarkdown";

function codeLanguageClassName(language: string): string {
  const normalizedLanguage = language.trim().replaceAll(/[^\w#+.-]/g, "");
  return `language-${normalizedLanguage || "text"}`;
}

export function DocumentCodeRenderer(props: { code: string; language: string; wordWrap: boolean }) {
  return (
    <div className="h-full min-h-0 overflow-auto bg-background">
      <div className="min-h-full">
        <div
          className="document-code-renderer chat-markdown min-h-full min-w-0 text-sm leading-relaxed text-foreground/80"
          data-word-wrap={props.wordWrap ? "true" : undefined}
        >
          <HighlightedCodeBlock
            className={codeLanguageClassName(props.language)}
            code={props.code}
            isStreaming={false}
          />
        </div>
      </div>
    </div>
  );
}
