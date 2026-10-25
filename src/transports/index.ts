import type { TransportMode } from "../types";
import { CloudRaptTransport } from "./cloud";
import { LocalRaptTransport } from "./local";
import type { RaptTransport } from "./transport";

export { CloudRaptTransport } from "./cloud";
export { LocalRaptTransport } from "./local";
export { TransportUnavailableError } from "./transport";
export type { RaptTransport } from "./transport";

export function createTransport(mode: TransportMode): RaptTransport {
  switch (mode) {
    case "cloud":
      return new CloudRaptTransport();
    case "local":
      return new LocalRaptTransport();
  }
}