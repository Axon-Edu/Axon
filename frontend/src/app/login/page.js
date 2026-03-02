"use client";

/**
 * Login page with Google OAuth and email/password auth.
 * Redesigned to exact Screen 1 specifications.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    auth,
    googleProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    isMockKey,
} from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { useEffect } from "react";
import styles from "./login.module.css";

const ROLE_DASHBOARDS = {
    student: "/student",
    parent: "/parent",
    instructor: "/instructor",
    admin: "/admin",
};

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { user, userProfile } = useAuth();

    // Redirect if already logged in
    useEffect(() => {
        if (user && userProfile) {
            const dashboard = ROLE_DASHBOARDS[userProfile.role] || "/student";
            router.push(dashboard);
        }
    }, [user, userProfile, router]);

    const handleGoogleLogin = async () => {
        setError("");
        setLoading(true);
        if (!auth || isMockKey) {
            setTimeout(() => {
                router.push("/student");
            }, 800);
            return;
        }
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e) => {
        if (e) e.preventDefault();
        setError("");
        setLoading(true);
        if (!auth || isMockKey) {
            setTimeout(() => {
                router.push("/student");
            }, 800);
            return;
        }
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="phoneShell">
            <div className={styles.container}>
                <div className={styles.progressBar}>
                    <span className={styles.progressActive}></span>
                    <span className={styles.progressSegment}></span>
                    <span className={styles.progressSegment}></span>
                    <span className={styles.progressSegment}></span>
                </div>

                <div className={styles.topBar}>
                    <div className={styles.logoIcon}>🎵</div>
                    <span className={styles.topBarText}>What's new?</span>
                    <span className={styles.topBarTime}>6h</span>
                    <div className={styles.closeBtn}>✕</div>
                </div>

                <div className={styles.content}>
                    <div className={styles.badge}>IT Courses</div>
                    <h1 className={styles.title}>Start your training<br />and see results</h1>
                    <p className={styles.desc}>Unlock the secrets of exceptional user interface (UI) and user experience (UX) design with our courses.</p>

                    {error && <div className={styles.error}>{error}</div>}

                    <form onSubmit={handleEmailAuth} className={styles.authForm}>
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={styles.input}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={styles.input}
                            required
                        />
                        <div className={styles.signupToggle}>
                            {isSignUp ? "Already have an account? " : "Don't have an account? "}
                            <span onClick={() => setIsSignUp(!isSignUp)}>
                                {isSignUp ? "Sign In" : "Sign Up"}
                            </span>
                        </div>
                    </form>
                </div>

                <div className={styles.blobArt}>
                    <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <ellipse cx="60" cy="160" rx="40" ry="90" transform="rotate(-20 60 160)" fill="#f5a8d4" opacity="0.9" />
                        <ellipse cx="90" cy="130" rx="35" ry="80" transform="rotate(-15 90 130)" fill="#f5a8d4" opacity="0.8" />
                        <ellipse cx="160" cy="170" rx="38" ry="85" transform="rotate(-10 160 170)" fill="#b89af5" opacity="0.85" />
                        <ellipse cx="185" cy="140" rx="30" ry="75" transform="rotate(-5 185 140)" fill="#b89af5" opacity="0.7" />
                        <ellipse cx="260" cy="155" rx="42" ry="95" transform="rotate(15 260 155)" fill="#c8f55a" opacity="0.85" />
                        <ellipse cx="235" cy="175" rx="32" ry="70" transform="rotate(10 235 175)" fill="#c8f55a" opacity="0.7" />
                        <ellipse cx="140" cy="185" rx="50" ry="30" fill="#0d0d0d" opacity="0.4" />
                        <ellipse cx="200" cy="185" rx="45" ry="25" fill="#0d0d0d" opacity="0.3" />
                    </svg>
                </div>

                <div className={styles.actions}>
                    <div className={styles.cancelBtn}>✕</div>
                    <div className={styles.continueBtn} onClick={handleEmailAuth}>
                        Continue <span className={styles.arrows}>{" >>>"}</span>
                    </div>
                    <div className={styles.nextBtn} onClick={handleGoogleLogin}>→</div>
                </div>
            </div>
        </div>
    );
}
