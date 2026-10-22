const int = (v: string | undefined, d: number): number => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : d;
};

const safeHttpUrl = (v: string | undefined): string => {
  if (!v) return "";
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
};

export const config = {
  port: int(process.env.PORT, 8080),
  brandName: process.env.BRAND_NAME || "PulseReach",
  homeUrl: safeHttpUrl(process.env.HOME_URL),
  tokenTtlMinutes: int(process.env.TOKEN_TTL_MINUTES, 30),
  trustProxyHops: int(process.env.TRUST_PROXY_HOPS, 1),
  autoMigrate: process.env.AUTO_MIGRATE !== "false",
};
