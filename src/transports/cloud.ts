import { SUPPORTED_DEVICE_KINDS } from "../devices";
import type { RaptDeviceKind } from "../devices";
import type { RaptDevice, RaptTelemetry } from "../types";
import type { RaptTransport } from "./transport";

// Contract: https://api.rapt.io/swagger/v1/swagger.json (bearer JWT). The token
// request is the RAPT portal "API Secrets" password grant used by existing clients.
export const RAPT_TOKEN_URL = "https://id.rapt.io/connect/token";
export const RAPT_API_URL = "https://api.rapt.io/api";

const TOKEN_REFRESH_MARGIN_MS = 60_000;
const DEFAULT_TOKEN_LIFETIME_S = 300;

const ENDPOINTS: Record<RaptDeviceKind, { list: string; get: string; idParam: string }> = {
  pill: {
    list: "Hydrometers/GetHydrometers",
    get: "Hydrometers/GetHydrometer",
    idParam: "hydrometerId"
  },
  brewzilla: {
    list: "BrewZillas/GetBrewZillas",
    get: "BrewZillas/GetBrewZilla",
    idParam: "brewZillaId"
  },
  "temperature-controller": {
    list: "TemperatureControllers/GetTemperatureControllers",
    get: "TemperatureControllers/GetTemperatureController",
    idParam: "temperatureControllerId"
  },
  "fermentation-chamber": {
    list: "FermentationChambers/GetFermentationChambers",
    get: "FermentationChambers/GetFermentationChamber",
    idParam: "fermentationChamberId"
  }
};

// The subset of the swagger device models that this plugin reads.
interface CloudDeviceModel {
  id: string;
  name: string;
  deleted?: boolean;
  lastActivityTime?: string | null;
  tempUnit?: string | null;
  temperature?: number | null;
  targetTemperature?: number | null;
  gravity?: number | null;
  battery?: number | null;
  heatingEnabled?: boolean;
  coolingEnabled?: boolean;
}

export interface RaptCloudCredentials {
  username?: string;
  apiSecret?: string;
}

export class RaptApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "RaptApiError";
  }
}

export class CloudRaptTransport implements RaptTransport {
  readonly mode = "cloud" as const;
  private token?: { value: string; expiresAt: number };
  private readonly kinds = new Map<string, RaptDeviceKind>();
  // Temperatures are reported in the account's display unit. Controllers include
  // tempUnit but hydrometers do not, so hydrometers borrow the unit seen elsewhere.
  private accountTempUnit?: string;

  constructor(
    private readonly credentials: RaptCloudCredentials,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now
  ) {}

  async discoverDevices(): Promise<RaptDevice[]> {
    const devices: RaptDevice[] = [];
    // Sequential requests keep us gentle on the API rate limit.
    for (const kind of SUPPORTED_DEVICE_KINDS) {
      const models = await this.get<CloudDeviceModel[]>(ENDPOINTS[kind].list);
      for (const model of models) {
        if (model.deleted) {
          continue;
        }
        this.kinds.set(model.id, kind);
        this.accountTempUnit ??= model.tempUnit ?? undefined;
        devices.push({ id: model.id, name: model.name, kind });
      }
    }
    return devices;
  }

  async getTelemetry(deviceId: string): Promise<RaptTelemetry> {
    const kind = this.kinds.get(deviceId);
    if (!kind) {
      throw new RaptApiError(`Unknown RAPT device ${deviceId}; run discovery first.`);
    }
    const { get, idParam } = ENDPOINTS[kind];
    const model = await this.get<CloudDeviceModel>(get, { [idParam]: deviceId });
    const unit = model.tempUnit ?? this.accountTempUnit;
    return {
      temperatureC: toCelsius(model.temperature, unit),
      targetTemperatureC: toCelsius(model.targetTemperature, unit),
      specificGravity: toSpecificGravity(model.gravity),
      batteryPercent: finite(model.battery),
      heatingEnabled: model.heatingEnabled,
      coolingEnabled: model.coolingEnabled,
      displayUnit: unit ? (unit.toUpperCase() === "F" ? "F" : "C") : undefined,
      observedAt: model.lastActivityTime ?? undefined
    };
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.now() < this.token.expiresAt) {
      return this.token.value;
    }
    const { username, apiSecret } = this.credentials;
    if (!username || !apiSecret) {
      throw new RaptApiError("RAPT cloud transport requires username and apiSecret in the platform config.");
    }
    const response = await this.fetchImpl(RAPT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: "rapt-user",
        grant_type: "password",
        username,
        password: apiSecret
      })
    });
    if (!response.ok) {
      throw new RaptApiError(
        `RAPT authentication failed (HTTP ${response.status}). Check username and apiSecret.`,
        response.status
      );
    }
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) {
      throw new RaptApiError("RAPT authentication response did not include an access token.");
    }
    const lifetimeMs = (body.expires_in ?? DEFAULT_TOKEN_LIFETIME_S) * 1000;
    this.token = {
      value: body.access_token,
      expiresAt: this.now() + Math.max(lifetimeMs - TOKEN_REFRESH_MARGIN_MS, 0)
    };
    return body.access_token;
  }

  private async get<T>(path: string, query: Record<string, string> = {}, retry = true): Promise<T> {
    const url = new URL(`${RAPT_API_URL}/${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    const response = await this.fetchImpl(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${await this.accessToken()}`
      }
    });
    if (response.status === 401 && retry) {
      this.token = undefined;
      return this.get<T>(path, query, false);
    }
    if (!response.ok) {
      throw new RaptApiError(`RAPT API ${path} failed (HTTP ${response.status}).`, response.status);
    }
    return (await response.json()) as T;
  }
}

function finite(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toCelsius(value: number | null | undefined, unit: string | undefined): number | undefined {
  const temperature = finite(value);
  if (temperature === undefined || unit?.toUpperCase() !== "F") {
    return temperature;
  }
  return Math.round(((temperature - 32) * 5 / 9) * 100) / 100;
}

// The API reports gravity in points (SG × 1000), e.g. 1012.5 for SG 1.0125.
function toSpecificGravity(value: number | null | undefined): number | undefined {
  const gravity = finite(value);
  return gravity === undefined || gravity <= 0 ? undefined : gravity / 1000;
}