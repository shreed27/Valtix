"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Send, ArrowLeftRight, ImageIcon, BookUser, Users, Menu, X, Settings } from "lucide-react";
import './sidebar.css';

const navLinks = [
    { href: "/", text: "Dashboard", icon: Home },
    { href: "/accounts", text: "Accounts", icon: Wallet },
    { href: "/send", text: "Send", icon: Send },
    { href: "/receive", text: "Receive", icon: ArrowLeftRight },
    { href: "/swap", text: "Swap", icon: ArrowLeftRight },
    { href: "/nfts", text: "NFTs", icon: ImageIcon },
    { href: "/contacts", text: "Contacts", icon: BookUser },
    { href: "/multisig", text: "Multisig", icon: Users },
    { href: "/history", text: "History", icon: ArrowLeftRight },
];

export default function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (isOpen: boolean) => void }) {
    const pathname = usePathname();

    return (
        <>
            <aside className={`sidebar ${isOpen ? "open" : ""}`}>
                <nav className="sidebar-nav">
                    {navLinks.map(link => (
                        <Link key={link.href} href={link.href} className={`nav-item ${pathname === link.href ? "active" : ""}`}>
                            <link.icon className="nav-icon" />
                            <span className="nav-text">{link.text}</span>
                        </Link>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <Link href="/settings" className={`nav-item ${pathname === "/settings" ? "active" : ""}`}>
                        <Settings className="nav-icon" />
                        <span className="nav-text">Settings</span>
                    </Link>
                </div>
            </aside>
            {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}
        </>
    );
}