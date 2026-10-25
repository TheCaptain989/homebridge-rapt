import assert from "node:assert/strict";
import { test } from "node:test";
import { CloudRaptTransport, RaptApiError } from "../src/transports";
import { RAPT_API_URL, RAPT_TOKEN_URL } from "../src/transports/cloud";

interface RecordedRequest {
  url: string;
  init?: RequestInit;
}

type Route = (request: RecordedRequest) => Response;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function fakeFetch(routes: Record<string, Route>) {
  const requests: RecordedRequest[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    const request = { url, init };
    requests.push(request);
    const route = routes[url.split("?")[0]];
    if (!route) {
      return json({ message: "not found" }, 404);
    }
    return route(request);
  }) as typeof fetch;
  return { impl, requests };
}

const token: Route = () => json({ access_token: "jwt-1", expires_in: 3600 });
const empty: Route = () => json([]);

const credentials = { username: "brewer@example.com", apiSecret: "s3cret" };

function listRoutes(overrides: Record<string, Route> = {}): Record<string, Route> {
  return {
    [RAPT_TOKEN_URL]: token,
    [`${RAPT_API_URL}/Hydrometers/GetHydrometers`]: empty,
    [`${RAPT_API_URL}/BrewZillas/GetBrewZillas`]: empty,
    [`${RAPT_API_URL}/TemperatureControllers/GetTemperatureControllers`]: empty,
    [`${RAPT_API_URL}/FermentationChambers/GetFermentationChambers`]: empty,
    ...overrides
  };
}

test("cloud adapter requires credentials before calling the API", async () => {
  const { impl, requests } = fakeFetch({});
  await assert.rejects(
    new CloudRaptTransport({}, impl).discoverDevices(),
    (error: unknown) => error instanceof RaptApiError && /username and apiSecret/.test(error.message)
  );
  assert.equal(requests.length, 0);
});

test("cloud adapter authenticates with the API secret password grant", async () => {
  const { impl, requests } = fakeFetch(listRoutes());
  await new CloudRaptTransport(credentials, impl).discoverDevices();

  const [tokenRequest] = requests;
  assert.equal(tokenRequest.url, RAPT_TOKEN_URL);
  assert.equal(tokenRequest.init?.method, "POST");
  const form = new URLSearchParams(String(tokenRequest.init?.body));
  assert.equal(form.get("grant_type"), "password");
  assert.equal(form.get("client_id"), "rapt-user");
  assert.equal(form.get("username"), "brewer@example.com");
  assert.equal(form.get("password"), "s3cret");

  for (const request of requests.slice(1)) {
    assert.equal(new Headers(request.init?.headers).get("Authorization"), "Bearer jwt-1");
  }
});

test("cloud adapter discovers every device family and skips deleted devices", async () => {
  const { impl } = fakeFetch(listRoutes({
    [`${RAPT_API_URL}/Hydrometers/GetHydrometers`]: () => json([
      { id: "p1", name: "Pill" },
      { id: "p2", name: "Old Pill", deleted: true }
    ]),
    [`${RAPT_API_URL}/BrewZillas/GetBrewZillas`]: () => json([{ id: "b1", name: "BrewZilla" }]),
    [`${RAPT_API_URL}/TemperatureControllers/GetTemperatureControllers`]: () => json([{ id: "t1", name: "Fridge" }])
  }));

  const devices = await new CloudRaptTransport(credentials, impl).discoverDevices();

  assert.deepEqual(devices, [
    { id: "p1", name: "Pill", kind: "pill" },
    { id: "b1", name: "BrewZilla", kind: "brewzilla" },
    { id: "t1", name: "Fridge", kind: "temperature-controller" }
  ]);
});

