"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import styles from "./ProfilePopup.module.css";

export default function ProfilePopup({ isOpen, onClose }) {
    const { user, userProfile, logout } = useAuth();
    const [notifications, setNotifications] = useState(true);

    if (!isOpen) return null;

    const handleLogout = async () => {
        await logout();
        onClose();
    };

    return (
        <>
            <div className={styles.backdrop} onClick={onClose} />
            <div className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div className={styles.panelTitle}>Profile</div>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.profileSection}>
                    <div className={styles.avatarLarge}>👤</div>
                    <div className={styles.profileName}>
                        {userProfile?.full_name || "Student"}
                    </div>
                    <div className={styles.profileEmail}>
                        {user?.email || "student@axon.edu"}
                    </div>
                    <div className={styles.profileBadge}>
                        {userProfile?.role || "Student"}
                    </div>
                </div>

                <div className={styles.settingsSection}>
                    <div className={styles.settingsLabel}>Settings</div>

                    <div className={styles.settingItem}>
                        <div className={styles.settingIcon}>🎨</div>
                        <div className={styles.settingInfo}>
                            <div className={styles.settingName}>Appearance</div>
                            <div className={styles.settingSub}>Use theme toggle on screen</div>
                        </div>
                        <span className={styles.settingArrow}>›</span>
                    </div>

                    <div className={styles.settingItem} onClick={() => setNotifications(!notifications)}>
                        <div className={styles.settingIcon}>🔔</div>
                        <div className={styles.settingInfo}>
                            <div className={styles.settingName}>Notifications</div>
                            <div className={styles.settingSub}>Session reminders & updates</div>
                        </div>
                        <button className={`${styles.toggle} ${notifications ? styles.active : ""}`}>
                            <div className={styles.toggleKnob} />
                        </button>
                    </div>

                    <div className={styles.settingItem}>
                        <div className={styles.settingIcon}>📚</div>
                        <div className={styles.settingInfo}>
                            <div className={styles.settingName}>Learning Preferences</div>
                            <div className={styles.settingSub}>Pace, difficulty, language</div>
                        </div>
                        <span className={styles.settingArrow}>›</span>
                    </div>

                    <div className={styles.settingItem}>
                        <div className={styles.settingIcon}>🔒</div>
                        <div className={styles.settingInfo}>
                            <div className={styles.settingName}>Privacy & Security</div>
                            <div className={styles.settingSub}>Password, data controls</div>
                        </div>
                        <span className={styles.settingArrow}>›</span>
                    </div>

                    <div className={styles.settingItem}>
                        <div className={styles.settingIcon}>ℹ️</div>
                        <div className={styles.settingInfo}>
                            <div className={styles.settingName}>About Axon</div>
                            <div className={styles.settingSub}>Version 1.0.0</div>
                        </div>
                        <span className={styles.settingArrow}>›</span>
                    </div>
                </div>

                <div className={styles.logoutSection}>
                    <button className={styles.logoutBtn} onClick={handleLogout}>
                        Sign Out
                    </button>
                </div>
            </div>
        </>
    );
}
