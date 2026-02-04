"use client";

import { Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Header from "@/components/layout/header";
import { AuthGuard } from "@/components/auth-guard";

const manrope = Manrope({ subsets: ["latin"] });

import { usePathname } from "next/navigation";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSetupPage = pathname?.startsWith("/setup");

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.className} min-h-screen bg-background text-foreground antialiased`}>
        <Providers>
          <AuthGuard>
            <div className="flex min-h-screen bg-background text-foreground">
              <div className="flex-1 flex flex-col">
                {!isSetupPage && <Header />}
                <main className={`w-full animate-in fade-in slide-in-from-bottom-4 duration-500 ${!isSetupPage ? "p-6 md:p-8 max-w-7xl mx-auto" : ""}`}>
                  {children}
                </main>
              </div>
            </div>
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}


