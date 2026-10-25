# Homebridge RAPT

A TypeScript Homebridge dynamic-platform plugin scaffold for KegLand RAPT devices: Pill hydrometers, BrewZilla units, temperature controllers, and fermentation chambers.

## Status

The cloud transport authenticates against the RAPT API ([swagger](https://api.rapt.io/swagger/v1/swagger.json)) and reads devices and their current telemetry (read-only). Pills appear in HomeKit as temperature sensors with a battery level. BrewZillas, temperature controllers, and fermentation chambers appear as read-only thermostats. Readings are refreshed every `pollingInterval` seconds. The local transport is not implemented and reports an explicit error.

This API belongs to the legacy RAPT portal. KegLand is moving devices to the new RAPT Brew back end (brew.rapt.io), which has no published API yet. A device on new firmware (for example Pill firmware 2.0) may stay listed in the legacy API but stop sending it new readings.

## Development

Requires Node.js 18 or newer.

```sh
npm install
npm test
npm run lint
```

`npm run build` compiles the plugin to `dist/`.

## Homebridge configuration

Add the platform to the Homebridge configuration:

```json
{
  "platforms": [
    {
      "platform": "RAPT",
      "transport": "cloud",
      "username": "you@example.com",
      "apiSecret": "<RAPT API secret>",
      "pollingInterval": 300
    }
  ]
}
```

| Field | Description |
| --- | --- |
| `transport` | `cloud` (default) or `local`. Only `cloud` works today. |
| `username` | Email address of your RAPT account. |
| `apiSecret` | An API secret, **not** your account password. Create one in the RAPT portal under My Account → API Secrets. |
| `pollingInterval` | Seconds between telemetry reads (default 300, minimum 60). The RAPT API is rate limited. |

### Checking cloud access

To verify credentials and see what the API returns without running Homebridge:

```sh
RAPT_USERNAME=you@example.com RAPT_API_SECRET=... npm run smoke:cloud
```

## Project layout

- `src/platform.ts` registers the Homebridge dynamic platform and handles discovery errors.
- `src/devices.ts` and `src/types.ts` define the four device families and telemetry model.
- `src/transports/` contains the cloud/local adapter boundary.
- `test/` checks device coverage, transport selection, and the cloud client against a fake API.
- `scripts/cloud-smoke.ts` exercises the cloud transport against the real API.