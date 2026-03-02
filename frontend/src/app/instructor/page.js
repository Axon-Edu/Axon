"use client";

import { useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function InstructorDashboard() {
    const { userProfile, logout } = useAuth();

    return (
        <ProtectedRoute allowedRoles={["instructor"]}>
            <div style={{
                minHeight: "100vh",
                color: "var(--text-primary)",
                padding: "2rem",
                maxWidth: "1100px",
                margin: "0 auto",
            }}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                    <div>
                        <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
                            Instructor Dashboard
                        </h1>
                        <p style={{ color: "var(--text-secondary)", margin: "0.25rem 0 0", fontSize: "1rem" }}>
                            Upload content and manage chapters
                        </p>
                    </div>
                    <Button variant="secondary" onClick={logout}>Sign Out</Button>
                </header>

                <Card style={{ textAlign: "center", padding: "3rem" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "1.05rem" }}>
                        📄 Content upload & RAG ingestion pipeline — Phase 1 feature.
                    </p>
                    <p style={{ fontSize: "0.9rem", marginTop: "0.75rem", color: "var(--text-muted)" }}>
                        Upload NCERT PDFs, chapter roadmaps, and question banks here.
                    </p>
                </Card>
            </div>
        </ProtectedRoute>
    );
}
