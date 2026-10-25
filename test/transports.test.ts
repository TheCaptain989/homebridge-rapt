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
  assert.ok(createTransport("cloud") instanceof CloudRaptTransport);
  assert.ok(createTransport("local") instanceof LocalRaptTransport);
});

test("cloud adapter fails clearly until its protocol is implemented", async () => {
  await assert.rejects(
    createTransport("cloud").discoverDevices(),
    TransportUnavailableError
  );
});

test("local adapter fails clearly until its protocol is implemented", async () => {
  await assert.rejects(
    createTransport("local").discoverDevices(),
    TransportUnavailableError
  );
});