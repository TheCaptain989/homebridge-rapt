import assert from "node:assert/strict";
import { test } from "node:test";
import { currentMode, homeKitName, targetMode } from "../src/accessories";

test("device names are made valid for HomeKit", () => {
  assert.equal(homeKitName("Pill (Orange)"), "Pill Orange");
  assert.equal(homeKitName("Beer Fridge"), "Beer Fridge");
  assert.equal(homeKitName("Brewer's #1 Fermenter!"), "Brewer's 1 Fermenter");
  assert.equal(homeKitName("🍺"), "RAPT Device");
});

test("thermostat target mode reflects which modes are enabled", () => {
  assert.equal(targetMode({ heatingEnabled: true, coolingEnabled: true }), "auto");
  assert.equal(targetMode({ heatingEnabled: true, coolingEnabled: false }), "heat");
  assert.equal(targetMode({ heatingEnabled: false, coolingEnabled: true }), "cool");
  assert.equal(targetMode({}), "off");
});

test("thermostat current mode follows the side of the set point", () => {
  const fridge = { coolingEnabled: true, heatingEnabled: false, targetTemperatureC: 3.3 };
  assert.equal(currentMode({ ...fridge, temperatureC: 4.41 }), "cool");
  assert.equal(currentMode({ ...fridge, temperatureC: 2 }), "off");

  const kettle = { coolingEnabled: false, heatingEnabled: true, targetTemperatureC: 66 };
  assert.equal(currentMode({ ...kettle, temperatureC: 40 }), "heat");
  assert.equal(currentMode({ ...kettle, temperatureC: 70 }), "off");
});

test("thermostat current mode is off without a reading or set point", () => {
  assert.equal(currentMode({ coolingEnabled: true, temperatureC: 10 }), "off");
  assert.equal(currentMode({ heatingEnabled: true, targetTemperatureC: 10 }), "off");
});