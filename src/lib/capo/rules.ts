import type { ElementNode } from "ultrahtml";
import { renderSync } from "ultrahtml";

type Attributes = Record<string, string>;

function has(value: unknown): value is string {
  return typeof value === "string";
}
function is<T>(a: unknown, b: T): a is T {
  return a === b;
}
function any(a: string | undefined, b: string[]): a is string {
  return has(a) && b.includes(a.toLowerCase());
}

export const ElementWeights: Record<string, number> = {
  META: 10,
  TITLE: 9,
  PRECONNECT: 8,
  ASYNC_SCRIPT: 7,
  IMPORT_STYLES: 6,
  SYNC_SCRIPT: 5,
  SYNC_STYLES: 4,
  PRELOAD: 3,
  DEFER_SCRIPT: 2,
  PREFETCH_PRERENDER: 1,
  OTHER: 0,
};

export const ElementDetectors = {
  META: isMeta,
  TITLE: isTitle,
  PRECONNECT: isPreconnect,
  DEFER_SCRIPT: isDeferScript,
  ASYNC_SCRIPT: isAsyncScript,
  IMPORT_STYLES: isImportStyles,
  SYNC_SCRIPT: isSyncScript,
  SYNC_STYLES: isSyncStyles,
  PRELOAD: isPreload,
  PREFETCH_PRERENDER: isPrefetchPrerender,
};

export const META_HTTP_EQUIV_KEYWORDS = [
  "accept-ch",
  "content-security-policy",
  "content-type",
  "default-style",
  "delegate-ch",
  "origin-trial",
  "x-dns-prefetch-control",
];

export function isMeta(name: string, a: Attributes) {
  if (name === "base") return true;
  if (name !== "meta") return false;
  return (
    has(a.charset) ||
    is(a.name, "viewport") ||
    any(a["http-equiv"], META_HTTP_EQUIV_KEYWORDS)
  );
}

export function isTitle(name: string) {
  return name === "title";
}

export function isPreconnect(name: string, { rel }: Attributes) {
  return name === "link" && is(rel, "preconnect");
}

export function isAsyncScript(name: string, { src, async }: Attributes) {
  return name === "script" && has(src) && has(async);
}

export function isImportStyles(
  name: string,
  _a: Attributes,
  children: string,
) {
  if (name === "style") {
    return /@import/.test(children);
  }
  return false;
}

export function isSyncScript(
  name: string,
  { src, defer, async, type = "" }: Attributes,
) {
  if (name !== "script") return false;
  return !(
    (has(src) && (has(defer) || has(async) || is(type, "module"))) ||
    type.includes("json")
  );
}

export function isSyncStyles(name: string, { rel }: Attributes) {
  if (name === "style") return true;
  return name === "link" && is(rel, "stylesheet");
}

export function isPreload(name: string, { rel }: Attributes) {
  return name === "link" && any(rel, ["preload", "modulepreload"]);
}

export function isDeferScript(
  name: string,
  { src, defer, async, type }: Attributes,
) {
  if (name !== "script") return false;
  return (
    (has(src) && has(defer)) ||
    (has(src) && is(type, "module") && !has(async))
  );
}

export function isPrefetchPrerender(name: string, { rel }: Attributes) {
  return name === "link" && any(rel, ["prefetch", "dns-prefetch", "prerender"]);
}

export function getWeight(element: ElementNode) {
  for (const [id, detector] of Object.entries(ElementDetectors)) {
    const children =
      element.name === "style" && element.children.length > 0
        ? renderSync(element)
        : "";
    if (detector(element.name, element.attributes, children)) {
      return ElementWeights[id];
    }
  }
  return ElementWeights.OTHER;
}
