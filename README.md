# Homebridge RAPT

A TypeScript Homebridge dynamic-platform plugin scaffold for KegLand RAPT devices: Pill hydrometers, BrewZilla units, temperature controllers, and fermentation chambers.

## Status

The plugin structure, configuration, device model, and cloud/local transport interfaces are in place. The RAPT cloud and local protocols are not implemented because a stable public protocol specification was not available during setup. The adapters report an explicit error instead of sending guessed requests. No accessories or readings are exposed until a verified transport is added.

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
      "transport": "cloud"
    }
  ]
}
```

Set `transport` to `cloud` or `local`. Both values currently select their corresponding adapter boundary, but neither can connect to devices until its protocol is implemented.

## Project layout

- `src/platform.ts` registers the Homebridge dynamic platform and handles discovery errors.
- `src/devices.ts` and `src/types.ts` define the four device families and telemetry model.
- `src/transports/` contains the cloud/local adapter boundary.
- `test/transports.test.ts` checks device coverage and transport behavior.

To complete device support, implement and test the official/local transport protocol in the corresponding adapter before publishing or installing this plugin for live use.