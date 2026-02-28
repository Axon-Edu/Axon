"use client";

/**
 * Homepage — redirects to login or appropriate dashboard.
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

export default function HomePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user && userProfile) {
      router.push(ROLE_DASHBOARDS[userProfile.role] || "/student");
    } else {
      router.push("/login");
    }
  }, [user, userProfile, loading, router]);

  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Loading Axon...</p>
    </div>
  );
}
