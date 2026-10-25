import { UnimplementedTransport } from "./transport";

export class CloudRaptTransport extends UnimplementedTransport {
  readonly mode = "cloud" as const;
}