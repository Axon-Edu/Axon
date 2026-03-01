import styles from './ui.module.css';

export default function Chip({ children, color = 'green', icon = null, className = '', ...props }) {
    const colorClass = styles[`chip${color.charAt(0).toUpperCase() + color.slice(1)}`] || styles.chipGreen;
    return (
        <div className={`${styles.chip} ${colorClass} ${className}`} {...props}>
            {icon && <span>{icon}</span>}
            {children}
        </div>
    );
}
