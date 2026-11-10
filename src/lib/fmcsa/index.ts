import { MockProvider } from "./mock";
import { QcMobileProvider } from "./qcmobile";
import type { FmcsaProvider } from "./types";

export function getProvider(): FmcsaProvider {
  if (process.env.FMCSA_PROVIDER === "mock") return new MockProvider();
  return new QcMobileProvider(process.env.FMCSA_WEB_KEY ?? "");
}

export type { CarrierSnapshot, FmcsaProvider } from "./types";
