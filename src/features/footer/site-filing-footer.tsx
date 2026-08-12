"use client";

import { useEffect, useState } from "react";
import { publicFilingConfigSchema, type PublicFilingConfig } from "@/shared/public-filing-config";

export function FilingFooterContent({ config }: { config: PublicFilingConfig }) {
  if (!config.icpFilingNumber && !config.publicSecurityFilingNumber) return null;

  return (
    <footer className="site-filing-footer" aria-label="网站备案信息">
      {config.icpFilingNumber ? (
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
          {config.icpFilingNumber}
        </a>
      ) : null}
      {config.publicSecurityFilingNumber ? (
        config.publicSecurityFilingUrl ? (
          <a href={config.publicSecurityFilingUrl} target="_blank" rel="noopener noreferrer">
            {config.publicSecurityFilingNumber}
          </a>
        ) : (
          <span>{config.publicSecurityFilingNumber}</span>
        )
      ) : null}
    </footer>
  );
}

export function SiteFilingFooter() {
  const [config, setConfig] = useState<PublicFilingConfig | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/public-config", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Public config request failed");
        return response.json();
      })
      .then((value: unknown) => setConfig(publicFilingConfigSchema.parse(value)))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return config ? <FilingFooterContent config={config} /> : null;
}
