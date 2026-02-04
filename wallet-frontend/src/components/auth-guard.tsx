"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWalletStatus } from "@/hooks/useWallet";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { data: status, isLoading } = useWalletStatus();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        if (isLoading) return;

        // Allow access to setup page always
        if (pathname.startsWith("/setup")) {
            setIsAuthorized(true);
            return;
        }

        if (!status?.has_wallet) {
            // No wallet -> Redirect to setup
            router.replace("/setup");
            return;
        }

        if (!status?.is_unlocked) {
            // Wallet exists but locked -> Redirect to unlock
            router.replace("/setup?unlock=true");
            return;
        }

        // Wallet exists and is unlocked -> Allow access
        setIsAuthorized(true);
    }, [status, isLoading, pathname, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-foreground" />
                    <p className="text-muted-foreground font-medium animate-pulse">Loading Valtix...</p>
                </div>
            </div>
        );
    }

    // Prevent flash of unauthorized content
    if (!isAuthorized && !pathname.startsWith("/setup")) {
        return null;
    }

    return <>{children}</>;
}
