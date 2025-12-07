import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'default' | 'warning' | 'danger';
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    variant = 'default',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
}) => {
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            await onConfirm();
        } finally {
            setIsLoading(false);
        }
    };

    const getIcon = () => {
        switch (variant) {
            case 'danger':
                return <AlertTriangle size={48} className={styles.iconDanger} />;
            case 'warning':
                return <AlertCircle size={48} className={styles.iconWarning} />;
            default:
                return <Info size={48} className={styles.iconDefault} />;
        }
    };

    const getConfirmVariant = (): 'primary' | 'secondary' | undefined => {
        if (variant === 'danger') return 'primary'; // Use primary (red-ish) for danger
        return 'secondary'; // Use secondary (green) for default and warning
    };

    return (
        <div className={styles.overlay} onClick={onCancel}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.content}>
                    {getIcon()}

                    <h2 className={styles.title}>{title}</h2>

                    <p className={styles.message}>{message}</p>
                </div>

                <div className={styles.actions}>
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={getConfirmVariant()}
                        onClick={handleConfirm}
                        isLoading={isLoading}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
};
