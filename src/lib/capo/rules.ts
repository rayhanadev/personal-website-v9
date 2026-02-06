import type { Element, Properties } from "hast";
import { toHtml } from "hast-util-to-html";

type Detector = (tag: string, p: Properties, css: string) => boolean;

const META_HTTP_EQUIV_KEYWORDS = [
  "accept-ch",
  "content-security-policy",
  "content-type",
  "default-style",
  "delegate-ch",
  "origin-trial",
  "x-dns-prefetch-control",
];

function has(value: unknown): boolean {
  return value != null && value !== false;
}

function str(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0]?.toString();
  return undefined;
}

const RULES: [number, Detector][] = [
  [10, (tag, p) => {
    if (tag === "base") return true;
    if (tag !== "meta") return false;
    return has(p.charSet) || str(p.name) === "viewport" ||
      META_HTTP_EQUIV_KEYWORDS.includes(str(p.httpEquiv)?.toLowerCase() ?? "");
  }],
  [9, (tag) => tag === "title"],
  [8, (tag, p) => tag === "link" && str(p.rel) === "preconnect"],
  [7, (tag, p) => {
    const rel = str(p.rel)?.toLowerCase();
    return tag === "link" && (rel === "preload" || rel === "modulepreload");
  }],
  [6, (tag, p) => tag === "script" && has(p.src) && has(p.async)],
  [5, (tag, _, css) => tag === "style" && /@import/.test(css)],
  [4, (tag, p) => {
    if (tag !== "script") return false;
    const type = str(p.type) ?? "";
    return !((has(p.src) && (has(p.defer) || has(p.async) || type === "module")) || type.includes("json"));
  }],
  [3, (tag, p) => tag === "style" || (tag === "link" && str(p.rel) === "stylesheet")],
  [2, (tag, p) => {
    if (tag !== "script") return false;
    return (has(p.src) && has(p.defer)) ||
      (has(p.src) && str(p.type) === "module" && !has(p.async));
  }],
  [1, (tag, p) => {
    const rel = str(p.rel)?.toLowerCase();
    return tag === "link" && (rel === "prefetch" || rel === "dns-prefetch" || rel === "prerender");
  }],
];

export function getWeight(element: Element): number {
  const css = element.tagName === "style" && element.children.length > 0
    ? toHtml(element)
    : "";

  for (const [weight, detect] of RULES) {
    if (detect(element.tagName, element.properties, css)) return weight;
  }
  return 0;
}
