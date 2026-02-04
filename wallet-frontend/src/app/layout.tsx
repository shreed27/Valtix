"use client";

import { Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { AuthGuard } from "@/components/auth-guard";
import "@/components/layout/sidebar.css";
import useIsMobile from "@/hooks/useIsMobile";


const manrope = Manrope({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.className} min-h-screen bg-background text-foreground antialiased`}>
        <Providers>
          <AuthGuard>
            <div className="flex min-h-screen bg-background text-foreground">
              <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
              <div className="flex-1 flex flex-col md:ml-[250px] transition-all duration-300">
                <Header />
                <main className="p-6 md:p-8 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
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


