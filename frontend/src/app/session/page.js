"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./session.module.css";
import AppLayout from "@/components/layout/AppLayout";
import SessionSummarizer from "@/components/ui/SessionSummarizer";

// Session phases
const PHASES = {
    TEACHING: "Teaching",
    ASSESSMENT: "Assessment",
    FEEDBACK: "Feedback",
    COMPLETE: "Complete",
};

const PHASE_COLORS = {
    [PHASES.TEACHING]: "var(--accent-purple)",
    [PHASES.ASSESSMENT]: "var(--accent-amber)",
    [PHASES.FEEDBACK]: "var(--accent-green)",
    [PHASES.COMPLETE]: "var(--accent-blue)",
};

// Mock lesson content
const lessonFlow = [
    {
        phase: PHASES.TEACHING,
        messages: [
            { type: "ai", text: "Welcome! Today we're learning about **Real Numbers**. Let's start with the basics." },
            { type: "ai", text: "**Real Numbers** include all rational and irrational numbers. They can be represented on a number line." },
            { type: "ai", text: "A **rational number** can be written as p/q where q ≠ 0. For example: 1/2, 3, -7, 0.5" },
            { type: "ai", text: "An **irrational number** cannot be written as a simple fraction. Examples: √2, π, e" },
            { type: "ai", text: "💡 Remember: Every point on the number line represents a unique real number, and every real number has a unique point on the number line." },
        ],
    },
    {
        phase: PHASES.ASSESSMENT,
        question: {
            text: "Which of the following is an **irrational** number?",
            options: ["3/4", "√2", "0.75", "5"],
            correct: 1,
            explanation: "√2 is irrational because it cannot be expressed as a fraction p/q. Its decimal expansion is non-terminating and non-repeating: 1.41421356...",
        },
    },
    {
        phase: PHASES.TEACHING,
        messages: [
            { type: "ai", text: "Great! Now let's learn about the **Decimal Expansion** of real numbers." },
            { type: "ai", text: "The decimal expansion of a rational number is either **terminating** or **non-terminating repeating**." },
            { type: "ai", text: "Example: 1/4 = 0.25 (terminating) and 1/3 = 0.333... (non-terminating repeating)" },
            { type: "ai", text: "For irrational numbers, the decimal expansion is **non-terminating** and **non-repeating**." },
        ],
    },
    {
        phase: PHASES.ASSESSMENT,
        question: {
            text: "What type of decimal expansion does **1/3** have?",
            options: ["Terminating", "Non-terminating repeating", "Non-terminating non-repeating", "None of these"],
            correct: 1,
            explanation: "1/3 = 0.333... The digit 3 repeats infinitely, making it a non-terminating repeating decimal. This is characteristic of rational numbers.",
        },
    },
    {
        phase: PHASES.ASSESSMENT,
        question: {
            text: "Which statement about real numbers is **true**?",
            options: [
                "All real numbers are rational",
                "√9 is irrational",
                "Every real number has a unique point on the number line",
                "0 is not a real number"
            ],
            correct: 2,
            explanation: "Every real number corresponds to a unique point on the number line. This is one of the foundational properties of real numbers. Note: √9 = 3, which is rational.",
        },
    },
];

