"use client";

import { useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./student.module.css";

export default function StudentDashboard() {
    const { userProfile, logout } = useAuth();

    return (
        <ProtectedRoute allowedRoles={["student"]}>
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
                    <div className={styles.subjectGrid}>
                        <div className={styles.subjectCard}>
                            <div className={styles.subjectIcon}>🔬</div>
                            <h3>Science</h3>
                            <p>Class 10 • NCERT</p>
                            <div className={styles.chapters}>
                                <div className={styles.chapterItem}>
                                    <span>Ch 4: Carbon and its Compounds</span>
                                    <button className={styles.startBtn}>Start Session</button>
                                </div>
                                <div className={styles.chapterItem}>
                                    <span>Ch 12: Electricity</span>
                                    <button className={styles.startBtn}>Start Session</button>
                                </div>
                            </div>
                        </div>
                    </div>
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
