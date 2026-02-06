import {
  createComponent,
  unescapeHTML,
  renderSlotToString,
  spreadAttributes,
} from "astro/runtime/server/index.js";
import { renderAllHeadContent } from "astro/runtime/server/render/head.js";
import capo from "./index.ts";

export const Head = createComponent({
  factory: (async (
    result: any,
    props: Record<string, any>,
    slots: Record<string, any>,
  ) => {
    const rendered: any = await renderSlotToString(result, slots.default);

    let scriptContent = "";
    for (const ins of rendered.instructions ?? []) {
      if (ins.type === "script" && ins.content) scriptContent += ins.content;
    }

    const head =
      `<head${spreadAttributes(props)} data-capo>` +
      rendered.toString() +
      scriptContent +
      renderAllHeadContent(result) +
      "</head>";

    return unescapeHTML(capo(head));
  }) as any,
});
