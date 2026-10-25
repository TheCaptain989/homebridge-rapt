# Homebridge RAPT

A TypeScript Homebridge dynamic-platform plugin scaffold for KegLand RAPT devices: Pill hydrometers, BrewZilla units, temperature controllers, and fermentation chambers.

## Status

The cloud transport authenticates against the RAPT API ([swagger](https://api.rapt.io/swagger/v1/swagger.json)) and reads devices and their current telemetry (read-only). Pills appear in HomeKit as temperature sensors with a battery level. BrewZillas, temperature controllers, and fermentation chambers appear as read-only thermostats. Readings are refreshed every `pollingInterval` seconds.

> [!WARNING]
> **The local transport is not implemented yet.** Setting `"transport": "local"` connects to no devices and exposes no accessories. The plugin logs a "protocol is not implemented yet" error instead. Use `"transport": "cloud"`.

### Device compatibility

| Device | Supported firmware |
| --- | --- |
| RAPT Pill | **Older than 2.0.0 only** |
| BrewZilla, temperature controller, fermentation chamber | Firmware that still reports to the legacy RAPT portal |

> [!IMPORTANT]
> **RAPT Pill firmware 2.0.0 and later is not supported yet.** The plugin uses the API of the legacy RAPT portal. Pill firmware 2.0.0 moves the Pill to the new RAPT Brew back end (brew.rapt.io), which has no published API. An updated Pill still appears in HomeKit, but it keeps showing its last legacy reading and never updates. Support will be added when RAPT publishes an API for the new back end.
>
> Other RAPT devices are expected to move to the new back end through future firmware updates. They will be affected in the same way.

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
| `transport` | `cloud` (default) or `local`. **`local` is not implemented yet**, so use `cloud`. |
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