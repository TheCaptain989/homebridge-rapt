import { UnimplementedTransport } from "./transport";

export class LocalRaptTransport extends UnimplementedTransport {
  readonly mode = "local" as const;
}