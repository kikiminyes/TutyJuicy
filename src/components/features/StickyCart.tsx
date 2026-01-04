import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../../stores/cartStore';
import { ShoppingBag, ChevronUp } from 'lucide-react';
import styles from './StickyCart.module.css';

export const StickyCart: React.FC = () => {
    const { t } = useTranslation();
    const { totalItems, totalPrice, toggleCart } = useCart();

    if (totalItems === 0) return null;

    const handleOpenCart = () => {
        toggleCart();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpenCart();
        }
    };

    return (
        <div className={styles.stickyContainer}>
            <div
                className={styles.cartBanner}
                onClick={handleOpenCart}
                onKeyDown={handleKeyDown}
                role="button"
                tabIndex={0}
                aria-label={`${t('cart.title')}: ${totalItems} ${totalItems > 1 ? t('cart.items') : t('cart.item')}`}
            >
                <div className={styles.info}>
                    <ShoppingBag size={20} aria-hidden="true" />
                    <span className={styles.itemCount}>
                        {totalItems} {totalItems > 1 ? t('cart.items') : t('cart.item')}
                    </span>
                    <span className={styles.totalPrice}>
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalPrice)}
                    </span>
                </div>
                <div className={styles.action}>
                    {t('cart.viewCart')}
                    <ChevronUp size={18} aria-hidden="true" />
                </div>
            </div>
        </div>
    );
};
