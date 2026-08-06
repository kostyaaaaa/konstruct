import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // TypeScript 7 dropped the compiler API Next.js used; the TS CLI path is
    // how Next supports it. Remove once Next reads TS 7 natively.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
