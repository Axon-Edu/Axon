"use client";

import { useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRouter } from "next/navigation";
import Chip from "@/components/ui/Chip";
import ChatBubble from "@/components/ui/ChatBubble";
import Button from "@/components/ui/Button";
import styles from "./session.module.css";
import { useState } from "react";

export default function SessionDashboard() {
    const { logout } = useAuth();
    const router = useRouter();
    const [messages, setMessages] = useState([
        { text: "Hello! Ready to start exploring Science?", type: "ai" },
        { text: "Yes, I'm ready!", type: "user" },
        { text: "Great! Let's talk about the states of matter.", type: "ai" },
    ]);
    const [input, setInput] = useState("");

    const handleSendMessage = (e) => {
        if (e) e.preventDefault();
        if (!input.trim()) return;
        setMessages([...messages, { text: input, type: "user" }]);
        setInput("");
        // Mocking AI response
        setTimeout(() => {
            setMessages((prev) => [...prev, { text: "That's an interesting thought! Let's dive deeper.", type: "ai" }]);
        }, 1000);
    };

    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <div className="phoneShell">
                <div className={styles.container}>
                    <div className={styles.hero}>
                        <div className={styles.heroNav}>
                            <div className={styles.navBtn} onClick={() => router.back()}>←</div>
                            <div className={styles.navBtn}>↗</div>
                        </div>
                        <div className={styles.heroContent}>
                            <h1 className={styles.heroTitle}>Science Session</h1>
                            <p className={styles.heroMeta}>Chapter 1: Nutrition in Plants • 12 participants</p>
                        </div>
                        <svg style={{ position: 'absolute', top: 0, right: 0, opacity: 0.2 }} viewBox="0 0 200 200" width="200" height="200">
                            <ellipse cx="140" cy="60" rx="100" ry="40" transform="rotate(20 140 60)" fill="var(--vibrant-green)" />
                        </svg>
                    </div>

                    <div className={styles.chatArea}>
                        <div className={styles.phaseChip}>
                            <Chip color="yellow">Exploration Phase</Chip>
                        </div>

                        <ChatBubble type="ai" message="Welcome to the session! I'm your AI learning guide. Today we'll explore how plants synthesize their own food." />

                        {messages.map((msg, idx) => (
                            <ChatBubble key={idx} type={msg.type} message={msg.text} />
                        ))}
                    </div>

                    <div className={styles.inputArea}>
                        <form className={styles.inputContainer} onSubmit={handleSendMessage}>
                            <input
                                type="text"
                                placeholder="Type your question..."
                                className={styles.inputField}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                            />
                            <button type="submit" className={styles.sendBtn}>
                                →
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
