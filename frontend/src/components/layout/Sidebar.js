"use client";

import styles from "./layout.module.css";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar({ isCollapsed }) {
    const pathname = usePathname();

    const menuItems = [
        { name: "Dashboard", icon: "🏠", path: "/student" },
        { name: "Sessions", icon: "📺", path: "/session" },
        { name: "My Progress", icon: "📈", path: "/progress" },
        { name: "Settings", icon: "⚙️", path: "/settings" },
    ];

    return (
        <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""}`}>
            <div className={styles.sidebarLogo}>
                <div className={styles.logoBox}>A</div>
                {!isCollapsed && <span className={styles.logoText}>Axon</span>}
            </div>

            <nav className={styles.sidebarNav}>
                {menuItems.map((item) => (
                    <Link
                        key={item.path}
                        href={item.path}
                        className={`${styles.navItem} ${pathname === item.path ? styles.active : ""}`}
                    >
                        <span className={styles.navIcon}>{item.icon}</span>
                        {!isCollapsed && <span className={styles.navName}>{item.name}</span>}
                    </Link>
                ))}
            </nav>
        </aside>
    );
}
