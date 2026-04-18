import path from "node:path";
import { useCallback } from "react";

const EXTERNAL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;

export interface ResolvedDocumentLink {
  kind: "hash" | "local" | "external";
  href: string;
  relativePath?: string;
  hash?: string;
}

function splitHref(input: string): { pathValue: string; hash: string } {
  const hashIndex = input.indexOf("#");
  if (hashIndex < 0) {
    return { pathValue: input, hash: "" };
  }
  return {
    pathValue: input.slice(0, hashIndex),
    hash: input.slice(hashIndex + 1),
  };
}

function normalizeLocalDocumentPath(basePath: string, href: string): string | null {
  const decodedHref = href.trim();
  if (decodedHref.length === 0) {
    return null;
  }
  if (decodedHref.startsWith("/")) {
    const absoluteCandidate = decodedHref.slice(1);
    if (absoluteCandidate.length === 0) {
      return null;
    }
    const normalizedAbsoluteCandidate = path.posix.normalize(absoluteCandidate);
    return normalizedAbsoluteCandidate.startsWith("../") ? null : normalizedAbsoluteCandidate;
  }

  const baseDirectory = path.posix.dirname(basePath);
  const normalized = path.posix.normalize(path.posix.join(baseDirectory, decodedHref));
  if (normalized === "." || normalized.startsWith("../")) {
    return null;
  }
  return normalized;
}

export function useCheckpointAssetResolver(input: { filePath: string }) {
  const resolveDocumentLink = useCallback(
    (href: string | undefined): ResolvedDocumentLink | null => {
      if (!href) {
        return null;
      }
      const trimmedHref = href.trim();
      if (trimmedHref.length === 0) {
        return null;
      }
      if (trimmedHref.startsWith("#")) {
        return {
          kind: "hash",
          href: trimmedHref,
          hash: trimmedHref.slice(1),
        };
      }
      if (EXTERNAL_SCHEME_PATTERN.test(trimmedHref)) {
        return {
          kind: "external",
          href: trimmedHref,
        };
      }

      const { pathValue, hash } = splitHref(trimmedHref);
      const resolvedPath = normalizeLocalDocumentPath(input.filePath, pathValue);
      if (!resolvedPath) {
        return null;
      }

      return {
        kind: "local",
        href: trimmedHref,
        relativePath: resolvedPath,
        ...(hash.length > 0 ? { hash } : {}),
      };
    },
    [input.filePath],
  );

  return {
    resolveDocumentLink,
  };
}
