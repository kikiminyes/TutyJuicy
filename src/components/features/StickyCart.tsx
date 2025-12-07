import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { ChevronRight } from 'lucide-react';
import styles from './StickyCart.module.css';

export const StickyCart: React.FC = () => {
    const { totalItems, totalPrice } = useCart();
    const navigate = useNavigate();

    if (totalItems === 0) return null;

    const handleCheckout = () => {
        navigate('/checkout');
    };

    return (
        <div className={styles.stickyContainer}>
            <div className={styles.cartBanner} onClick={handleCheckout}>
                <div className={styles.info}>
                    <span className={styles.itemCount}>
                        {totalItems} Item{totalItems > 1 ? 's' : ''}
                    </span>
                    <span className={styles.totalPrice}>
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalPrice)}
                    </span>
                </div>
                <div className={styles.action}>
                    Checkout
                    <ChevronRight size={18} />
                </div>
            </div>
        </div>
    );
};
