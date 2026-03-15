"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./SearchOverlay.module.css";

const searchableItems = [
    { name: "Mathematics", icon: "📐", path: "/session", type: "Subject" },
    { name: "Real Numbers", icon: "🔢", path: "/session", type: "Chapter" },
    { name: "Polynomials", icon: "📊", path: "/session", type: "Chapter" },
    { name: "My Progress", icon: "📈", path: "/progress", type: "Page" },
    { name: "Learning Session", icon: "📖", path: "/session", type: "Page" },
    { name: "Dashboard", icon: "🏠", path: "/student", type: "Page" },
];

export default function SearchOverlay({ isOpen, onClose }) {
    const [query, setQuery] = useState("");
    const inputRef = useRef(null);
    const router = useRouter();

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
        if (!isOpen) setQuery("");
    }, [isOpen]);

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            document.addEventListener("keydown", handleEsc);
            return () => document.removeEventListener("keydown", handleEsc);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const filtered = query.trim()
        ? searchableItems.filter((item) =>
            item.name.toLowerCase().includes(query.toLowerCase())
        )
        : searchableItems;

    const handleSelect = (item) => {
        router.push(item.path);
        onClose();
    };

    return (
        <>
            <div className={styles.backdrop} onClick={onClose} />
            <div className={styles.searchContainer}>
                <div className={styles.searchInner}>
                    <input
                        ref={inputRef}
                        className={styles.searchInput}
                        type="text"
                        placeholder="Search subjects, chapters, pages..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>
                <div className={styles.results}>
                    {filtered.length > 0 ? (
                        filtered.map((item, i) => (
                            <div
                                key={i}
                                className={styles.resultItem}
                                onClick={() => handleSelect(item)}
                            >
                                <span className={styles.resultIcon}>{item.icon}</span>
                                <span>{item.name}</span>
                                <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)" }}>
                                    {item.type}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className={styles.noResults}>No results for "{query}"</div>
                    )}
                </div>
            </div>
        </>
    );
}
