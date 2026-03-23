import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ServiceWorkerRegistration } from "./components/ServiceWorkerRegistration";
import { CookieConsent } from "./components/CookieConsent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#DC2626",
};

export const metadata: Metadata = {
  title: "CrossFit Tracker",
  description: "Трекер тренировок для кроссфита",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/workout-tracker/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#DC2626" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <noscript>
          <div><img src="https://mc.yandex.ru/watch/108187486" style={{position:'absolute', left:'-9999px'}} alt="" /></div>
        </noscript>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Yandex.Metrika counter */}
        <Script id="yandex-metrika" strategy="afterInteractive">{`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=108187486', 'ym');
          ym(108187486, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
        `}</Script>
        <ServiceWorkerRegistration />
        {children}
        <CookieConsent />
        {/* Involveo widget */}
        <Script
          src="https://involveo.ru/widget.js"
          data-token="0709f004-e77e-4877-8895-43c6f00f2b65"
          id="involveo_widget"
          type="module"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
