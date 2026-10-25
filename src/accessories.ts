import type { API, PlatformAccessory, Service } from "homebridge";
import type { RaptDeviceKind } from "./devices";
import type { RaptDevice, RaptTelemetry } from "./types";

const MODEL_NAMES: Record<RaptDeviceKind, string> = {
  pill: "RAPT Pill",
  brewzilla: "RAPT BrewZilla",
  "temperature-controller": "RAPT Temperature Controller",
  "fermentation-chamber": "RAPT Fermentation Chamber"
};

const LOW_BATTERY_PERCENT = 20;

// Set points for fridges and kettles fall outside HomeKit's default 10–38 °C range.
const TARGET_MIN_C = -20;
const TARGET_MAX_C = 100;

export type ThermostatMode = "off" | "heat" | "cool" | "auto";

export function targetMode({ heatingEnabled, coolingEnabled }: RaptTelemetry): ThermostatMode {
  if (heatingEnabled && coolingEnabled) {
    return "auto";
  }
  if (heatingEnabled) {
    return "heat";
  }
  return coolingEnabled ? "cool" : "off";
}

// The API reports which modes are enabled, not whether the relay is running,
// so infer activity from which side of the set point the temperature is on.
export function currentMode(telemetry: RaptTelemetry): Exclude<ThermostatMode, "auto"> {
  const { temperatureC, targetTemperatureC, heatingEnabled, coolingEnabled } = telemetry;
  if (temperatureC === undefined || targetTemperatureC === undefined) {
    return "off";
  }
  if (coolingEnabled && temperatureC > targetTemperatureC) {
    return "cool";
  }
  if (heatingEnabled && temperatureC < targetTemperatureC) {
    return "heat";
  }
  return "off";
}

export class RaptAccessory {
  private readonly primary: Service;
  private readonly battery?: Service;

  constructor(
    private readonly api: API,
    readonly accessory: PlatformAccessory,
    readonly device: RaptDevice
  ) {
    const { Characteristic, Perms, Service } = api.hap;

    accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, "KegLand")
      .setCharacteristic(Characteristic.Model, MODEL_NAMES[device.kind])
      .setCharacteristic(Characteristic.SerialNumber, device.id);

    if (device.kind === "pill") {
      this.primary = accessory.getService(Service.TemperatureSensor)
        ?? accessory.addService(Service.TemperatureSensor, device.name);
      this.battery = accessory.getService(Service.Battery) ?? accessory.addService(Service.Battery);
      return;
    }

    // Read-only until device control is implemented.
    const readOnly = { perms: [Perms.PAIRED_READ, Perms.NOTIFY] };
    this.primary = accessory.getService(Service.Thermostat) ?? accessory.addService(Service.Thermostat, device.name);
    this.primary.getCharacteristic(Characteristic.TargetTemperature)
      .setProps({ ...readOnly, minValue: TARGET_MIN_C, maxValue: TARGET_MAX_C });
    this.primary.getCharacteristic(Characteristic.TargetHeatingCoolingState).setProps(readOnly);
    this.primary.getCharacteristic(Characteristic.TemperatureDisplayUnits).setProps(readOnly);
  }

  update(telemetry: RaptTelemetry): void {
    const { Characteristic } = this.api.hap;

    if (telemetry.temperatureC !== undefined) {
      this.primary.updateCharacteristic(Characteristic.CurrentTemperature, telemetry.temperatureC);
    }

    if (this.battery && telemetry.batteryPercent !== undefined) {
      const level = Math.min(Math.max(Math.round(telemetry.batteryPercent), 0), 100);
      this.battery.updateCharacteristic(Characteristic.BatteryLevel, level);
      this.battery.updateCharacteristic(
        Characteristic.StatusLowBattery,
        level < LOW_BATTERY_PERCENT
          ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
          : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
      );
    }

    if (this.device.kind === "pill") {
      return;
    }

    if (telemetry.targetTemperatureC !== undefined) {
      const target = Math.min(Math.max(telemetry.targetTemperatureC, TARGET_MIN_C), TARGET_MAX_C);
      this.primary.updateCharacteristic(Characteristic.TargetTemperature, target);
    }

    const target = Characteristic.TargetHeatingCoolingState;
    this.primary.updateCharacteristic(target, {
      off: target.OFF,
      heat: target.HEAT,
      cool: target.COOL,
      auto: target.AUTO
    }[targetMode(telemetry)]);

    const current = Characteristic.CurrentHeatingCoolingState;
    this.primary.updateCharacteristic(current, {
      off: current.OFF,
      heat: current.HEAT,
      cool: current.COOL
    }[currentMode(telemetry)]);

    if (telemetry.displayUnit) {
      const units = Characteristic.TemperatureDisplayUnits;
      this.primary.updateCharacteristic(
        units,
        telemetry.displayUnit === "F" ? units.FAHRENHEIT : units.CELSIUS
      );
    }
  }
}