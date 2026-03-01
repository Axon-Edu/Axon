"use client";

import { useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function ParentDashboard() {
    const { userProfile, logout } = useAuth();

    return (
        <ProtectedRoute allowedRoles={["parent"]}>
            <div style={{
                minHeight: "100vh",
                color: "var(--text-primary)",
                padding: "2rem",
                maxWidth: "900px",
                margin: "0 auto",
            }}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                    <div>
                        <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
                            Welcome, {userProfile?.full_name?.split(" ")[0] || "Parent"} 👋
                        </h1>
                        <p style={{ color: "var(--text-secondary)", margin: "0.25rem 0 0", fontSize: "1rem" }}>
                            Here&apos;s how your child is doing
                        </p>
                    </div>
                    <Button variant="secondary" onClick={logout}>Sign Out</Button>
                </header>

                <Card style={{ textAlign: "center", padding: "3rem" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "1.05rem" }}>
                        📊 Parent dashboard coming soon — this is a Phase 7 feature.
                    </p>
                    <p style={{ fontSize: "0.9rem", marginTop: "0.75rem", color: "var(--text-muted)" }}>
                        You&apos;ll see your child&apos;s activity, session summaries, and WhatsApp notifications here.
                    </p>
                </Card>
            </div>
        </ProtectedRoute>
    );
}
