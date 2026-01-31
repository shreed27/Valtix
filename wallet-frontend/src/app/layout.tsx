"use client";

import { Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
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
          <div style={{ display: 'flex' }}>
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: isMobile ? '0' : '250px' }}>
              <Header />
              <main style={{ padding: '1rem' }}>
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}


