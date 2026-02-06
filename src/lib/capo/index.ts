import type { RootContent } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { getWeight } from "./rules.ts";

const HEAD_OPEN_RE = /^<head[^>]*>/;

export default function capo(html: string): string {
  const openMatch = html.match(HEAD_OPEN_RE);
  if (!openMatch) return html;

  const openTag = openMatch[0];
  const inner = html.slice(openTag.length, html.lastIndexOf("</head>"));

  const tree = fromHtml(inner, { fragment: true });

  const weighted: [number, RootContent][] = [];
  const rest: RootContent[] = [];

  for (const node of tree.children) {
    if (node.type === "element") {
      weighted.push([getWeight(node), node]);
    } else {
      rest.push(node);
    }
  }

  weighted.sort((a, b) => b[0] - a[0]);
  tree.children = [...weighted.map(([, node]) => node), ...rest];

  return openTag + toHtml(tree) + "</head>";
}
