export const slotsPerTray = 8;
export const serviceExtension = 1.4;
export function acceleratorSlot(index: number) {
  const slot = index % slotsPerTray;
  return {
    x: slot % 2 ? .39 : -.39,
    z: .43 - Math.floor(slot / 2) * .30,
    trayY: 1.28 - Math.floor(index / slotsPerTray) * .62,
  };
}
