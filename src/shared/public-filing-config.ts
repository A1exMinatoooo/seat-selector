import { z } from "zod";

export const publicFilingConfigSchema = z.object({
  icpFilingNumber: z.string().min(1).nullable(),
  publicSecurityFilingNumber: z.string().min(1).nullable(),
  publicSecurityFilingUrl: z.string().url().nullable(),
});

export type PublicFilingConfig = z.infer<typeof publicFilingConfigSchema>;

export function publicFilingConfigFromEnv(values: {
  ICP_FILING_NUMBER?: string;
  PUBLIC_SECURITY_FILING_NUMBER?: string;
  PUBLIC_SECURITY_FILING_URL?: string;
}): PublicFilingConfig {
  return {
    icpFilingNumber: values.ICP_FILING_NUMBER?.trim() || null,
    publicSecurityFilingNumber: values.PUBLIC_SECURITY_FILING_NUMBER?.trim() || null,
    publicSecurityFilingUrl: values.PUBLIC_SECURITY_FILING_URL?.trim() || null,
  };
}
