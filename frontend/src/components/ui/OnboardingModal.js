import { useState, useEffect } from "react";
import styles from "./OnboardingModal.module.css";

export default function OnboardingModal({ user, onComplete }) {
    // Pre-fill name if available from the auth provider
    const [name, setName] = useState("");
    const [grade, setGrade] = useState("10");
    const [board, setBoard] = useState("CBSE");
    const [interests, setInterests] = useState([]);
    const [hobbies, setHobbies] = useState("");

    const AVAILABLE_INTERESTS = ["Science & Tech", "Mathematics", "History", "Arts", "Literature", "Sports"];
    const AVAILABLE_BOARDS = ["CBSE", "ICSE", "State Board", "IB", "IGCSE", "Other"];

    useEffect(() => {
        if (user?.displayName || user?.full_name) {
            setName(user.displayName || user.full_name);
        }
    }, [user]);

    const handleInterestToggle = (interest) => {
        setInterests((prev) =>
            prev.includes(interest)
                ? prev.filter((i) => i !== interest)
                : [...prev, interest]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const onboardingData = {
            name,
            grade,
            board,
            interests,
            hobbies,
        };

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const token = user.getIdToken ? await user.getIdToken() : "mock_token";

            const response = await fetch(`${API_URL}/api/student/onboarding`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(onboardingData)
            });

            if (!response.ok) throw new Error("Failed to save onboarding data");

            // Save locally for UI state
            const userId = user?.uid || user?.id || 'guest';
            localStorage.setItem(`onboarding_completed_${userId}`, "true");

            // Close the modal
            if (onComplete) onComplete();
        } catch (err) {
            console.error("Onboarding error:", err);
            alert("Something went wrong. Please try again.");
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2>Welcome to the Family, {name ? name.split(" ")[0] : "Superstar"}! ✨</h2>
                    <p>We are so thrilled to have you here! Let's get to know you a little better so we can make this your best learning journey ever.</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.formContainer}>
                    {/* Name */}
                    <div className={styles.formGroup}>
                        <label htmlFor="name">What should we call you?</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={styles.textInput}
                            placeholder="Your awesome name..."
                            required
                        />
                    </div>

                    {/* Class & Board Row */}
                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label htmlFor="grade">Which class are you in?</label>
                            <select
                                id="grade"
                                value={grade}
                                onChange={(e) => setGrade(e.target.value)}
                                className={styles.selectInput}
                                required
                            >
                                {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                                    <option key={g} value={g}>
                                        Class {g}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="board">Which educational board?</label>
                            <select
                                id="board"
                                value={board}
                                onChange={(e) => setBoard(e.target.value)}
                                className={styles.selectInput}
                                required
                            >
                                {AVAILABLE_BOARDS.map((b) => (
                                    <option key={b} value={b}>
                                        {b}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Fun Interests */}
                    <div className={styles.formGroup}>
                        <label>What are you most excited to learn about? (Pick a few!)</label>
                        <div className={styles.chipContainer}>
                            {AVAILABLE_INTERESTS.map((interest) => (
                                <button
                                    key={interest}
                                    type="button"
                                    onClick={() => handleInterestToggle(interest)}
                                    className={`${styles.chip} ${interests.includes(interest) ? styles.chipSelected : ""}`}
                                >
                                    {interest} {interests.includes(interest) && "✓"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Hobbies / Free Time */}
                    <div className={styles.formGroup}>
                        <label htmlFor="hobbies">What do you love doing in your free time? 🎨🎮⚽</label>
                        <textarea
                            id="hobbies"
                            placeholder="I love playing football, coding mini-games, painting..."
                            value={hobbies}
                            onChange={(e) => setHobbies(e.target.value)}
                            className={styles.textArea}
                            rows={2}
                        />
                    </div>

                    {/* Submit */}
                    <div className={styles.modalFooter}>
                        <button type="submit" className={styles.submitBtn}>
                            Let's Go! 🚀
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
