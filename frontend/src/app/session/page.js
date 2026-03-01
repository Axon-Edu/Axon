"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import ChatBubble from "@/components/ui/ChatBubble";
import styles from "./session.module.css";
import uiStyles from "@/components/ui/ui.module.css";
import AppLayout from "@/components/layout/AppLayout";

export default function SessionDashboard() {
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const [messages, setMessages] = useState([
        { id: 1, message: "Hello! I'm your AI tutor. Ready to dive into today's lesson?", type: "ai" }
    ]);
    const [input, setInput] = useState("");
    const [activeTab, setActiveTab] = useState("Program");
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = (e) => {
        if (e) e.preventDefault();
        if (!input.trim()) return;

        const newMsg = { id: messages.length + 1, message: input, type: "user" };
        setMessages([...messages, newMsg]);
        setInput("");

        // Simple AI Mock Response
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: prev.length + 1,
                message: "That's a great question! Let's explore that further...",
                type: "ai"
            }]);
        }, 1000);
    };

    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <AppLayout>
                <div className={`${styles.container} chat-container-responsive`}>
                    <div className={styles.detailHero}>
                        <svg className={styles.detailHeroArt} viewBox="0 0 320 200" fill="none">
                            <ellipse cx="160" cy="60" rx="130" ry="50" transform="rotate(-15 160 60)" fill="#c8f55a" opacity="0.65" />
                            <ellipse cx="240" cy="140" rx="120" ry="45" transform="rotate(10 240 140)" fill="#0d0d0d" opacity="0.3" />
                            <ellipse cx="80" cy="160" rx="100" ry="40" transform="rotate(-25 80 160)" fill="#c8f55a" opacity="0.5" />
                        </svg>
                        <div className={styles.detailNav}>
                            <div className={styles.backBtn} onClick={() => router.push("/student")}>←</div>
                            <div className={styles.shareBtn}>↗</div>
                        </div>
                        <div className={styles.detailTime}>In Progress</div>
                        <div className={styles.bookmarkBtn}>🔖</div>
                    </div>

                    <div className={styles.detailBody}>
                        <div className={styles.detailTitle}>Chemical<br />Reactions</div>
                        <div className={styles.detailSpeakers}>Grade 10 · Chapter 1</div>

                        <div className={styles.detailTabs}>
                            <div
                                className={`${styles.detailTab} ${activeTab === 'Overview' ? styles.tabActive : styles.tabInactive}`}
                                onClick={() => setActiveTab('Overview')}
                            >
                                Overview
                            </div>
                            <div
                                className={`${styles.detailTab} ${activeTab === 'Program' ? styles.tabActive : styles.tabInactive}`}
                                onClick={() => setActiveTab('Program')}
                            >
                                Session
                            </div>
                        </div>

                        {activeTab === 'Overview' ? (
                            <div className={styles.overview}>
                                <div className={styles.infoGrid}>
                                    <div className={styles.infoItem}>
                                        <div className={styles.infoIcon}>📍</div>
                                        <div>
                                            <div className={styles.infoLabel}>Subject</div>
                                            <div className={styles.infoValue}>Science</div>
                                        </div>
                                    </div>
                                    <div className={styles.infoItem}>
                                        <div className={styles.infoIcon}>💰</div>
                                        <div>
                                            <div className={styles.infoLabel}>Phase</div>
                                            <div className={styles.infoValue}>Learning</div>
                                        </div>
                                    </div>
                                </div>
                                <div className={uiStyles.detailDesc} style={{ color: '#bbb', fontSize: '12px', lineHeight: '1.7' }}>
                                    In this session, we'll explore **Chemical Reactions and Equations**. You'll learn how to balance equations and identify various types of reactions.
                                </div>
                            </div>
                        ) : (
                            <div className={styles.chatArea}>
                                <div className={styles.messageList}>
                                    {messages.map((msg) => (
                                        <ChatBubble key={msg.id} message={msg.message} type={msg.type} />
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>

                                <form onSubmit={handleSendMessage} className={styles.inputArea}>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        placeholder="Ask a question..."
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                    />
                                    <button type="submit" className={styles.sendBtn}>→</button>
                                </form>
                            </div>
                        )}

                        <div className={styles.registerBtn} onClick={() => router.push("/student")}>
                            End Session
                        </div>
                    </div>
                </div>
            </AppLayout>
        </ProtectedRoute>
    );
}
