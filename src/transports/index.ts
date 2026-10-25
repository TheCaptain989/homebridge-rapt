import type { RaptPlatformConfig } from "../types";
import { CloudRaptTransport } from "./cloud";
import { LocalRaptTransport } from "./local";
import type { RaptTransport } from "./transport";

export { CloudRaptTransport, RaptApiError } from "./cloud";
export { LocalRaptTransport } from "./local";
export { TransportUnavailableError } from "./transport";
export type { RaptTransport } from "./transport";

export function createTransport(config: RaptPlatformConfig): RaptTransport {
  switch (config.transport ?? "cloud") {
    case "cloud":
      return new CloudRaptTransport({ username: config.username, apiSecret: config.apiSecret });
    case "local":
      return new LocalRaptTransport();
  }
}