"use client";

/**
 * ProtectedRoute — role-based access control wrapper.
 * Redirects unauthenticated users to login and
 * unauthorized roles to their correct dashboard.
 */

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ROLE_DASHBOARDS = {
    student: "/student",
    parent: "/parent",
    instructor: "/instructor",
    admin: "/admin",
};

export default function ProtectedRoute({ allowedRoles, children }) {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        if (!user) {
            router.push("/login");
            return;
        }

        if (userProfile && !allowedRoles.includes(userProfile.role)) {
            // Redirect to correct dashboard
            const correctDashboard = ROLE_DASHBOARDS[userProfile.role] || "/login";
            router.push(correctDashboard);
        }
    }, [user, userProfile, loading, allowedRoles, router]);

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner" />
                <p>Loading Axon...</p>
            </div>
        );
    }

    if (!user || (userProfile && !allowedRoles.includes(userProfile.role))) {
        return null;
    }

    return children;
}
