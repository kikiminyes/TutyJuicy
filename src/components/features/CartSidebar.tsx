import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../../stores/cartStore';
import { Button } from '../ui/Button';
import { X, Plus, Minus, Trash2 } from 'lucide-react';
import styles from './CartSidebar.module.css';
import { useNavigate } from 'react-router-dom';
import { EmptyCartState } from './EmptyCartState';

export const CartSidebar: React.FC = () => {
    const { t } = useTranslation();
    const { items, isOpen, toggleCart, updateQuantity, removeItem, totalPrice, clearCart } = useCart();
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleCheckout = () => {
        toggleCart();
        navigate('/checkout');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            toggleCart();
        }
    };

    return (
        <>
            <div
                className={styles.overlay}
                onClick={toggleCart}
                aria-hidden="true"
            />
            <div
                className={styles.sidebar}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cart-sidebar-title"
                onKeyDown={handleKeyDown}
            >
                <div className={styles.dragHandle} onClick={toggleCart}>
                    <div className={styles.dragIndicator} />
                </div>
                <div className={styles.header}>
                    <h2 id="cart-sidebar-title" className={styles.title}>
                        {t('cart.title')}
                    </h2>
                    <div className={styles.headerActions}>
                        {items.length > 0 && (
                            <button
                                onClick={() => {
                                    if (window.confirm(t('cart.confirmClear'))) {
                                        clearCart();
                                    }
                                }}
                                className={styles.clearBtn}
                            >
                                {t('cart.clear')}
                            </button>
                        )}
                        <button
                            onClick={toggleCart}
                            className={styles.closeBtn}
                            aria-label={t('common.cancel')}
                        >
                            <X size={24} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div className={styles.items}>
                    {items.length === 0 ? (
                        <EmptyCartState variant="sidebar" onClose={toggleCart} />
                    ) : (
                        items.map((item) => (
                            <div key={item.id} className={styles.item}>
                                <div className={styles.itemInfo}>
                                    <h4 className={styles.itemName}>{item.name}</h4>
                                    <p className={styles.itemPrice}>
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price)}
                                    </p>
                                </div>

                                <div className={styles.controls} role="group" aria-label={`${t('cart.item')} controls for ${item.name}`}>
                                    <button
                                        className={styles.qtyBtn}
                                        onClick={() => updateQuantity(item.id, -1)}
                                        disabled={item.quantity <= 1}
                                        aria-label={`Decrease quantity of ${item.name}`}
                                    >
                                        <Minus size={16} aria-hidden="true" />
                                    </button>
                                    <span className={styles.quantity} aria-live="polite">
                                        {item.quantity}
                                    </span>
                                    <button
                                        className={styles.qtyBtn}
                                        onClick={() => updateQuantity(item.id, 1)}
                                        aria-label={`Increase quantity of ${item.name}`}
                                    >
                                        <Plus size={16} aria-hidden="true" />
                                    </button>
                                    <button
                                        className={styles.removeBtn}
                                        onClick={() => removeItem(item.id)}
                                        aria-label={`Remove ${item.name} from cart`}
                                    >
                                        <Trash2 size={18} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {items.length > 0 && (
                    <div className={styles.footer}>
                        <div className={styles.totalRow}>
                            <span>{t('common.total')}</span>
                            <span className={styles.totalPrice}>
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalPrice)}
                            </span>
                        </div>
                        <Button className="w-full" size="lg" onClick={handleCheckout}>
                            {t('cart.payment')}
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
};
