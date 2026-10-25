import type {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig
} from "homebridge";
import { homeKitName, RaptAccessory } from "./accessories";
import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";
import { createTransport } from "./transports";
import type { RaptTransport } from "./transports";
import type { RaptPlatformConfig } from "./types";

const DEFAULT_POLLING_INTERVAL_S = 300;
const MIN_POLLING_INTERVAL_S = 60;

export class RaptPlatform implements DynamicPlatformPlugin {
  private readonly cachedAccessories = new Map<string, PlatformAccessory>();
  private readonly devices = new Map<string, RaptAccessory>();
  private readonly transport: RaptTransport;
  private readonly pollingIntervalMs: number;
  private discovered = false;
  private polling = false;

  constructor(
    private readonly log: Logger,
    config: PlatformConfig,
    private readonly api: API
  ) {
    const raptConfig = config as RaptPlatformConfig;
    this.transport = createTransport(raptConfig);
    this.pollingIntervalMs = Math.max(
      raptConfig.pollingInterval ?? DEFAULT_POLLING_INTERVAL_S,
      MIN_POLLING_INTERVAL_S
    ) * 1000;

    api.on("didFinishLaunching", () => {
      void this.poll();
      const timer = setInterval(() => void this.poll(), this.pollingIntervalMs);
      api.on("shutdown", () => clearInterval(timer));
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.cachedAccessories.set(accessory.UUID, accessory);
  }

  private async poll(): Promise<void> {
    if (this.polling) {
      return;
    }
    this.polling = true;
    try {
      // Discovery is retried on each poll until it succeeds once.
      if (!this.discovered) {
        await this.discoverDevices();
      }
      for (const device of this.devices.values()) {
        try {
          device.update(await this.transport.getTelemetry(device.device.id));
        } catch (error) {
          this.log.warn(`RAPT telemetry for ${device.device.name} failed: ${errorMessage(error)}`);
        }
      }
    } catch (error) {
      this.log.error(`RAPT ${this.transport.mode} discovery failed: ${errorMessage(error)}`);
    } finally {
      this.polling = false;
    }
  }

  private async discoverDevices(): Promise<void> {
    const devices = await this.transport.discoverDevices();
    this.log.info(`RAPT ${this.transport.mode} discovered ${devices.length} device(s).`);

    const discovered = new Set<string>();
    const restored: PlatformAccessory[] = [];
    for (const device of devices) {
      const uuid = this.api.hap.uuid.generate(`${PLUGIN_NAME}:${device.id}`);
      discovered.add(uuid);

      const cached = this.cachedAccessories.get(uuid);
      const accessory = cached ?? new this.api.platformAccessory(homeKitName(device.name), uuid);
      this.devices.set(device.id, new RaptAccessory(this.api, accessory, device));

      if (cached) {
        restored.push(cached);
      } else {
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.cachedAccessories.set(uuid, accessory);
        this.log.info(`Added ${device.kind}: ${device.name} (${device.id})`);
      }
    }
    // Persist names and services refreshed on accessories restored from the cache.
    if (restored.length > 0) {
      this.api.updatePlatformAccessories(restored);
    }

    const removed = [...this.cachedAccessories.values()].filter((accessory) => !discovered.has(accessory.UUID));
    if (removed.length > 0) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, removed);
      for (const accessory of removed) {
        this.cachedAccessories.delete(accessory.UUID);
        this.log.info(`Removed ${accessory.displayName}; it is no longer in the RAPT account.`);
      }
    }

    this.discovered = true;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}