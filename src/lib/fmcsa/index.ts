import { MockProvider } from "./mock";
import { QcMobileProvider } from "./qcmobile";
import { MotusInsuranceSource } from "./motus";
import type { FmcsaProvider } from "./types";

export function getProvider(): FmcsaProvider {
  if (process.env.FMCSA_PROVIDER === "mock") return new MockProvider();
  // Policy filings are off unless INSURANCE_SOURCE=motus. The column mapping must be checked first (see README).
  const insurance =
    process.env.INSURANCE_SOURCE === "motus"
      ? new MotusInsuranceSource({
          datasetId: process.env.MOTUS_INSUR_DATASET || undefined,
          appToken: process.env.SOCRATA_APP_TOKEN || undefined,
        })
      : null;
  return new QcMobileProvider(process.env.FMCSA_WEB_KEY ?? "", fetch, insurance);
}

export type { CarrierSnapshot, FmcsaProvider } from "./types";
