import OBR from "./vendor/obr-sdk.js?v=3";
import { ID, WOUNDS_KEY } from "./core.js?v=3";
import { healWound } from "./actions.js?v=3";

const here = (p) => new URL(p, window.location.href).href;

OBR.onReady(() => {
  OBR.contextMenu.create({
    id: `${ID}/menue`,
    icons: [{
      icon: here("icons/wunde.svg"),
      label: "Wunden",
      filter: {
        roles: ["GM"],
        max: 1,
        every: [
          { key: "type", value: "IMAGE" },
          { key: "layer", value: "CHARACTER" },
        ],
      },
    }],
    onClick(context, elementId) {
      const id = context.items[0].id;
      OBR.popover.open({
        id: `${ID}/popover`,
        url: here(`wunden.html?id=${encodeURIComponent(id)}`),
        width: 400,
        height: 600,
        anchorElementId: elementId,
      });
    },
  });

  OBR.contextMenu.create({
    id: `${ID}/heilen`,
    icons: [{
      icon: here("icons/heilen.svg"),
      label: "Eine Wunde heilen",
      filter: {
        roles: ["GM"],
        every: [
          { key: "layer", value: "CHARACTER" },
          { key: ["metadata", WOUNDS_KEY], value: undefined, operator: "!=" },
        ],
      },
    }],
    onClick(context) {
      healWound(context.items.map((i) => i.id));
    },
  });
});
