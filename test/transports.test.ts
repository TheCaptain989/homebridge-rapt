import assert from "node:assert/strict";
import { test } from "node:test";
import { SUPPORTED_DEVICE_KINDS } from "../src/devices";
import {
  CloudRaptTransport,
  createTransport,
  LocalRaptTransport,
  TransportUnavailableError
} from "../src/transports";

test("all agreed RAPT device families are represented", () => {
  assert.deepEqual(SUPPORTED_DEVICE_KINDS, [
    "pill",
    "brewzilla",
    "temperature-controller",
    "fermentation-chamber"
  ]);
});

test("transport selection creates the requested adapter", () => {
  assert.ok(createTransport({ platform: "RAPT", transport: "cloud" }) instanceof CloudRaptTransport);
  assert.ok(createTransport({ platform: "RAPT", transport: "local" }) instanceof LocalRaptTransport);
});

test("transport defaults to cloud when not configured", () => {
  assert.ok(createTransport({ platform: "RAPT" }) instanceof CloudRaptTransport);
});

test("local adapter fails clearly until its protocol is implemented", async () => {
  await assert.rejects(
    createTransport({ platform: "RAPT", transport: "local" }).discoverDevices(),
    TransportUnavailableError
  );
});