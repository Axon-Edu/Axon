"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./session.module.css";
import AppLayout from "@/components/layout/AppLayout";

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
    useEffect(() => {
        if (lessonStep >= lessonFlow.length) {
            setSessionComplete(true);
            setCurrentPhase(PHASES.COMPLETE);
            return;
        }

        const step = lessonFlow[lessonStep];

        if (step.phase === PHASES.TEACHING) {
            setCurrentPhase(PHASES.TEACHING);
            if (messageIndex < step.messages.length) {
                setIsTyping(true);
                const timer = setTimeout(() => {
                    setMessages((prev) => [
                        ...prev,
                        { ...step.messages[messageIndex], id: Date.now() },
                    ]);
                    setIsTyping(false);
                    setMessageIndex((prev) => prev + 1);
                }, messageIndex === 0 ? 800 : 1500);
                return () => clearTimeout(timer);
            } else {
                // Move to next step
                setLessonStep((prev) => prev + 1);
                setMessageIndex(0);
            }
        } else if (step.phase === PHASES.ASSESSMENT) {
            setCurrentPhase(PHASES.ASSESSMENT);
            // Add the question as a message
            if (messageIndex === 0) {
                setIsTyping(true);
                const timer = setTimeout(() => {
                    setMessages((prev) => [
                        ...prev,
                        { type: "ai", text: `📝 **Assessment Question:**\n\n${step.question.text}`, id: Date.now(), isQuestion: true },
                    ]);
                    setIsTyping(false);
                    setMessageIndex(1);
                }, 800);
                return () => clearTimeout(timer);
            }
        }
    }, [lessonStep, messageIndex]);

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

    const handleSendMessage = (e) => {
        if (e) e.preventDefault();
        if (!input.trim()) return;

        setMessages((prev) => [
            ...prev,
            { type: "user", text: input, id: Date.now() },
        ]);
        setInput("");

        // Mock AI response to free-form questions
        setIsTyping(true);
        setTimeout(() => {
            setMessages((prev) => [
                ...prev,
                {
                    type: "ai",
                    text: "That's a great question! Let me explain further. In the context of real numbers, every number you encounter in daily life is a real number. The key distinction is between rational (expressible as fractions) and irrational (not expressible as fractions) numbers.",
                    id: Date.now(),
                },
            ]);
            setIsTyping(false);
        }, 1200);
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
                        <div className={styles.phaseIndicator}>
                            <span
                                className={styles.phaseDot}
                                style={{ background: PHASE_COLORS[currentPhase] }}
                            />
                            <span className={styles.phaseText}>{currentPhase}</span>
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

                            {/* Session Complete */}
                            {sessionComplete && (
                                <div className={styles.completeCard}>
                                    <div className={styles.completeBadge}>🎉</div>
                                    <div className={styles.completeTitle}>Session Complete!</div>
                                    <div className={styles.completeStats}>
                                        <div className={styles.completeStat}>
                                            <div className={styles.completeStatValue}>{correctCount}/{totalQuestions}</div>
                                            <div className={styles.completeStatLabel}>Correct</div>
                                        </div>
                                        <div className={styles.completeStat}>
                                            <div className={styles.completeStatValue}>{masteryPercent}%</div>
                                            <div className={styles.completeStatLabel}>Mastery</div>
                                        </div>
                                    </div>
                                    <button
                                        className={styles.completeBtn}
                                        onClick={() => router.push("/student")}
                                    >
                                        Back to Dashboard
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
            </AppLayout>
        </ProtectedRoute>
    );
}
