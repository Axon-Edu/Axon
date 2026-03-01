"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import styles from "./student.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

import { isMockKey } from "@/lib/firebase";

export default function StudentDashboard() {
    const { user, userProfile, logout } = useAuth();
    const router = useRouter();
    const [subjects, setSubjects] = useState([]);
    const [chaptersBySubject, setChaptersBySubject] = useState({});
    const [loadingContent, setLoadingContent] = useState(true);

    useEffect(() => {
        if (!user) return;

        async function fetchContent() {
            try {
                if (isMockKey) {
                    // Load mock data directly
                    const mockSubjects = [
                        { id: "s1", name: "Science", grade: "10" },
                        { id: "s2", name: "Mathematics", grade: "10" },
                        { id: "s3", name: "Social Science", grade: "10" },
                    ];
                    setSubjects(mockSubjects);
                    setChaptersBySubject({
                        s1: [
                            { id: "c1", chapter_number: "1", title: "Chemical Reactions" },
                            { id: "c2", chapter_number: "2", title: "Acids, Bases and Salts" }
                        ],
                        s2: [
                            { id: "c3", chapter_number: "1", title: "Real Numbers" }
                        ],
                        s3: []
                    });
                    setLoadingContent(false);
                    return;
                }

                const token = await user.getIdToken();
                const headers = { Authorization: `Bearer ${token}` };

                const subRes = await fetch(`${API_URL}/api/subjects`, { headers });
                if (!subRes.ok) throw new Error("Failed to fetch subjects");
                const subjectsData = await subRes.json();
                setSubjects(subjectsData);

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
                // Last resort fallback
                setSubjects([{ id: "s1", name: "Science", grade: "10" }]);
            } finally {
                setLoadingContent(false);
            }
        }

        fetchContent();
    }, [user]);

    const SUBJECT_ICONS = {
        Science: "🔬",
        Mathematics: "📐",
        "Social Science": "🌍",
    };

    const handleStartSession = () => {
        router.push("/session");
    };

    const getSubjectColor = (index) => {
        const colors = ["green", "pink", "purple", "yellow"];
        return colors[index % colors.length];
    };

    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <div className="phoneShell">
                <div className={styles.container}>
                    <header className={styles.userHeader}>
                        <div className={styles.avatar}>👤</div>
                        <div className={styles.userName}>
                            {userProfile?.full_name || "Student"}
                        </div>
                        <div className={styles.headerActions}>
                            <div className={styles.iconBtn}>🔍</div>
                            <div className={styles.iconBtn} onClick={logout}>🚪</div>
                        </div>
                    </header>

                    <h1 className={styles.sectionTitle}>
                        My courses <span>({subjects.length})</span>
                    </h1>

                    <div className={styles.filterTabs}>
                        <div className={`${styles.tab} ${styles.tabActive}`}>All</div>
                        <div className={`${styles.tab} ${styles.tabInactive}`}>Science</div>
                        <div className={`${styles.tab} ${styles.tabInactive}`}>Math</div>
                        <div className={`${styles.tab} ${styles.tabInactive}`}>History</div>
                    </div>

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
                            {subjects.map((subject, idx) => {
                                const color = getSubjectColor(idx);
                                const chapters = chaptersBySubject[subject.id] || [];

                                return (
                                    <div key={subject.id} className={styles.subjectWrapper}>
                                        <Card
                                            color={color}
                                            blob={true}
                                            className={`${styles.subjectCard} ${styles[`subjectCard${color.charAt(0).toUpperCase() + color.slice(1)}`]}`}
                                            style={{ backgroundColor: `var(--vibrant-${color})` }}
                                        >
                                            <div className={styles.rating}>⭐ 4.9</div>
                                            <div className={styles.arrowBtn}>↗</div>
                                            <div className={styles.subjectInfo}>
                                                <h3>{subject.name}</h3>
                                                <p className={styles.subjectMeta}>
                                                    Class {subject.grade} • {chapters.length} lessons
                                                </p>
                                            </div>
                                        </Card>

                                        <div className={styles.chapterList}>
                                            {chapters.map((chapter) => (
                                                <Button
                                                    key={chapter.id}
                                                    variant="secondary"
                                                    className={styles.chapterBtn}
                                                    onClick={handleStartSession}
                                                >
                                                    <span>Ch {chapter.chapter_number}</span>
                                                    {chapter.title}
                                                    <span style={{ fontSize: '10px' }}>Start →</span>
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
