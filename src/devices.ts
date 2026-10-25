export const SUPPORTED_DEVICE_KINDS = [
  "pill",
  "brewzilla",
  "temperature-controller",
  "fermentation-chamber"
] as const;

export type RaptDeviceKind = typeof SUPPORTED_DEVICE_KINDS[number];