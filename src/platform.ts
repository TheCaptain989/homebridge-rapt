import type {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig
} from "homebridge";
import { createTransport } from "./transports";
import type { RaptTransport } from "./transports";
import type { RaptPlatformConfig } from "./types";

export class RaptPlatform implements DynamicPlatformPlugin {
  private readonly accessories = new Map<string, PlatformAccessory>();
  private readonly transport: RaptTransport;

  constructor(
    private readonly log: Logger,
    config: PlatformConfig,
    api: API
  ) {
    this.transport = createTransport((config as RaptPlatformConfig).transport);

    api.on("didFinishLaunching", () => {
      void this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.accessories.set(accessory.UUID, accessory);
  }

  private async discoverDevices(): Promise<void> {
    try {
      await this.transport.discoverDevices();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error(`RAPT ${this.transport.mode} discovery failed: ${message}`);
    }
  }
}