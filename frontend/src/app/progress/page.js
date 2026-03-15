"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import styles from "./progress.module.css";

export default function ProgressPage() {
    const { userProfile } = useAuth();
    const router = useRouter();

    // Mock data
    const overallMastery = 72;
    const subjects = [
        {
            name: "Mathematics",
            icon: "📐",
            mastery: 72,
            chapters: [
                { name: "Real Numbers", mastery: 83, sessions: 3 },
                { name: "Polynomials", mastery: 65, sessions: 2 },
                { name: "Pair of Linear Equations", mastery: 58, sessions: 1 },
                { name: "Quadratic Equations", mastery: 0, sessions: 0 },
            ],
        },
    ];

    const recentSessions = [
        { topic: "Real Numbers", score: "83%", duration: "18 min", date: "Today", status: "completed" },
        { topic: "Polynomials", score: "65%", duration: "22 min", date: "Yesterday", status: "completed" },
        { topic: "Linear Equations", score: "58%", duration: "15 min", date: "2 days ago", status: "partial" },
    ];

    const weeklyActivity = [3, 5, 2, 4, 6, 1, 3]; // Mon-Sun
    const maxActivity = Math.max(...weeklyActivity);
    const days = ["M", "T", "W", "T", "F", "S", "S"];

    // SVG ring calculations
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (overallMastery / 100) * circumference;

    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <AppLayout>
                <div className={styles.container}>
                    <header className={styles.header}>
                        <h1 className={styles.pageTitle}>My Progress</h1>
                        <div className={styles.headerSub}>
                            Keep going, {userProfile?.full_name || "Student"}! 🚀
                        </div>
                    </header>

                    {/* Overall Mastery Ring */}
                    <div className={styles.masteryCard}>
                        <div className={styles.ringContainer}>
                            <svg width="140" height="140" viewBox="0 0 150 150">
                                <circle
                                    cx="75" cy="75" r={radius}
                                    fill="none"
                                    stroke="var(--bg-tertiary)"
                                    strokeWidth="10"
                                />
                                <circle
                                    cx="75" cy="75" r={radius}
                                    fill="none"
                                    stroke="var(--accent-green)"
                                    strokeWidth="10"
                                    strokeLinecap="round"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={offset}
                                    transform="rotate(-90 75 75)"
                                    style={{ transition: "stroke-dashoffset 1.5s ease" }}
                                />
                                <text
                                    x="75" y="70"
                                    textAnchor="middle"
                                    fill="var(--text-primary)"
                                    fontSize="36"
                                    fontWeight="700"
                                    fontFamily="var(--font-heading)"
                                >
                                    {overallMastery}%
                                </text>
                                <text
                                    x="75" y="92"
                                    textAnchor="middle"
                                    fill="var(--text-muted)"
                                    fontSize="12"
                                >
                                    Overall Mastery
                                </text>
                            </svg>
                        </div>
                        <div className={styles.masteryQuickStats}>
                            <div className={styles.quickStat}>
                                <div className={styles.quickStatValue}>6</div>
                                <div className={styles.quickStatLabel}>Sessions</div>
                            </div>
                            <div className={styles.quickStatDivider} />
                            <div className={styles.quickStat}>
                                <div className={styles.quickStatValue}>11</div>
                                <div className={styles.quickStatLabel}>Questions</div>
                            </div>
                            <div className={styles.quickStatDivider} />
                            <div className={styles.quickStat}>
                                <div className={styles.quickStatValue}>55m</div>
                                <div className={styles.quickStatLabel}>Time</div>
                            </div>
                        </div>
                    </div>

                    {/* Weekly Activity */}
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Weekly Activity</h2>
                    </div>
                    <div className={styles.activityCard}>
                        <div className={styles.activityBars}>
                            {weeklyActivity.map((val, i) => (
                                <div key={i} className={styles.barCol}>
                                    <div className={styles.barTrack}>
                                        <div
                                            className={styles.barFill}
                                            style={{
                                                height: `${(val / maxActivity) * 100}%`,
                                                background: i === new Date().getDay() - 1 || (i === 6 && new Date().getDay() === 0)
                                                    ? "var(--accent-purple)"
                                                    : "var(--accent-green)",
                                            }}
                                        />
                                    </div>
                                    <div className={styles.barLabel}>{days[i]}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Subject Breakdown */}
                    {subjects.map((subject, si) => (
                        <div key={si}>
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>
                                    {subject.icon} {subject.name}
                                </h2>
                                <span className={styles.sectionMeta}>{subject.mastery}% mastery</span>
                            </div>
                            <div className={styles.chaptersGrid}>
                                {subject.chapters.map((chapter, ci) => (
                                    <div
                                        key={ci}
                                        className={`${styles.chapterCard} ${chapter.mastery === 0 ? styles.chapterLocked : ""}`}
                                        onClick={() => chapter.mastery > 0 && router.push("/session")}
                                    >
                                        <div className={styles.chapterTop}>
                                            <div className={styles.chapterName}>{chapter.name}</div>
                                            <div className={styles.chapterMastery}>
                                                {chapter.mastery > 0 ? `${chapter.mastery}%` : "—"}
                                            </div>
                                        </div>
                                        <div className={styles.chapterProgressTrack}>
                                            <div
                                                className={styles.chapterProgressFill}
                                                style={{
                                                    width: `${chapter.mastery}%`,
                                                    background: chapter.mastery >= 70
                                                        ? "var(--accent-green)"
                                                        : chapter.mastery >= 40
                                                            ? "var(--accent-amber)"
                                                            : "var(--accent-pink)",
                                                }}
                                            />
                                        </div>
                                        <div className={styles.chapterMeta}>
                                            {chapter.sessions > 0
                                                ? `${chapter.sessions} session${chapter.sessions > 1 ? "s" : ""}`
                                                : "Not started"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Recent Sessions */}
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Recent Sessions</h2>
                    </div>
                    <div className={styles.sessionsList}>
                        {recentSessions.map((session, i) => (
                            <div key={i} className={styles.sessionItem}>
                                <div className={styles.sessionIcon}>
                                    {session.status === "completed" ? "✅" : "⏸️"}
                                </div>
                                <div className={styles.sessionInfo}>
                                    <div className={styles.sessionTopic}>{session.topic}</div>
                                    <div className={styles.sessionMeta}>
                                        {session.duration} · {session.date}
                                    </div>
                                </div>
                                <div className={styles.sessionScore}>{session.score}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </AppLayout>
        </ProtectedRoute>
    );
}
