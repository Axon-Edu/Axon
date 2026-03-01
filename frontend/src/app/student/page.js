"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./student.module.css";
import { isMockKey } from "@/lib/firebase";
import AppLayout from "@/components/layout/AppLayout";
import SearchOverlay from "@/components/ui/SearchOverlay";
import ProfilePopup from "@/components/ui/ProfilePopup";

export default function StudentDashboard() {
    const { user, userProfile, logout } = useAuth();
    const router = useRouter();
    const [searchOpen, setSearchOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [subjectPopup, setSubjectPopup] = useState(null);
    const [expandedChapter, setExpandedChapter] = useState(null);
    const [upcomingEvent, setUpcomingEvent] = useState(null);
    const [countdown, setCountdown] = useState("00:00:00");

    // Mock data
    const streak = 5;
    const masteryPercent = 72;
    const lastSession = {
        topic: "Real Numbers",
        subject: "Mathematics",
        duration: "18 min",
        questionsAnswered: 6,
        score: "83%",
        date: "Today",
    };

    const subjectsData = [
        {
            id: "math",
            name: "Mathematics",
            icon: "📐",
            progress: 72,
            color: "accent-purple",
            chapters: [
                {
                    id: "ch1",
                    name: "Real Numbers",
                    mastery: 83,
                    totalQuestions: 25,
                    attemptedQuestions: 18,
                    description: "Explore rational & irrational numbers, Euclid's division lemma, and the fundamental theorem of arithmetic.",
                    scheduledClass: { date: "Today", time: "4:00 PM", teacher: "Ms. Sharma" },
                },
                {
                    id: "ch2",
                    name: "Polynomials",
                    mastery: 65,
                    totalQuestions: 20,
                    attemptedQuestions: 10,
                    description: "Learn about zeros of polynomials, relationship between zeros and coefficients, and division algorithm.",
                    scheduledClass: { date: "Tomorrow", time: "10:00 AM", teacher: "Ms. Sharma" },
                },
                {
                    id: "ch3",
                    name: "Pair of Linear Equations",
                    mastery: 58,
                    totalQuestions: 22,
                    attemptedQuestions: 8,
                    description: "Graphical and algebraic methods for solving pairs of linear equations in two variables.",
                    scheduledClass: null,
                },
                {
                    id: "ch4",
                    name: "Quadratic Equations",
                    mastery: 0,
                    totalQuestions: 18,
                    attemptedQuestions: 0,
                    description: "Standard form, solving by factorisation, completing the square, and quadratic formula.",
                    scheduledClass: { date: "Wed, 5 Mar", time: "4:00 PM", teacher: "Mr. Gupta" },
                },
            ],
        },
    ];

    const todaySchedule = [
        { time: "4:00 PM", subject: "Mathematics", chapter: "Real Numbers", type: "Live Class", teacher: "Ms. Sharma" },
        { time: "5:30 PM", subject: "Mathematics", chapter: "Polynomials", type: "Practice", teacher: null },
    ];

    const handleResumeSession = () => router.push("/session");

    const openSubjectPopup = (subject) => {
        setSubjectPopup(subject);
        setExpandedChapter(null);
    };

    const toggleChapter = (chapterId) => {
        setExpandedChapter(expandedChapter === chapterId ? null : chapterId);
    };

    const startChapterSession = (chapterId) => {
        router.push("/session");
    };

    // Schedule logic
    const handleScheduleClick = (event) => {
        if (event.type === "Live Class") {
            router.push("/session");
        } else {
            setUpcomingEvent(event);
            updateCountdown(event.time);
        }
    };

    const updateCountdown = (timeStr) => {
        const now = new Date();
        const [time, modifier] = timeStr.split(" ");
        let [hours, minutes] = time.split(":").map(Number);

        if (modifier === "PM" && hours !== 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;

        const target = new Date();
        target.setHours(hours, minutes, 0, 0);

        // If time passed today, assume it's for tomorrow
        if (target < now) {
            target.setDate(target.getDate() + 1);
        }

        const diffSeconds = Math.max(0, Math.floor((target - now) / 1000));
        const h = Math.floor(diffSeconds / 3600);
        const m = Math.floor((diffSeconds % 3600) / 60);
        const s = diffSeconds % 60;

        setCountdown(
            `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
        );
    };

    // Update countdown every second if popup is open
    useEffect(() => {
        let interval;
        if (upcomingEvent) {
            updateCountdown(upcomingEvent.time);
            interval = setInterval(() => {
                updateCountdown(upcomingEvent.time);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [upcomingEvent]);

    // Mastery ring calculations
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (masteryPercent / 100) * circumference;

    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <AppLayout>
                <div className={styles.container}>
                    {/* Header */}
                    <header className={styles.userHeader}>
                        <div className={styles.avatar} onClick={() => setProfileOpen(true)} style={{ cursor: "pointer" }}>
                            👤
                        </div>
                        <div className={styles.headerText}>
                            <div className={styles.greeting}>Good evening</div>
                            <div className={styles.userName}>{userProfile?.full_name || "Student"}</div>
                        </div>
                        <div className={styles.headerIcons}>
                            <div className={styles.iconBtn} onClick={() => setSearchOpen(true)}>🔍</div>
                            <div className={styles.iconBtn} onClick={() => setProfileOpen(true)}>👤</div>
                        </div>
                    </header>

                    {/* Stats Row */}
                    <div className={styles.statsRow}>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon}>🔥</div>
                            <div className={styles.statInfo}>
                                <div className={styles.statValue}>{streak}</div>
                                <div className={styles.statLabel}>Day Streak</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.masteryRing}>
                                <svg width="56" height="56" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--bg-tertiary)" strokeWidth="8" />
                                    <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--accent-green)" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} transform="rotate(-90 50 50)" style={{ transition: "stroke-dashoffset 1s ease" }} />
                                    <text x="50" y="54" textAnchor="middle" fill="var(--text-primary)" fontSize="22" fontWeight="700" fontFamily="var(--font-heading)">{masteryPercent}</text>
                                </svg>
                            </div>
                            <div className={styles.statInfo}>
                                <div className={styles.statLabel}>Mastery</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon}>📖</div>
                            <div className={styles.statInfo}>
                                <div className={styles.statValue}>{lastSession.questionsAnswered}</div>
                                <div className={styles.statLabel}>Questions</div>
                            </div>
                        </div>
                    </div>

                    {/* Resume Session Hero */}
                    <div className={styles.resumeCard} onClick={handleResumeSession}>
                        <div className={styles.resumeArt}>
                            <svg viewBox="0 0 400 160" fill="none">
                                <ellipse cx="320" cy="30" rx="120" ry="50" transform="rotate(-15 320 30)" fill="var(--svg-fill-accent)" opacity="0.6" />
                                <ellipse cx="100" cy="120" rx="100" ry="40" transform="rotate(10 100 120)" fill="var(--svg-fill-dark)" opacity="0.3" />
                            </svg>
                        </div>
                        <div className={styles.resumeBadge}>
                            <span className={styles.liveIndicator} />
                            Continue Learning
                        </div>
                        <div className={styles.resumeContent}>
                            <div className={styles.resumeSubject}>{lastSession.subject}</div>
                            <div className={styles.resumeTopic}>{lastSession.topic}</div>
                            <div className={styles.resumeMeta}>{lastSession.duration} · {lastSession.score} score · {lastSession.date}</div>
                        </div>
                        <div className={styles.resumeBtn}>
                            <span>Resume</span>
                            <span className={styles.resumeArrow}>→</span>
                        </div>
                    </div>

                    {/* Today's Schedule */}
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Today&apos;s Schedule</h2>
                        <span className={styles.sectionMeta}>{todaySchedule.length} events</span>
                    </div>
                    <div className={styles.scheduleList}>
                        {todaySchedule.map((event, i) => (
                            <div key={i} className={styles.scheduleItem} onClick={() => handleScheduleClick(event)}>
                                <div className={styles.scheduleTime}>
                                    <div className={styles.scheduleTimeText}>{event.time}</div>
                                    <div className={`${styles.scheduleDot} ${event.type === "Live Class" ? styles.dotLive : styles.dotPractice}`} />
                                </div>
                                <div className={styles.scheduleInfo}>
                                    <div className={styles.scheduleTitle}>{event.chapter}</div>
                                    <div className={styles.scheduleSub}>
                                        {event.subject} · {event.type}{event.teacher ? ` · ${event.teacher}` : ""}
                                    </div>
                                </div>
                                <div className={`${styles.scheduleTag} ${event.type === "Live Class" ? styles.tagLive : styles.tagPractice}`}>
                                    {event.type === "Live Class" ? "🔴 Live" : "📝 Practice"}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Last Session Summary */}
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Last Session</h2>
                        <span className={styles.sectionMeta}>{lastSession.date}</span>
                    </div>
                    <div className={styles.sessionSummary}>
                        <div className={styles.summaryRow}>
                            <div className={styles.summaryItem}>
                                <div className={styles.summaryIcon}>📐</div>
                                <div>
                                    <div className={styles.summaryLabel}>Topic</div>
                                    <div className={styles.summaryValue}>{lastSession.topic}</div>
                                </div>
                            </div>
                            <div className={styles.summaryItem}>
                                <div className={styles.summaryIcon}>⏱</div>
                                <div>
                                    <div className={styles.summaryLabel}>Duration</div>
                                    <div className={styles.summaryValue}>{lastSession.duration}</div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.summaryRow}>
                            <div className={styles.summaryItem}>
                                <div className={styles.summaryIcon}>✅</div>
                                <div>
                                    <div className={styles.summaryLabel}>Answered</div>
                                    <div className={styles.summaryValue}>{lastSession.questionsAnswered} questions</div>
                                </div>
                            </div>
                            <div className={styles.summaryItem}>
                                <div className={styles.summaryIcon}>🏆</div>
                                <div>
                                    <div className={styles.summaryLabel}>Score</div>
                                    <div className={styles.summaryValue}>{lastSession.score}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Subject Selection */}
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Subjects</h2>
                    </div>
                    <div className={styles.subjectsGrid}>
                        {subjectsData.map((subject) => (
                            <div key={subject.id} className={styles.subjectCard} onClick={() => openSubjectPopup(subject)}>
                                <div className={styles.subjectArt}>
                                    <svg viewBox="0 0 200 120" fill="none">
                                        <ellipse cx="140" cy="20" rx="80" ry="30" transform="rotate(-20 140 20)" fill="var(--svg-fill-accent)" opacity="0.5" />
                                        <ellipse cx="60" cy="90" rx="60" ry="25" transform="rotate(15 60 90)" fill="var(--svg-fill-dark)" opacity="0.3" />
                                    </svg>
                                </div>
                                <div className={styles.subjectIcon}>{subject.icon}</div>
                                <div className={styles.subjectName}>{subject.name}</div>
                                <div className={styles.subjectMeta}>{subject.chapters.length} chapters</div>
                                <div className={styles.subjectProgress}>
                                    <div className={styles.progressTrack}>
                                        <div className={styles.progressFill} style={{ width: `${subject.progress}%` }} />
                                    </div>
                                    <span className={styles.progressLabel}>{subject.progress}%</span>
                                </div>
                                <div className={styles.subjectArrow}>→</div>
                            </div>
                        ))}
                        <div className={`${styles.subjectCard} ${styles.comingSoon}`}>
                            <div className={styles.subjectIcon}>🔬</div>
                            <div className={styles.subjectName}>Science</div>
                            <div className={styles.subjectMeta}>Coming Soon</div>
                        </div>
                    </div>

                    {/* Subject Chapters Popup */}
                    {subjectPopup && (
                        <div className={styles.popupBackdrop} onClick={() => setSubjectPopup(null)}>
                            <div className={styles.popupPanel} onClick={(e) => e.stopPropagation()}>
                                <div className={styles.popupHeader}>
                                    <div className={styles.popupHeaderLeft}>
                                        <span className={styles.popupIcon}>{subjectPopup.icon}</span>
                                        <div>
                                            <div className={styles.popupTitle}>{subjectPopup.name}</div>
                                            <div className={styles.popupSub}>{subjectPopup.chapters.length} chapters · {subjectPopup.progress}% mastery</div>
                                        </div>
                                    </div>
                                    <button className={styles.popupClose} onClick={() => setSubjectPopup(null)}>✕</button>
                                </div>

                                <div className={styles.chaptersList}>
                                    {subjectPopup.chapters.map((chapter) => (
                                        <div key={chapter.id} className={styles.chapterItem}>
                                            <div className={styles.chapterHead} onClick={() => toggleChapter(chapter.id)}>
                                                <div className={styles.chapterLeft}>
                                                    <div className={`${styles.chapterStatus} ${chapter.mastery > 0 ? styles.chapterStarted : styles.chapterLocked}`}>
                                                        {chapter.mastery > 0 ? "✓" : "○"}
                                                    </div>
                                                    <div>
                                                        <div className={styles.chapterName}>{chapter.name}</div>
                                                        <div className={styles.chapterProgressRow}>
                                                            <div className={styles.chapterTrack}>
                                                                <div className={styles.chapterFill} style={{
                                                                    width: `${chapter.mastery}%`,
                                                                    background: chapter.mastery >= 70 ? "var(--accent-green)" : chapter.mastery >= 40 ? "var(--accent-amber)" : "var(--accent-pink)",
                                                                }} />
                                                            </div>
                                                            <span className={styles.chapterPercent}>{chapter.mastery}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={`${styles.chapterChevron} ${expandedChapter === chapter.id ? styles.chevronOpen : ""}`}>
                                                    ›
                                                </div>
                                            </div>

                                            {expandedChapter === chapter.id && (
                                                <div className={styles.chapterDetail}>
                                                    <p className={styles.chapterDesc}>{chapter.description}</p>
                                                    <div className={styles.chapterStats}>
                                                        <div className={styles.chapterStatItem}>
                                                            <span className={styles.chapterStatIcon}>📝</span>
                                                            <div>
                                                                <div className={styles.chapterStatValue}>{chapter.attemptedQuestions}/{chapter.totalQuestions}</div>
                                                                <div className={styles.chapterStatLabel}>Questions</div>
                                                            </div>
                                                        </div>
                                                        <div className={styles.chapterStatItem}>
                                                            <span className={styles.chapterStatIcon}>🎯</span>
                                                            <div>
                                                                <div className={styles.chapterStatValue}>{chapter.mastery}%</div>
                                                                <div className={styles.chapterStatLabel}>Mastery</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {chapter.scheduledClass && (
                                                        <div className={styles.chapterSchedule}>
                                                            <span className={styles.chapterScheduleIcon}>📅</span>
                                                            <div>
                                                                <div className={styles.chapterScheduleTitle}>Scheduled Class</div>
                                                                <div className={styles.chapterScheduleSub}>
                                                                    {chapter.scheduledClass.date} at {chapter.scheduledClass.time} · {chapter.scheduledClass.teacher}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <button className={styles.chapterStartBtn} onClick={() => startChapterSession(chapter.id)}>
                                                        {chapter.mastery > 0 ? "Continue Learning →" : "Start Chapter →"}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Upcoming Event Countdown Popup */}
                    {upcomingEvent && (
                        <div className={styles.popupBackdrop} onClick={() => setUpcomingEvent(null)}>
                            <div className={styles.countdownPanel} onClick={(e) => e.stopPropagation()}>
                                <button className={styles.popupClose} onClick={() => setUpcomingEvent(null)} style={{ position: "absolute", top: "16px", right: "16px" }}>✕</button>
                                <div className={styles.countdownIcon}>⏳</div>
                                <h3 className={styles.countdownTitle}>Session not started yet</h3>
                                <p className={styles.countdownSub}>
                                    {upcomingEvent.subject} · {upcomingEvent.chapter}
                                </p>
                                <div className={styles.countdownTimer}>
                                    {countdown}
                                </div>
                                <p className={styles.countdownText}>Until {upcomingEvent.type.toLowerCase()} begins at {upcomingEvent.time}</p>
                                <button className={styles.countdownBtn} onClick={() => setUpcomingEvent(null)}>Got it</button>
                            </div>
                        </div>
                    )}

                    {/* Popups */}
                    <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
                    <ProfilePopup isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
                </div>
            </AppLayout>
        </ProtectedRoute>
    );
}