export default function SessionPage() {
    const { userProfile } = useAuth();
    const router = useRouter();

    const [currentPhase, setCurrentPhase] = useState(PHASES.TEACHING);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [lessonStep, setLessonStep] = useState(0);
    const [messageIndex, setMessageIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [correctCount, setCorrectCount] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [sessionComplete, setSessionComplete] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [apiState, setApiState] = useState(null);
    const [suggestedOptions, setSuggestedOptions] = useState([]);
    const [chapterId, setChapterId] = useState(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const { user } = useAuth(); // Assuming useAuth provides user object

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        setChapterId(searchParams.get("chapterId"));
    }, []);

    const messagesEndRef = useRef(null);
    const chatAreaRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, showExplanation, scrollToBottom]);

    // Auto-play teaching messages
    // Start Session API call
    useEffect(() => {
        if (!user || !chapterId) return;

        const startSession = async () => {
            setIsTyping(true);
            try {
                const token = user.getIdToken ? await user.getIdToken() : "mock_token";
                const response = await fetch(`${API_URL}/api/ai/tutor/start`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ chapter_id: chapterId })
                });

                if (!response.ok) throw new Error("Failed to start session");

                const data = await response.json();
                setMessages([{ type: "ai", text: data.message, id: Date.now() }]);
                setSessionId(data.session_id);
                setApiState(data.current_state);
                setSuggestedOptions(data.suggested_options || []);
            } catch (err) {
                console.error("Session start error:", err);
            } finally {
                setIsTyping(false);
            }
        };

        startSession();
    }, [user, chapterId]);

    const handleOptionSelect = (optionIndex) => {
        if (selectedOption !== null) return;

        const step = lessonFlow[lessonStep];
        const isCorrect = optionIndex === step.question.correct;

        setSelectedOption(optionIndex);
        setTotalQuestions((prev) => prev + 1);

        // Add user response
        setMessages((prev) => [
            ...prev,
            { type: "user", text: step.question.options[optionIndex], id: Date.now() },
        ]);

        if (isCorrect) {
            setCorrectCount((prev) => prev + 1);
        }

        // Show feedback after a short delay
        setTimeout(() => {
            setCurrentPhase(PHASES.FEEDBACK);

            setMessages((prev) => [
                ...prev,
                {
                    type: "ai",
                    text: isCorrect
                        ? `✅ **Correct!** Well done!\n\n${step.question.explanation}`
                        : `❌ **Not quite.** The correct answer is: **${step.question.options[step.question.correct]}**\n\n${step.question.explanation}`,
                    id: Date.now(),
                    isFeedback: true,
                    isCorrect,
                },
            ]);
            setShowExplanation(true);
        }, 600);
    };

    const handleContinue = () => {
        setSelectedOption(null);
        setShowExplanation(false);
        setLessonStep((prev) => prev + 1);
        setMessageIndex(0);
    };

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        const messageText = input.trim();
        if (!messageText || !user || !sessionId) return;

        // Add user message to UI
        setMessages((prev) => [
            ...prev,
            { type: "user", text: messageText, id: Date.now() },
        ]);
        setInput("");
        setIsTyping(true);

        try {
            const token = user.getIdToken ? await user.getIdToken() : "mock_token";
            const response = await fetch(`${API_URL}/api/ai/tutor/turn`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    chapter_id: chapterId,
                    session_id: sessionId,
                    message: messageText
                })
            });

            if (!response.ok) throw new Error("Failed to process turn");

            const data = await response.json();

            // Add AI response to UI
            setMessages((prev) => [
                ...prev,
                { type: "ai", text: data.message, id: Date.now() },
            ]);

            setApiState(data.current_state);
            setSuggestedOptions(data.suggested_options || []);

        } catch (err) {
            console.error("Chat error:", err);
            setMessages((prev) => [
                ...prev,
                { type: "error", text: "Oops, something went wrong. Try again!", id: Date.now() },
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    const masteryPercent = totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;

    const currentStep = lessonStep < lessonFlow.length ? lessonFlow[lessonStep] : null;

    // Render markdown-like bold text
    const renderText = (text) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            // Handle newlines
            return part.split("\n").map((line, j) => (
                <span key={`${i}-${j}`}>
                    {j > 0 && <br />}
                    {line}
                </span>
            ));
        });
    };

    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <AppLayout>
                {/* Full-screen Session Summarizer if session is complete */}
                {sessionComplete ? (
                    <SessionSummarizer studentName={userProfile?.full_name} />
                ) : (
                    <div className={styles.container}>
                        {/* Session Header */}
                        <div className={styles.sessionHeader}>
                            <div className={styles.headerLeft}>
                                <button className={styles.backBtn} onClick={() => router.push("/student")}>
                                    ←
                                </button>
                                <div>
                                    <div className={styles.sessionSubject}>Mathematics</div>
                                    <div className={styles.sessionTopic}>Real Numbers</div>
                                </div>
                            </div>
                            <div className={styles.headerRight}>
                                <div className={styles.phaseIndicator}>
                                    <span
                                        className={styles.phaseDot}
                                        style={{ background: PHASE_COLORS[currentPhase] }}
                                    />
                                    <span className={styles.phaseText}>{currentPhase}</span>
                                </div>
                                <button className={styles.endBtn} onClick={() => setSessionComplete(true)}>
                                    End Session
                                </button>
                            </div>
                        </div>

                        {/* Phase Progress Bar */}
                        <div className={styles.phaseBar}>
                            {Object.values(PHASES).slice(0, 3).map((phase) => (
                                <div
                                    key={phase}
                                    className={`${styles.phaseSegment} ${currentPhase === phase ? styles.phaseActive : ""} ${Object.values(PHASES).indexOf(currentPhase) > Object.values(PHASES).indexOf(phase)
                                        ? styles.phaseComplete
                                        : ""
                                        }`}
                                >
                                    <div className={styles.phaseSegLabel}>{phase}</div>
                                </div>
                            ))}
                        </div>

                        {/* Mastery Bar (if questions answered) */}
                        {totalQuestions > 0 && (
                            <div className={styles.masteryBar}>
                                <span className={styles.masteryLabel}>Mastery</span>
                                <div className={styles.masteryTrack}>
                                    <div
                                        className={styles.masteryFill}
                                        style={{
                                            width: `${masteryPercent}%`,
                                            background: masteryPercent >= 70
                                                ? "var(--accent-green)"
                                                : masteryPercent >= 40
                                                    ? "var(--accent-amber)"
                                                    : "var(--accent-pink)",
                                        }}
                                    />
                                </div>
                                <span className={styles.masteryValue}>{masteryPercent}%</span>
                            </div>
                        )}

                        {/* Chat Area */}
                        <div className={styles.chatArea} ref={chatAreaRef}>
                            <div className={styles.messageList}>
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`${styles.msgWrapper} ${msg.type === "user" ? styles.msgUser : styles.msgAi} ${msg.isFeedback ? (msg.isCorrect ? styles.msgCorrect : styles.msgIncorrect) : ""
                                            }`}
                                    >
                                        {msg.type === "ai" && (
                                            <div className={styles.aiAvatar}>🤖</div>
                                        )}
                                        <div className={`${styles.msgBubble} ${msg.type === "user" ? styles.bubbleUser : styles.bubbleAi}`}>
                                            {renderText(msg.text)}
                                        </div>
                                    </div>
                                ))}

                                {/* Typing indicator */}
                                {isTyping && (
                                    <div className={`${styles.msgWrapper} ${styles.msgAi}`}>
                                        <div className={styles.aiAvatar}>🤖</div>
                                        <div className={`${styles.msgBubble} ${styles.bubbleAi} ${styles.typing}`}>
                                            <span className={styles.typingDot} />
                                            <span className={styles.typingDot} />
                                            <span className={styles.typingDot} />
                                        </div>
                                    </div>
                                )}

                                {/* Assessment Options */}
                                {currentPhase === PHASES.ASSESSMENT && currentStep && messageIndex > 0 && !showExplanation && (
                                    <div className={styles.optionsContainer}>
                                        {currentStep.question.options.map((option, i) => (
                                            <button
                                                key={i}
                                                className={`${styles.optionBtn} ${selectedOption === i
                                                    ? i === currentStep.question.correct
                                                        ? styles.optionCorrect
                                                        : styles.optionIncorrect
                                                    : selectedOption !== null && i === currentStep.question.correct
                                                        ? styles.optionCorrect
                                                        : ""
                                                    }`}
                                                onClick={() => handleOptionSelect(i)}
                                                disabled={selectedOption !== null}
                                            >
                                                <span className={styles.optionLetter}>
                                                    {String.fromCharCode(65 + i)}
                                                </span>
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Continue Button after feedback */}
                                {showExplanation && !sessionComplete && (
                                    <div className={styles.continueWrapper}>
                                        <button className={styles.continueBtn} onClick={handleContinue}>
                                            Continue →
                                        </button>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Input Area */}
                        {!sessionComplete && (
                            <form onSubmit={handleSendMessage} className={styles.inputArea}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder={
                                        currentPhase === PHASES.ASSESSMENT
                                            ? "Select an option above..."
                                            : "Ask a question..."
                                    }
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    disabled={currentPhase === PHASES.ASSESSMENT && !showExplanation}
                                />
                                <button
                                    type="submit"
                                    className={styles.sendBtn}
                                    disabled={!input.trim() || (currentPhase === PHASES.ASSESSMENT && !showExplanation)}
                                >
                                    →
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </AppLayout>
        </ProtectedRoute>
    );
}
