import type { ElementNode, Node } from "ultrahtml";
import { parse, walkSync, renderSync, ELEMENT_NODE } from "ultrahtml";
import { getWeight } from "./rules.ts";

export default function capo(html: string) {
  const ast = parse(html);
  try {
    walkSync(ast, (node, parent, index) => {
      if (node.type === ELEMENT_NODE && node.name === "head") {
        if (parent) {
          parent.children.splice(index, 1, getSortedHead(node));
          throw "done";
        }
      }
    });
  } catch (e) {
    if (e !== "done") throw e;
  }
  return renderSync(ast);
}

function getSortedHead(head: ElementNode): ElementNode {
  const elements: [number, Node][] = [];
  const nonElements: Node[] = [];

  for (const node of head.children) {
    if (node.type === ELEMENT_NODE) {
      elements.push([getWeight(node), node]);
    } else {
      nonElements.push(node);
    }
  }

  elements.sort((a, b) => b[0] - a[0]);
  const children: Node[] = elements.map(([_, el]) => el);
  children.push(...nonElements);

  return { ...head, children };
}
