import type { RaptDevice, RaptTelemetry, TransportMode } from "../types";

export interface RaptTransport {
  readonly mode: TransportMode;
  discoverDevices(): Promise<RaptDevice[]>;
  getTelemetry(deviceId: string): Promise<RaptTelemetry>;
}

export class TransportUnavailableError extends Error {
  constructor(mode: TransportMode) {
    super(`The RAPT ${mode} protocol is not implemented yet.`);
    this.name = "TransportUnavailableError";
  }
}

export abstract class UnimplementedTransport implements RaptTransport {
  abstract readonly mode: TransportMode;

  async discoverDevices(): Promise<RaptDevice[]> {
    throw new TransportUnavailableError(this.mode);
  }

  async getTelemetry(_deviceId: string): Promise<RaptTelemetry> {
    throw new TransportUnavailableError(this.mode);
  }
}