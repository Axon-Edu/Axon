import styles from './ui.module.css';

export default function Button({ children, variant = 'primary', className = '', ...props }) {
  const variantClass = variant === 'primary' ? styles.btnPrimary : 
                       variant === 'danger' ? styles.btnDanger : styles.btnSecondary;
  return (
    <button className={`${styles.button} ${variantClass} ${className}`} {...props}>
      {children}
    </button>
  );
}
