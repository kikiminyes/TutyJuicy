import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../../stores/cartStore';
import { ChevronRight } from 'lucide-react';
import styles from './StickyCart.module.css';

export const StickyCart: React.FC = () => {
    const { t } = useTranslation();
    const { totalItems, totalPrice } = useCart();
    const navigate = useNavigate();

    if (totalItems === 0) return null;

    const handleCheckout = () => {
        navigate('/checkout');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCheckout();
        }
    };

    return (
        <div className={styles.stickyContainer}>
            <div
                className={styles.cartBanner}
                onClick={handleCheckout}
                onKeyDown={handleKeyDown}
                role="button"
                tabIndex={0}
                aria-label={`${t('common.checkout')}: ${totalItems} ${totalItems > 1 ? t('cart.items') : t('cart.item')}`}
            >
                <div className={styles.info}>
                    <span className={styles.itemCount}>
                        {totalItems} {totalItems > 1 ? t('cart.items') : t('cart.item')}
                    </span>
                    <span className={styles.totalPrice}>
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalPrice)}
                    </span>
                </div>
                <div className={styles.action}>
                    {t('common.checkout')}
                    <ChevronRight size={18} aria-hidden="true" />
                </div>
            </div>
        </div>
    );
};
