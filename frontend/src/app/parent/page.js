"use client";

import { useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function ParentDashboard() {
    const { userProfile, logout } = useAuth();

    return (
        <ProtectedRoute allowedRoles={["parent"]}>
            <div style={{
                minHeight: "100vh",
                background: "linear-gradient(135deg, #0a0a1a, #1a0a2e, #0a1628)",
                color: "#fff",
                padding: "2rem",
                maxWidth: "900px",
                margin: "0 auto",
            }}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                    <div>
                        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                            Welcome, {userProfile?.full_name?.split(" ")[0] || "Parent"} 👋
                        </h1>
                        <p style={{ color: "rgba(255,255,255,0.5)", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
                            Here&apos;s how your child is doing
                        </p>
                    </div>
                    <button onClick={logout} style={{
                        padding: "0.5rem 1rem", borderRadius: "10px",
                        border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
                        color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "0.85rem"
                    }}>Sign Out</button>
                </header>

                <div style={{
                    padding: "2rem", textAlign: "center",
                    background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)",
                    borderRadius: "16px", color: "rgba(255,255,255,0.4)"
                }}>
                    <p>📊 Parent dashboard coming soon — this is a Phase 7 feature.</p>
                    <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                        You&apos;ll see your child&apos;s activity, session summaries, and WhatsApp notifications here.
                    </p>
                </div>
            </div>
        </ProtectedRoute>
    );
}
