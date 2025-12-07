import React from 'react';
import { useCart } from '../../context/CartContext';
import { Button } from '../ui/Button';
import { X, Plus, Minus, Trash2 } from 'lucide-react';
import styles from './CartSidebar.module.css';
import { useNavigate } from 'react-router-dom';

export const CartSidebar: React.FC = () => {
    const { items, isOpen, toggleCart, updateQuantity, removeItem, totalPrice } = useCart();
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleCheckout = () => {
        toggleCart();
        navigate('/checkout');
    };

    return (
        <>
            <div className={styles.overlay} onClick={toggleCart} />
            <div className={styles.sidebar}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Keranjang Belanja</h2>
                    <button onClick={toggleCart} className={styles.closeBtn}>
                        <X size={24} />
                    </button>
                </div>

                <div className={styles.items}>
                    {items.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>Keranjang Anda kosong.</p>
                            <Button variant="outline" onClick={toggleCart} className="mt-4">
                                Lanjut Belanja
                            </Button>
                        </div>
                    ) : (
                        items.map((item) => (
                            <div key={item.id} className={styles.item}>
                                <div className={styles.itemInfo}>
                                    <h4 className={styles.itemName}>{item.name}</h4>
                                    <p className={styles.itemPrice}>
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price)}
                                    </p>
                                </div>

                                <div className={styles.controls}>
                                    <button
                                        className={styles.qtyBtn}
                                        onClick={() => updateQuantity(item.id, -1)}
                                        disabled={item.quantity <= 1}
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <span className={styles.quantity}>{item.quantity}</span>
                                    <button
                                        className={styles.qtyBtn}
                                        onClick={() => updateQuantity(item.id, 1)}
                                    >
                                        <Plus size={16} />
                                    </button>
                                    <button
                                        className={styles.removeBtn}
                                        onClick={() => removeItem(item.id)}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {items.length > 0 && (
                    <div className={styles.footer}>
                        <div className={styles.totalRow}>
                            <span>Total</span>
                            <span className={styles.totalPrice}>
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalPrice)}
                            </span>
                        </div>
                        <Button className="w-full" size="lg" onClick={handleCheckout}>
                            Pembayaran
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
};
