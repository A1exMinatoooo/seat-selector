import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  ...(process.env.LOCAL_TEST_LAN_IP ? { allowedDevOrigins: [process.env.LOCAL_TEST_LAN_IP] } : {}),
};

export default nextConfig;
