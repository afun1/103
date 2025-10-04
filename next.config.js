/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: false
  },
  trailingSlash: true,
  output: 'standalone'
}

module.exports = nextConfig