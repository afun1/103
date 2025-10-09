/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/index.html',
        destination: '/recorder',
        permanent: false
      }
    ];
  }
}

module.exports = nextConfig