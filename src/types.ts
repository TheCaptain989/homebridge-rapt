import type { RaptDeviceKind } from "./devices";

export type TransportMode = "cloud" | "local";

export interface RaptPlatformConfig {
  platform: string;
  transport?: TransportMode;
  username?: string;
  apiSecret?: string;
  pollingInterval?: number;
}

export interface RaptDevice {
  id: string;
  name: string;
  kind: RaptDeviceKind;
}

export interface RaptTelemetry {
  temperatureC?: number;
  targetTemperatureC?: number;
  specificGravity?: number;
  humidityPercent?: number;
  batteryPercent?: number;
  heatingEnabled?: boolean;
  coolingEnabled?: boolean;
  displayUnit?: "C" | "F";
  observedAt?: string;
}