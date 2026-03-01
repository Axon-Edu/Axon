import styles from './ui.module.css';

export default function ChatBubble({ message, type = 'ai', className = '' }) {
    const isUser = type === 'user';
    return (
        <div className={`${styles.chatBubbleWrapper} ${isUser ? styles.user : styles.ai} ${className}`}>
            <div className={`${styles.chatBubble} ${isUser ? styles.user : styles.ai}`}>
                {message}
            </div>
        </div>
    );
}
