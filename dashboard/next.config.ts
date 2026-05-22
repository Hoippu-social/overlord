import type { NextConfig } from "next";
import path from "path";
import dotenv from "dotenv";

// Load bot env so the dashboard can reuse DISCORD_TOKEN without duplication.
// Next already loads dashboard `.env*` files; we only add missing values from the bot env.
dotenv.config({ path: path.resolve(__dirname, "../bot/.env") });

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
