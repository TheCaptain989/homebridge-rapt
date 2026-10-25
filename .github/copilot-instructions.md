# RAPT Homebridge Plugin

## Setup status

- [x] Workspace instructions created.
- [x] Requirements clarified: TypeScript dynamic platform for RAPT Pill, BrewZilla, temperature controllers, and fermentation chambers, with cloud and local transport options.
- [x] Plugin scaffold, device types, configuration schema, and README added.
- [x] Cloud and local adapter boundaries added without inventing undocumented protocol details.
- [x] No additional VS Code extensions or workspace task are required.
- [x] Plugin was not launched; live operation is unavailable until a transport protocol is implemented.
- [ ] Build and tests are not verified because `npm` is unavailable in the current terminal. Run `npm install`, `npm test`, and `npm run lint` when Node.js/npm are available.
- [x] README and workspace instructions are current.

## Development guidance

- Keep cloud and local protocol implementations separate under `src/transports/`.
- Do not add endpoints, authentication schemes, or payload assumptions without a reliable protocol reference and tests.
- Normalize verified device readings through `src/types.ts` before mapping them to HomeKit services.
- Keep the supported device-family list in `src/devices.ts` aligned with tests and documentation.
- Validate changes with `npm test`, `npm run lint`, and `npm run build`.
