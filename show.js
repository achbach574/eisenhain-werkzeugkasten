// Großanzeige auf dem Fernseher: Nachricht an alle, der Hintergrund öffnet das Overlay.
import OBR from "./vendor/obr-sdk.js?v=5";
import { ID } from "./core.js?v=5";

export const OV_CH = `${ID}/overlay`;
export const OV_MODAL = `${ID}/overlay-modal`;

export function showOverlay(data) {
  return OBR.broadcast.sendMessage(OV_CH, { show: data }, { destination: "ALL" });
}
export function hideOverlay() {
  return OBR.broadcast.sendMessage(OV_CH, { hide: true }, { destination: "ALL" });
}
