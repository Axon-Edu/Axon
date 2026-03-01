"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import OnboardingModal from "@/components/OnboardingModal";
import styles from "./student.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function StudentDashboard() {
    const { user, userProfile, logout } = useAuth();
    const router = useRouter();
    const [subjects, setSubjects] = useState([]);
    const [chaptersBySubject, setChaptersBySubject] = useState({});
    const [loadingContent, setLoadingContent] = useState(true);
    const [showOnboarding, setShowOnboarding] = useState(false);

    useEffect(() => {
        if (!user) return;

        async function fetchContent() {
            try {
                const token = await user.getIdToken();
                const headers = { Authorization: `Bearer ${token}` };

                // Fetch subjects
                const subRes = await fetch(`${API_URL}/api/subjects`, { headers });
                if (!subRes.ok) throw new Error("Failed to fetch subjects");
                const subjectsData = await subRes.json();
                setSubjects(subjectsData);

                // Fetch chapters for each subject
                const chaptersMap = {};
                for (const subject of subjectsData) {
                    const chapRes = await fetch(
                        `${API_URL}/api/subjects/${subject.id}/chapters`,
                        { headers }
                    );
                    if (chapRes.ok) {
                        chaptersMap[subject.id] = await chapRes.json();
                    }
                }
                setChaptersBySubject(chaptersMap);
            } catch (err) {
                console.error("Error fetching content:", err);
            } finally {
                setLoadingContent(false);
            }
        }

        fetchContent();
    }, [user]);

    // Check for onboarding status on mount or when user loads
    useEffect(() => {
        if (!user) return;
        const hasCompletedOnboarding = localStorage.getItem(`onboarding_completed_${user.uid}`);
        if (!hasCompletedOnboarding) {
            setShowOnboarding(true);
        }
    }, [user]);

    const SUBJECT_ICONS = {
        Science: "🔬",
        Mathematics: "📐",
        "Social Science": "🌍",
    };

    return (
        <ProtectedRoute allowedRoles={["student"]}>
            {showOnboarding && (
                <OnboardingModal
                    user={user}
                    onComplete={() => setShowOnboarding(false)}
                />
            )}
            <div className={styles.container}>
                <header className={styles.header}>
                    <div className={styles.greeting}>
                        <span className={styles.mascot}>⚡</span>
                        <div>
                            <h1>Hey, {userProfile?.full_name?.split(" ")[0] || "there"}! 👋</h1>
                            <p>Ready to learn something awesome today?</p>
                        </div>
                    </div>
                    <button className={styles.logoutBtn} onClick={logout}>Sign Out</button>
                </header>

                <div className={styles.streakBar}>
                    <div className={styles.streakItem}>
                        <span className={styles.streakIcon}>🔥</span>
                        <span>0 day streak</span>
                    </div>
                    <div className={styles.streakItem}>
                        <span className={styles.streakIcon}>📚</span>
                        <span>0 sessions</span>
                    </div>
                </div>

                <section className={styles.subjectsSection}>
                    <h2>Your Subjects</h2>
                    {loadingContent ? (
                        <div className={styles.emptyState}>
                            <p>Loading subjects...</p>
                        </div>
                    ) : subjects.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>No subjects available yet. Ask your instructor to set up content! 📝</p>
                        </div>
                    ) : (
                        <div className={styles.subjectGrid}>
                            {subjects.map((subject) => (
                                <div key={subject.id} className={styles.subjectCard}>
                                    <div className={styles.subjectIcon}>
                                        {SUBJECT_ICONS[subject.name] || "📖"}
                                    </div>
                                    <h3>{subject.name}</h3>
                                    <p>Class {subject.grade} • NCERT</p>
                                    <div className={styles.chapters}>
                                        {(chaptersBySubject[subject.id] || []).map((chapter) => (
                                            <div key={chapter.id} className={styles.chapterItem}>
                                                <span>
                                                    Ch {chapter.chapter_number}: {chapter.title}
                                                </span>
                                                <button
                                                    className={styles.startBtn}
                                                    onClick={() => router.push(`/student/session/${chapter.id}`)}
                                                >
                                                    Start Session
                                                </button>
                                            </div>
                                        ))}
                                        {(!chaptersBySubject[subject.id] ||
                                            chaptersBySubject[subject.id].length === 0) && (
                                                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.85rem" }}>
                                                    No chapters uploaded yet.
                                                </p>
                                            )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className={styles.recentSection}>
                    <h2>Recent Activity</h2>
                    <div className={styles.emptyState}>
                        <p>No sessions yet. Start your first lesson! 🚀</p>
                    </div>
                </section>
            </div>
        </ProtectedRoute>
    );
}
