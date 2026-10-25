// Live check of the RAPT cloud transport against the real API.
// Usage: RAPT_USERNAME=... RAPT_API_SECRET=... npm run smoke:cloud
import { CloudRaptTransport } from "../src/transports";

async function main(): Promise<void> {
  const username = process.env.RAPT_USERNAME;
  const apiSecret = process.env.RAPT_API_SECRET;
  if (!username || !apiSecret) {
    throw new Error("Set RAPT_USERNAME and RAPT_API_SECRET in the environment.");
  }

  const transport = new CloudRaptTransport({ username, apiSecret });
  const devices = await transport.discoverDevices();
  console.log(`Discovered ${devices.length} device(s).`);

  for (const device of devices) {
    const telemetry = await transport.getTelemetry(device.id);
    console.log(`\n${device.kind}: ${device.name} (${device.id})`);
    console.log(JSON.stringify(telemetry, null, 2));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});