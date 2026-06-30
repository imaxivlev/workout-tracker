import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Не раскрываем стек: убираем заголовок X-Powered-By: Next.js
  poweredByHeader: false,
  // Строгий режим React помогает ловить ошибки в разработке
  reactStrictMode: true,
};

export default nextConfig;
