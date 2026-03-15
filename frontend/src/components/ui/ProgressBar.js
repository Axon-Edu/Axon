import styles from './ui.module.css';

export default function ProgressBar({ progress = 0, color = 'green', className = '' }) {
    const colorClass = styles[`progress${color.charAt(0).toUpperCase() + color.slice(1)}`] || styles.progressGreen;
    return (
        <div className={`${styles.progressTrack} ${className}`}>
            <div
                className={`${styles.progressFill} ${colorClass}`}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
        </div>
    );
}
