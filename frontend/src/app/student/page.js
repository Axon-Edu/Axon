"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import styles from "./student.module.css";
import uiStyles from "@/components/ui/ui.module.css";
import { isMockKey } from "@/lib/firebase";
import AppLayout from "@/components/layout/AppLayout";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
                setSubjects([{ id: "s1", name: "Science", grade: "10" }]);
            } finally {
                setLoadingContent(false);
            }
        }

        fetchContent();
    }, [user]);

    const handleStartSession = () => {
        router.push("/session");
    };

    const getSubjectColorClass = (index) => {
        const classes = [uiStyles.cardGreen, uiStyles.cardPink, uiStyles.cardPurple, uiStyles.cardYellow];
        return classes[index % classes.length];
    };

    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <AppLayout>
                <div className={styles.container}>
                    <header className={styles.userHeader}>
                        <div className={styles.avatar}>👤</div>
                        <div className={styles.userName}>
                            {userProfile?.full_name || "Yan William"}
                        </div>
                        <div className={styles.headerIcons}>
                            <div className={styles.iconBtn}>🔍</div>
                            <div className={styles.iconBtn} onClick={logout}>🚪</div>
                        </div>
                    </header>

                    <h1 className={styles.sectionTitle}>
                        My courses <span>({subjects.length})</span>
                    </h1>

                    <div className={styles.filterTabs}>
                        <div className={`${styles.tab} ${styles.tabActive}`}>All</div>
                        <div className={`${styles.tab} ${styles.tabInactive}`}>Design</div>
                        <div className={`${styles.tab} ${styles.tabInactive}`}>Developing</div>
                        <div className={`${styles.tab} ${styles.tabInactive}`}>UX</div>
                    </div>

                    {loadingContent ? (
                        <p style={{ color: '#888', textAlign: 'center' }}>Loading...</p>
                    ) : (
                        <>
                            <div className={`${styles.coursesGrid} responsive-grid`}>
                                {subjects.map((subject, idx) => {
                                    const colorClass = getSubjectColorClass(idx);
                                    const chapters = chaptersBySubject[subject.id] || [];

                                    return (
                                        <div key={subject.id} className={styles.courseWrapper}>
                                            <div className={`${uiStyles.card} ${uiStyles.courseCard} ${colorClass}`}>
                                                <svg className={uiStyles.cardArt} viewBox="0 0 140 130" fill="none">
                                                    <ellipse cx="30" cy="50" rx="50" ry="22" transform="rotate(-30 30 50)" fill="#b89af5" opacity="0.7" />
                                                    <ellipse cx="80" cy="80" rx="45" ry="18" transform="rotate(-20 80 80)" fill="#0d0d0d" opacity="0.35" />
                                                </svg>
                                                <div className={styles.rating}>⭐ 4.9</div>
                                                <div className={styles.arrowBtn}>↗</div>
                                                <div className={styles.courseName}>{subject.name}</div>
                                                <div className={styles.courseMeta}>{chapters.length} lessons</div>
                                            </div>

                                            <div className={styles.chapterList}>
                                                {chapters.map((chap) => (
                                                    <Button
                                                        key={chap.id}
                                                        className={styles.chapterBtn}
                                                        onClick={handleStartSession}
                                                    >
                                                        Ch {chap.chapter_number}: {chap.title}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Event Card: Design Conference */}
                            <div className={`${uiStyles.card} ${uiStyles.eventCard} ${uiStyles.cardPurple}`}>
                                <svg className={uiStyles.cardArt} viewBox="0 0 280 100" fill="none">
                                    <ellipse cx="160" cy="20" rx="90" ry="30" transform="rotate(-10 160 20)" fill="#c8f55a" opacity="0.6" />
                                    <ellipse cx="220" cy="60" rx="70" ry="25" transform="rotate(5 220 60)" fill="#0d0d0d" opacity="0.25" />
                                </svg>
                                <div className={styles.eventTimeBadge}>Today at 05:00 PM</div>
                                <div className={styles.attendees}>
                                    <div className={styles.attendeeAvatar}>👤</div>
                                    <div className={styles.plusBadge}>+6</div>
                                </div>
                                <div className={styles.eventName}>Design Conference</div>
                                <div className={styles.eventMetaText}>14 speakers · 12 themes</div>
                                <div className={styles.eventArrow}>↗</div>
                            </div>
                        </>
                    )}
                </div>
            </AppLayout>
        </ProtectedRoute>
    );
}
