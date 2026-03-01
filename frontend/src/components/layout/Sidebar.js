"use client";

import styles from "./layout.module.css";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar({ isOpen, onClose }) {
    const pathname = usePathname();

    const menuItems = [
        { name: "Dashboard", icon: "🏠", path: "/student" },
        { name: "Sessions", icon: "📖", path: "/session" },
        { name: "My Progress", icon: "📈", path: "/progress" },
    ];

    return (
        <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}>
            <div className={styles.sidebarHeader}>
                <button className={styles.closeBtn} onClick={onClose} aria-label="Close sidebar">
                    ✕
                </button>
            </div>

            <nav className={styles.sidebarNav}>
                {menuItems.map((item) => (
                    <Link
                        key={item.path}
                        href={item.path}
                        className={`${styles.navItem} ${pathname === item.path ? styles.active : ""}`}
                        onClick={onClose}
                    >
                        <span className={styles.navIcon}>{item.icon}</span>
                        <span className={styles.navName}>{item.name}</span>
                    </Link>
                ))}
            </nav>
        </aside>
    );
}
