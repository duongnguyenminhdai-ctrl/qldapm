import { Suspense } from "react";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { GlobalNotificationToast } from "@/components/notifications/GlobalNotificationToast";
import { ConfirmProvider } from "@/context/ConfirmContext";
import { BannedAccountModal } from "@/components/auth/BannedAccountModal";
import { GlobalCardModal } from "@/components/cards/GlobalCardModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata = {
  title: "Virtual Study Room - Không gian học tập tập trung",
  description: "Phòng học nhóm trực tuyến tối giản, tập trung sâu.",
  icons: {
    icon: "/image/logo.png",
    shortcut: "/image/logo.png",
    apple: "/image/logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" suppressHydrationWarning className="h-full overflow-x-hidden max-w-full max-w-full">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http:; script-src 'self' 'unsafe-eval' 'unsafe-inline' https: http:; style-src 'self' 'unsafe-inline' https: http:; img-src 'self' data: blob: https: http:; media-src 'self' data: blob: https: http:; connect-src 'self' https: http: ws: wss: *; font-src 'self' data: https: http:;"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} font-sans antialiased h-full min-h-[100dvh] bg-background text-foreground transition-colors duration-300 overflow-x-hidden`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          storageKey="theme"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          <ConfirmProvider>
            {children}
            <GlobalNotificationToast />
            <BannedAccountModal />
            <Suspense fallback={null}>
              <GlobalCardModal />
            </Suspense>
          </ConfirmProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
