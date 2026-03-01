"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import ThemeToggle from "./ThemeToggle";
import "@/app/responsive.css";

export default function AppLayout({ children }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            setIsMobile(width < 768);
            if (width < 768) {
                setSidebarOpen(false);
            }
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const toggleSidebar = () => setSidebarOpen((prev) => !prev);

    return (
        <div className={`app-container ${isSidebarOpen ? "sidebar-active" : "sidebar-collapsed"} app-layout-active`}>
            <ThemeToggle />

            {/* Hamburger toggle button — visible on tablet/desktop */}
            {!isMobile && (
                <button
                    className="hamburger-btn"
                    onClick={toggleSidebar}
                    aria-label="Toggle sidebar"
                >
                    <span className="hamburger-line" />
                    <span className="hamburger-line" />
                    <span className="hamburger-line" />
                </button>
            )}

            {/* Sidebar with slide animation */}
            {!isMobile && <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />}

            {/* Backdrop when sidebar is open */}
            {!isMobile && isSidebarOpen && (
                <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
            )}

            <main className="main-content">
                {children}
            </main>

            {isMobile && <BottomNav />}
        </div>
    );
}
