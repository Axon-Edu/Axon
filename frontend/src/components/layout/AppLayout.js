"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import ThemeToggle from "./ThemeToggle";
import "@/app/responsive.css";

export default function AppLayout({ children }) {
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            setIsMobile(width < 768);
            if (width >= 768 && width < 1024) {
                setSidebarCollapsed(true);
            } else if (width >= 1024) {
                setSidebarCollapsed(false);
            }
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);


    return (
        <div className={`app-container ${isSidebarCollapsed ? "sidebar-collapsed" : "sidebar-active"} app-layout-active`}>
            <ThemeToggle />
            {!isMobile && <Sidebar isCollapsed={isSidebarCollapsed} />}

            <main className="main-content">
                {children}
            </main>

            {isMobile && <BottomNav />}
        </div>
    );
}
