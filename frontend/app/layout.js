import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { GlobalNotificationToast } from "@/components/notifications/GlobalNotificationToast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Virtual Study Room - Không gian học tập tập trung",
  description: "Phòng học nhóm trực tuyến tối giản, tập trung sâu.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-[100dvh] bg-stone-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 transition-colors duration-200`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <GlobalNotificationToast />
        </ThemeProvider>
      </body>
    </html>
  );
}

