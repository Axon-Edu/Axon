import styles from "./SessionSummarizer.module.css";
import { useRouter } from "next/navigation";

export default function SessionSummarizer({ studentName }) {
    const router = useRouter();
    const name = studentName ? studentName.split(" ")[0] : "Superstar";

    return (
        <div className={styles.summarizerContainer}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.iconContainer}>
                        <span className={styles.celebrationIcon}>🎉</span>
                    </div>
                    <h2>Great job today, {name}!</h2>
                    <p>You're one step closer to mastering this subject.</p>
                </div>

                <div className={styles.feedbackGrid}>
                    {/* Constructive Highlight */}
                    <div className={styles.feedbackBox}>
                        <div className={styles.boxHeader}>
                            <span className={styles.boxIcon}>🌟</span>
                            <h3>What went well</h3>
                        </div>
                        <p>
                            You asked excellent questions about the core concepts!
                            Your ability to break down the problem into smaller chunks is really improving. Keep trusting your instincts!
                        </p>
                    </div>

                    {/* Area to focus on */}
                    <div className={styles.feedbackBox}>
                        <div className={styles.boxHeader}>
                            <span className={styles.boxIcon}>🔍</span>
                            <h3>Focus Area for Next Time</h3>
                        </div>
                        <p>
                            While your logic was sound, remember to double-check the final calculations.
                            A quick review before moving on will ensure perfection!
                        </p>
                    </div>
                </div>

                {/* Positive Motivation */}
                <div className={styles.motivationSection}>
                    <p className={styles.motivationText}>
                        "Success is the sum of small efforts, repeated day in and day out."
                    </p>
                    <p className={styles.motivationSubtext}>
                        Ready to keep that streak going?
                    </p>
                </div>

                <div className={styles.actions}>
                    <button
                        className={styles.dashboardBtn}
                        onClick={() => router.push("/student")}
                    >
                        Return to Dashboard
                    </button>
                    <button
                        className={styles.reviewBtn}
                        onClick={() => router.push("/progress")}
                    >
                        Review Progress
                    </button>
                </div>
            </div>
        </div>
    );
}
