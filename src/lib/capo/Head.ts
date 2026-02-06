import type { SSRResult } from "astro";
// @ts-expect-error using astro internals
import { renderAllHeadContent } from "astro/runtime/server/render/head.js";
// @ts-expect-error using astro internals
import {
  createComponent,
  unescapeHTML,
  renderSlotToString,
  spreadAttributes,
} from "astro/runtime/server/index.js";
import capo from "./index.ts";

interface RenderInstruction {
  type: string;
  content?: string;
}

interface SlotStringWithInstructions extends String {
  instructions?: RenderInstruction[];
}

export const Head = createComponent({
  factory: async (
    result: SSRResult,
    props: Record<string, any>,
    slots: Record<string, any>,
  ) => {
    const rendered: SlotStringWithInstructions = await renderSlotToString(
      result,
      slots.default,
    );

    let scriptContent = "";
    if (rendered.instructions) {
      for (const instruction of rendered.instructions) {
        if (instruction.type === "script" && instruction.content) {
          scriptContent += instruction.content;
        }
      }
    }

    let head = "";
    head += `<head${spreadAttributes(props)} data-capo>`;
    head += rendered.toString();
    head += scriptContent;
    head += renderAllHeadContent(result);
    head += "</head>";

    return unescapeHTML(capo(head));
  },
});
