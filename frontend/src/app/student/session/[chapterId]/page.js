"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import SessionSummarizer from "@/components/SessionSummarizer";
import styles from "./SessionStyles.module.css";

export default function LearningSession() {
    const { user, userProfile } = useAuth();
    const router = useRouter();

    const [messages, setMessages] = useState([
        { id: 1, sender: "ai", text: "Hello! Ready to dive into today's learning session? What concept would you like to explore?" }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [sessionEnded, setSessionEnded] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        // Add user message
        const newUserMsg = { id: Date.now(), sender: "user", text: inputValue };
        setMessages(prev => [...prev, newUserMsg]);
        setInputValue("");

        // Mock AI response
        setTimeout(() => {
            const aiResponse = {
                id: Date.now() + 1,
                sender: "ai",
                text: "That's a great observation! " +
                    (messages.length > 3 ? "You're really getting the hang of this. Notice how the fundamental principles apply here?" : "Let's explore that a bit deeper. What do you think happens when we change the initial conditions?")
            };
            setMessages(prev => [...prev, aiResponse]);
        }, 1500);
    };

    const handleEndSession = () => {
        setSessionEnded(true);
    };

    // If the session has ended, show the summarizer
    if (sessionEnded) {
        return (
            <ProtectedRoute allowedRoles={["student"]}>
                <SessionSummarizer studentName={userProfile?.full_name || user?.displayName} />
            </ProtectedRoute>
        );
    }

    // Active Chat Session View
    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <div className={styles.container}>
                <header className={styles.header}>
                    <button className={styles.backBtn} onClick={() => router.push("/student")}>
                        ← Back
                    </button>
                    <h2>Active Learning Session 🧠</h2>
                    <button className={styles.endBtn} onClick={handleEndSession}>
                        End Session
                    </button>
                </header>

                <div className={styles.chatContainer}>
                    <div className={styles.messagesList}>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`${styles.messageWrapper} ${msg.sender === "user" ? styles.userMsgWrapper : styles.aiMsgWrapper}`}
                            >
                                {msg.sender === "ai" && <div className={styles.avatar}>🤖</div>}
                                <div className={`${styles.messageBubble} ${msg.sender === "user" ? styles.userBubble : styles.aiBubble}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className={styles.inputArea} onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Type your question or thought here..."
                            className={styles.textInput}
                        />
                        <button type="submit" className={styles.sendBtn} disabled={!inputValue.trim()}>
                            Send ➔
                        </button>
                    </form>
                </div>
            </div>
        </ProtectedRoute>
    );
}
