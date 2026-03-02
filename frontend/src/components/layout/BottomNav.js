"use client";

import styles from "./layout.module.css";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        { name: "Home", icon: "🏠", path: "/student" },
        { name: "Learn", icon: "📖", path: "/session" },
        { name: "Progress", icon: "📈", path: "/progress" },
        { name: "Profile", icon: "👤", path: "/student", isProfile: true },
    ];

    return (
        <nav className={styles.bottomNav}>
            {navItems.map((item) => (
                <Link
                    key={item.name}
                    href={item.path}
                    className={`${styles.bottomNavItem} ${pathname === item.path && !item.isProfile ? styles.active : ""}`}
                >
                    <span className={styles.bottomNavIcon}>{item.icon}</span>
                    <span className={styles.bottomNavText}>{item.name}</span>
                </Link>
            ))}
        </nav>
    );
}
