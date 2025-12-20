import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import styles from './EmptyCartState.module.css';

interface EmptyCartStateProps {
    variant?: 'page' | 'sidebar';
    onClose?: () => void;
}

export const EmptyCartState: React.FC<EmptyCartStateProps> = ({
    variant = 'page',
    onClose
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleBackToMenu = () => {
        if (onClose) onClose();
        navigate('/');
    };

    if (variant === 'sidebar') {
        return (
            <div className={styles.sidebarEmpty}>
                <div className={styles.iconWrapper}>
                    <ShoppingBag size={40} aria-hidden="true" />
                </div>
                <p className={styles.message}>{t('cart.emptyMessage')}</p>
                <Button
                    variant="outline"
                    onClick={handleBackToMenu}
                    aria-label={t('cart.continueShopping')}
                >
                    {t('cart.continueShopping')}
                </Button>
            </div>
        );
    }

    return (
        <div className={styles.container} role="main" aria-labelledby="empty-cart-title">
            <div className={styles.card}>
                <div className={styles.iconWrapper}>
                    <ShoppingBag size={56} aria-hidden="true" />
                </div>
                <h2 id="empty-cart-title" className={styles.title}>
                    {t('cart.empty')}
                </h2>
                <p className={styles.message}>
                    {t('cart.emptyMessage')}
                </p>
                <button
                    className={styles.ctaButton}
                    onClick={handleBackToMenu}
                    aria-label={t('cart.backToMenu')}
                >
                    <ArrowLeft size={18} aria-hidden="true" />
                    {t('cart.backToMenu')}
                </button>
            </div>
        </div>
    );
};
