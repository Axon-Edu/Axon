import styles from './ui.module.css';

export default function Card({ children, className = '', blob = false, ...props }) {
    return (
        <div className={`${styles.card} ${className}`} {...props}>
            {blob && (
                <svg className={styles.cardBlob} viewBox="0 0 140 130" style={{ top: -20, left: -20, width: 140, height: 130 }}>
                    <ellipse cx="30" cy="50" rx="60" ry="25" transform="rotate(-30 30 50)" fill="currentColor" />
                </svg>
            )}
            <div style={{ position: 'relative', zIndex: 1 }}>
                {children}
            </div>
        </div>
    );
}
