"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import './header.css';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { href: "/send", text: "Send" },
    { href: "/receive", text: "Receive" },
    { href: "/swap", text: "Swap" },
    { href: "/nfts", text: "NFTs" },
    { href: "/contacts", text: "Contacts" },
    { href: "/multisig", text: "Multisig" },
  ];

  return (
    <header className="header">
      <div className="logo-container">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        <div className="logo-text-container">
          <h1 className="logo-title">Valtix</h1>
          <span className="logo-version">v1.3</span>
        </div>
      </div>

      <nav className={`nav-links ${isOpen ? "open" : ""}`}>
        {navLinks.map(link => (
          <Link key={link.href} href={link.href} className="nav-link">
            {link.text}
          </Link>
        ))}
      </nav>

      <div className="header-right">
        <ThemeToggle />
        <button className="menu-button" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}