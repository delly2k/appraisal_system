/** @type {import('next').NextConfig} */
const path = require("path");
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["next-auth", "@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@sparticuz/chromium/**",
      "./node_modules/puppeteer-core/**",
    ],
  },
};

module.exports = nextConfig;
