"use client";

/**
 * AuthContext — provides Firebase auth state and user role
 * throughout the application.
 */

import { createContext, useContext, useEffect, useState } from "react";
import { auth, onAuthStateChanged, signOut, isMockKey } from "@/lib/firebase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const AuthContext = createContext({
    user: null,
    userProfile: null,
    loading: true,
    logout: async () => { },
});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth) {
            setTimeout(() => setLoading(false), 0);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                // Fetch user profile from backend
                try {
                    const token = await firebaseUser.getIdToken();
                    const res = await fetch(`${API_URL}/api/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) {
                        const profile = await res.json();
                        setUserProfile(profile);
                    } else if (res.status === 404) {
                        // User not registered in backend yet — register them
                        const regRes = await fetch(`${API_URL}/api/auth/register`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (regRes.ok) {
                            const profile = await regRes.json();
                            setUserProfile(profile);
                        }
                    }
                } catch (err) {
                    console.error("Error fetching user profile:", err);
                }
            } else if (!auth || isMockKey) {
                // Mock user for UI presentation when Firebase keys are invalid
                setUser({ uid: "mock-user-123", email: "mock@example.com" });
                setUserProfile({ full_name: "Mock Student", role: "student" });
            } else {
                setUser(null);
                setUserProfile(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        await signOut(auth);
        setUser(null);
        setUserProfile(null);
    };

    return (
        <AuthContext.Provider value={{ user, userProfile, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
