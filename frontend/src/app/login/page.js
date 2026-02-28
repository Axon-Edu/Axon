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
        try {
            await signInWithPopup(auth, googleProvider);
            // AuthContext will handle profile fetch + redirect
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
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            if (err.code === "auth/user-not-found") {
                setError("No account found. Please sign up.");
            } else if (err.code === "auth/wrong-password") {
                setError("Incorrect password.");
            } else if (err.code === "auth/weak-password") {
                setError("Password must be at least 6 characters.");
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                {/* Brand */}
                <div className={styles.brand}>
                    <div className={styles.logo}>⚡</div>
                    <h1 className={styles.title}>Axon</h1>
                    <p className={styles.subtitle}>AI-Powered Learning for NCERT</p>
                </div>

                {/* Error */}
                {error && <div className={styles.error}>{error}</div>}

                {/* Google Sign-In */}
                <button
                    className={styles.googleBtn}
                    onClick={handleGoogleLogin}
                    disabled={loading}
                >
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                </button>

                <div className={styles.divider}>
                    <span>or</span>
                </div>

                {/* Email/Password Form */}
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
                        minLength={6}
                    />
                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={loading}
                    >
                        {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
                    </button>
                </form>

                <p className={styles.toggle}>
                    {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                    <button
                        type="button"
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError("");
                        }}
                    >
                        {isSignUp ? "Sign In" : "Sign Up"}
                    </button>
                </p>
            </div>
        </div>
    );
}
