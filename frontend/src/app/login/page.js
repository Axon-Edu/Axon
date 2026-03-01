"use client";

/**
 * Login page with Google OAuth and email/password auth.
 * Dark theme with vibrant accent colors.
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
        e.preventDefault();
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
                    <span className={styles.active}></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>

                <div className={styles.topBar}>
                    <div className={styles.logoIcon}>⚡</div>
                    <span className={styles.topBarText}>What's new?</span>
                    <span className={styles.topBarTime}>6h</span>
                </div>

                <div className={styles.content}>
                    <div className={styles.badge}>Axon AI</div>
                    <h1 className={styles.title}>Start your training<br />and see results</h1>
                    <p className={styles.desc}>Unlock the secrets of exceptional learning with our AI-powered NCERT guide.</p>

                    {error && <div className={styles.error}>{error}</div>}

                    <form onSubmit={handleEmailAuth} className={styles.form}>
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
                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? "..." : isSignUp ? "Create Account" : "Sign In"}
                        </button>
                    </form>

                    <div className={styles.signupToggle}>
                        {isSignUp ? "Already have an account? " : "Don't have an account? "}
                        <span onClick={() => setIsSignUp(!isSignUp)}>
                            {isSignUp ? "Sign In" : "Sign Up"}
                        </span>
                    </div>
                </div>

                <div className={styles.blobArt}>
                    <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <ellipse cx="60" cy="160" rx="40" ry="90" transform="rotate(-20 60 160)" fill="var(--vibrant-pink)" opacity="0.4" />
                        <ellipse cx="160" cy="170" rx="38" ry="85" transform="rotate(-10 160 170)" fill="var(--vibrant-purple)" opacity="0.4" />
                        <ellipse cx="260" cy="155" rx="42" ry="95" transform="rotate(15 260 155)" fill="var(--vibrant-green)" opacity="0.4" />
                    </svg>
                </div>

                <div className={styles.actions}>
                    <div className={styles.loginBtn} onClick={handleGoogleLogin}>
                        Continue as Guest <span className={styles.arrows}>{" >>>"}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
