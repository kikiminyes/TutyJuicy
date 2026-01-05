import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../../stores/cartStore';
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import styles from './CartSidebar.module.css';
import { useNavigate } from 'react-router-dom';

export const CartSidebar: React.FC = () => {
    const { t } = useTranslation();
    const { items, isOpen, toggleCart, updateQuantity, removeItem, totalPrice, totalItems, clearCart } = useCart();
    const navigate = useNavigate();

    const [isClosing, setIsClosing] = useState(false);
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const contentRef = useRef<HTMLDivElement>(null);

    // Lock body scroll when bottom sheet is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
        } else {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        }

        return () => {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        };
    }, [isOpen]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            toggleCart();
            setIsClosing(false);
            setDragY(0);
        }, 250);
    }, [toggleCart]);

    const handleCheckout = () => {
        setIsClosing(true);
        setTimeout(() => {
            toggleCart();
            setIsClosing(false);
            navigate('/checkout');
        }, 250);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleClose();
        }
    };

    // Check if content is scrolled to top
    const isContentAtTop = () => {
        if (!contentRef.current) return true;
        return contentRef.current.scrollTop <= 0;
    };

    // Touch handlers for swipe down on entire sheet
    const handleTouchStart = (e: React.TouchEvent) => {
        // Only start drag if content is at top or touching non-scrollable area
        if (isContentAtTop()) {
            startY.current = e.touches[0].clientY;
            setIsDragging(true);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;

        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        // Only allow dragging down
        if (diff > 0) {
            // Prevent default to stop background scroll
            e.preventDefault();
            setDragY(diff);
        } else {
            // If trying to scroll up, cancel drag and allow normal scroll
            setIsDragging(false);
            setDragY(0);
        }
    };

    const handleTouchEnd = () => {
        if (!isDragging) return;

        setIsDragging(false);
        // If dragged more than 80px, close the sheet
        if (dragY > 80) {
            handleClose();
        } else {
            setDragY(0);
        }
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(price);
    };

    if (!isOpen) return null;

    const sheetStyle: React.CSSProperties = {
        transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
        transition: isDragging ? 'none' : undefined,
    };

    // Calculate overlay opacity based on drag
    const overlayStyle: React.CSSProperties = dragY > 0 ? {
        opacity: Math.max(0, 1 - dragY / 300),
    } : {};

    return (
        <>
            <div
                className={`${styles.overlay} ${isClosing ? styles.overlayClosing : ''}`}
                style={overlayStyle}
                onClick={handleClose}
                aria-hidden="true"
            />
            <div
                className={`${styles.sheet} ${isClosing ? styles.sheetClosing : ''}`}
                style={sheetStyle}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cart-title"
                onKeyDown={handleKeyDown}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Drag Handle */}
                <div className={styles.handleBar}>
                    <div className={styles.handle} />
                </div>

                {/* Header */}
                <header className={styles.header}>
                    <div className={styles.headerTitle}>
                        <h2 id="cart-title">{t('cart.title')}</h2>
                        {totalItems > 0 && (
                            <span className={styles.badge}>{totalItems}</span>
                        )}
                    </div>
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
                </header>

                {/* Content */}
                <div
                    ref={contentRef}
                    className={styles.content}
                    onTouchStart={(e) => {
                        // Re-check if we should start dragging when touching content
                        if (isContentAtTop()) {
                            startY.current = e.touches[0].clientY;
                            setIsDragging(true);
                        }
                    }}
                >
                    {items.length === 0 ? (
                        <div className={styles.empty}>
                            <div className={styles.emptyIcon}>
                                <ShoppingBag size={56} strokeWidth={1} />
                            </div>
                            <h3>{t('cart.empty')}</h3>
                            <p>{t('cart.emptyMessage')}</p>
                            <button onClick={handleClose} className={styles.shopBtn}>
                                {t('cart.continueShopping')}
                            </button>
                        </div>
                    ) : (
                        <ul className={styles.list}>
                            {items.map((item) => (
                                <li key={item.id} className={styles.item}>
                                    {/* Product Image */}
                                    <div className={styles.itemImage}>
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.name} />
                                        ) : (
                                            <div className={styles.imagePlaceholder}>
                                                <ShoppingBag size={20} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Product Details */}
                                    <div className={styles.itemDetails}>
                                        <div className={styles.itemTop}>
                                            <h4>{item.name}</h4>
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => removeItem(item.id)}
                                                aria-label={`Remove ${item.name}`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <span className={styles.itemUnit}>{formatPrice(item.price)}</span>

                                        <div className={styles.itemBottom}>
                                            <div className={styles.stepper}>
                                                <button
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                    disabled={item.quantity <= 1}
                                                    aria-label="Decrease"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span>{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                    aria-label="Increase"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                            <span className={styles.itemTotal}>
                                                {formatPrice(item.price * item.quantity)}
                                            </span>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <footer className={styles.footer}>
                        <div className={styles.summary}>
                            <div className={styles.summaryRow}>
                                <span>Subtotal</span>
                                <span>{formatPrice(totalPrice)}</span>
                            </div>
                            <div className={styles.summaryTotal}>
                                <span>{t('common.total')}</span>
                                <span>{formatPrice(totalPrice)}</span>
                            </div>
                        </div>
                        <button className={styles.checkoutBtn} onClick={handleCheckout}>
                            {t('common.checkout')}
                            <ArrowRight size={18} />
                        </button>
                    </footer>
                )}
            </div>
        </>
    );
};