test("cloud adapter reads telemetry from the device-specific endpoint", async () => {
  const { impl, requests } = fakeFetch(listRoutes({
    [`${RAPT_API_URL}/Hydrometers/GetHydrometers`]: () => json([{ id: "p1", name: "Pill" }]),
    [`${RAPT_API_URL}/Hydrometers/GetHydrometer`]: () => json({
      id: "p1",
      name: "Pill",
      temperature: 19.5,
      targetTemperature: null,
      gravity: 1012.5,
      battery: 87,
      lastActivityTime: "2026-10-25T20:00:00Z"
    })
  }));
  const transport = new CloudRaptTransport(credentials, impl);
  await transport.discoverDevices();

  const telemetry = await transport.getTelemetry("p1");

  assert.equal(new URL(requests.at(-1)!.url).searchParams.get("hydrometerId"), "p1");
  assert.deepEqual(telemetry, {
    temperatureC: 19.5,
    targetTemperatureC: undefined,
    specificGravity: 1.0125,
    batteryPercent: 87,
    heatingEnabled: undefined,
    coolingEnabled: undefined,
    displayUnit: undefined,
    observedAt: "2026-10-25T20:00:00Z"
  });
});

// Shapes below mirror live API responses: controllers carry tempUnit, hydrometers do not.
test("cloud adapter converts Fahrenheit using the device tempUnit", async () => {
  const { impl } = fakeFetch(listRoutes({
    [`${RAPT_API_URL}/TemperatureControllers/GetTemperatureControllers`]: () =>
      json([{ id: "t1", name: "Beer Fridge", tempUnit: "F" }]),
    [`${RAPT_API_URL}/TemperatureControllers/GetTemperatureController`]: () =>
      json({ id: "t1", name: "Beer Fridge", tempUnit: "F", temperature: 39.94, targetTemperature: 37.94 })
  }));
  const transport = new CloudRaptTransport(credentials, impl);
  await transport.discoverDevices();

  const telemetry = await transport.getTelemetry("t1");
  assert.equal(telemetry.temperatureC, 4.41);
  assert.equal(telemetry.targetTemperatureC, 3.3);
});

test("hydrometers use the account temperature unit seen on other devices", async () => {
  const { impl } = fakeFetch(listRoutes({
    [`${RAPT_API_URL}/Hydrometers/GetHydrometers`]: () => json([{ id: "p1", name: "Pill" }]),
    [`${RAPT_API_URL}/Hydrometers/GetHydrometer`]: () => json({ id: "p1", name: "Pill", temperature: 68 }),
    [`${RAPT_API_URL}/BrewZillas/GetBrewZillas`]: () => json([{ id: "b1", name: "BrewZilla", tempUnit: "F" }])
  }));
  const transport = new CloudRaptTransport(credentials, impl);
  await transport.discoverDevices();

  assert.equal((await transport.getTelemetry("p1")).temperatureC, 20);
});

test("cloud adapter rejects telemetry for undiscovered devices", async () => {
  const { impl } = fakeFetch(listRoutes());
  await assert.rejects(new CloudRaptTransport(credentials, impl).getTelemetry("nope"), RaptApiError);
});

test("cloud adapter reuses its token until it nears expiry", async () => {
  let now = 0;
  let issued = 0;
  const { impl } = fakeFetch(listRoutes({
    [RAPT_TOKEN_URL]: () => json({ access_token: `jwt-${++issued}`, expires_in: 3600 })
  }));
  const transport = new CloudRaptTransport(credentials, impl, () => now);

  await transport.discoverDevices();
  await transport.discoverDevices();
  assert.equal(issued, 1);

  now = 3600 * 1000;
  await transport.discoverDevices();
  assert.equal(issued, 2);
});

test("cloud adapter refreshes its token once after a 401", async () => {
  let issued = 0;
  let rejected = false;
  const { impl } = fakeFetch(listRoutes({
    [RAPT_TOKEN_URL]: () => json({ access_token: `jwt-${++issued}`, expires_in: 3600 }),
    [`${RAPT_API_URL}/Hydrometers/GetHydrometers`]: () => {
      if (!rejected) {
        rejected = true;
        return json({}, 401);
      }
      return json([]);
    }
  }));

  await new CloudRaptTransport(credentials, impl).discoverDevices();
  assert.equal(issued, 2);
});

test("cloud adapter reports authentication failures without leaking the secret", async () => {
  const { impl } = fakeFetch({ [RAPT_TOKEN_URL]: () => json({ error: "invalid_grant" }, 400) });
  await assert.rejects(
    new CloudRaptTransport(credentials, impl).discoverDevices(),
    (error: unknown) =>
      error instanceof RaptApiError &&
      error.status === 400 &&
      !error.message.includes(credentials.apiSecret)
  );
});