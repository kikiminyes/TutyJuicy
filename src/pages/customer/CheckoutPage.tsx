import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, User, Phone, FileText, ChevronDown, ChevronUp, Trash2, Minus, Plus, Check } from 'lucide-react';
import styles from './CheckoutPage.module.css';
import toast from 'react-hot-toast';
import { normalizePhone, validateName, validatePhone, validateAddress, type CheckoutFormData } from '../../utils/validation';
import useFieldValidation from '../../hooks/useFieldValidation';

export const CheckoutPage: React.FC = () => {
    const { items, totalPrice, totalItems, clearCart, updateQuantity, removeItem } = useCart();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [isOrderExpanded, setIsOrderExpanded] = useState(true);

    const [formData, setFormData] = useState<CheckoutFormData>({
        name: '',
        phone: '',
        address: '',
    });
    const [isFormLoading, setIsFormLoading] = useState(false);

    const nameValidation = useFieldValidation(formData.name, validateName);
    const phoneValidation = useFieldValidation(formData.phone, validatePhone);
    const addressValidation = useFieldValidation(formData.address, validateAddress);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(price);
    };

    if (items.length === 0) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                    <ShoppingBag size={48} />
                </div>
                <h2 className={styles.emptyTitle}>Keranjang Kosong</h2>
                <p className={styles.emptyText}>Belum ada item di keranjang belanja Anda.</p>
                <button className={styles.backToMenuBtn} onClick={() => navigate('/')}>
                    <ArrowLeft size={18} />
                    Kembali ke Menu
                </button>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Immediate synchronous validation on submit (force-check)
        const nameResult = validateName(formData.name);
        const phoneResult = validatePhone(formData.phone);
        const addressResult = validateAddress(formData.address);

        const errors: Partial<Record<keyof CheckoutFormData, string>> = {};
        if (!nameResult.isValid) errors.name = nameResult.error;
        if (!phoneResult.isValid) errors.phone = phoneResult.error;
        if (!addressResult.isValid) errors.address = addressResult.error;

        if (Object.keys(errors).length > 0) {
            // mark all fields touched so inline errors show
            nameValidation.markTouched(true);
            phoneValidation.markTouched(true);
            addressValidation.markTouched(true);
            toast.error('Mohon lengkapi data dengan benar');
            return;
        }

        setIsFormLoading(true);
        setIsLoading(true);

        try {
            const { data: batch, error: batchError } = await supabase
                .from('batches')
                .select('id, status')
                .eq('status', 'open')
                .single();

            if (batchError || !batch) {
                toast.error('Batch pre-order telah ditutup.');
                navigate('/');
                return;
            }

            const menuIds = items.map(item => item.id);
            const { data: stockData, error: stockError } = await supabase
                .from('batch_stocks')
                .select('menu_id, quantity_available, menus!inner(name)')
                .eq('batch_id', batch.id)
                .in('menu_id', menuIds);

            if (stockError) {
                toast.error('Gagal memverifikasi stok.');
                return;
            }

            const outOfStockItems: string[] = [];
            const insufficientStockItems: { name: string; available: number; requested: number }[] = [];

            for (const cartItem of items) {
                const stockItem = stockData?.find(s => s.menu_id === cartItem.id);
                if (!stockItem) {
                    outOfStockItems.push(cartItem.name);
                    continue;
                }

                // Use quantity_available directly (consistent with the atomic function)
                const available = stockItem.quantity_available;
                if (available < cartItem.quantity) {
                    if (available <= 0) {
                        outOfStockItems.push(cartItem.name);
                    } else {
                        insufficientStockItems.push({
                            name: cartItem.name,
                            available: available,
                            requested: cartItem.quantity
                        });
                    }
                }
            }

            if (outOfStockItems.length > 0) {
                toast.error(`Habis: ${outOfStockItems.join(', ')}`);
                return;
            }

            if (insufficientStockItems.length > 0) {
                const msg = insufficientStockItems.map(
                    item => `${item.name}: sisa ${item.available}`
                ).join(', ');
                toast.error(`Stok tidak cukup: ${msg}`);
                return;
            }

            const orderItems = items.map(item => ({
                menu_id: item.id,
                quantity: item.quantity,
                price: item.price
            }));

            const normalizedPhone = normalizePhone(formData.phone);

            const { data: batchRecheck } = await supabase
                .from('batches')
                .select('status')
                .eq('id', batch.id)
                .single();

            if (!batchRecheck || batchRecheck.status !== 'open') {
                toast.error('Batch pre-order baru saja ditutup.');
                navigate('/');
                return;
            }

            if (totalPrice <= 0) {
                toast.error('Total pesanan tidak valid.');
                return;
            }

            const { data: orderId, error: orderError } = await supabase.rpc('create_order_atomic', {
                p_batch_id: batch.id,
                p_customer_name: formData.name.trim(),
                p_customer_phone: normalizedPhone,
                p_customer_address: formData.address.trim() || null,
                p_total_price: totalPrice,
                p_payment_method: 'pending',
                p_items: orderItems
            });

            if (orderError) throw orderError;

            clearCart();
            toast.success('Pesanan berhasil dibuat!');
            navigate(`/payment/${orderId}`);

        } catch (error: any) {
            console.error('Checkout error:', error);
            toast.error(error.message || 'Gagal membuat pesanan.');
        } finally {
            setIsFormLoading(false);
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <button className={styles.backBtn} onClick={() => navigate('/')}>
                    <ArrowLeft size={20} />
                </button>
                <h1 className={styles.headerTitle}>Checkout</h1>
                <div className={styles.headerSpacer}></div>
            </header>

            <main className={styles.main}>
                {/* Order Summary */}
                <section className={styles.section}>
                    <button
                        className={styles.sectionHeader}
                        onClick={() => setIsOrderExpanded(!isOrderExpanded)}
                    >
                        <div className={styles.sectionTitle}>
                            <ShoppingBag size={20} />
                            <span>Pesanan ({totalItems} item)</span>
                        </div>
                        {isOrderExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>

                    {isOrderExpanded && (
                        <div className={styles.orderItems}>
                            {items.map((item) => (
                                <div key={item.id} className={styles.orderItem}>
                                    <div className={styles.itemImage}>
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.name} />
                                        ) : (
                                            <span className={styles.itemPlaceholder}>🥤</span>
                                        )}
                                    </div>
                                    <div className={styles.itemDetails}>
                                        <h4 className={styles.itemName}>{item.name}</h4>
                                        <span className={styles.itemPrice}>{formatPrice(item.price)}</span>
                                    </div>
                                    <div className={styles.itemActions}>
                                        <div className={styles.qtyControls}>
                                            <button
                                                className={styles.qtyBtn}
                                                onClick={() => {
                                                    if (item.quantity === 1) removeItem(item.id);
                                                    else updateQuantity(item.id, -1);
                                                }}
                                            >
                                                {item.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                                            </button>
                                            <span className={styles.qtyValue}>{item.quantity}</span>
                                            <button
                                                className={styles.qtyBtn}
                                                onClick={() => updateQuantity(item.id, 1)}
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                        <span className={styles.itemSubtotal}>
                                            {formatPrice(item.price * item.quantity)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Customer Form */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitle}>
                            <User size={20} />
                            <span>Informasi Pemesan</span>
                        </div>
                    </div>

                    <form id="checkout-form" onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label htmlFor="name" className={styles.label}>
                                Nama Lengkap <span className={styles.required}>*</span>
                            </label>
                            <div className={styles.inputWrapper}>
                                <input
                                    type="text"
                                    id="name"
                                    required
                                    className={`${styles.input} ${nameValidation.error ? styles.inputError : ''} ${nameValidation.isValid && nameValidation.touched ? styles.inputSuccess : ''}`}
                                    value={formData.name}
                                    onChange={(e) => {
                                        setFormData({ ...formData, name: e.target.value });
                                    }}
                                    onBlur={() => nameValidation.markTouched(true)}
                                    placeholder="Masukkan nama lengkap"
                                    aria-invalid={!!nameValidation.error}
                                />
                                {nameValidation.isValid && nameValidation.touched && (
                                    <Check size={18} className={styles.checkIcon} />
                                )}
                            </div>
                            {nameValidation.error && <span className={styles.errorText}>{nameValidation.error}</span>}
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="phone" className={styles.label}>
                                <Phone size={14} />
                                Nomor WhatsApp <span className={styles.required}>*</span>
                            </label>
                            <div className={`${styles.inputWrapper} ${styles.phoneInputWrapper}`}>
                                <span className={styles.phonePrefix}>+62</span>
                                <input
                                    type="tel"
                                    id="phone"
                                    required
                                    className={`${styles.input} ${styles.phoneInput} ${phoneValidation.error ? styles.inputError : ''} ${phoneValidation.isValid && phoneValidation.touched ? styles.inputSuccess : ''}`}
                                    value={formData.phone}
                                    onChange={(e) => {
                                        // normalize digits and remove leading 0 when UI shows +62
                                        let raw = e.target.value.replace(/\D/g, '');
                                        if (raw.startsWith('0')) raw = raw.slice(1);
                                        setFormData({ ...formData, phone: raw });
                                    }}
                                    onBlur={() => phoneValidation.markTouched(true)}
                                    placeholder="8123456789"
                                    aria-invalid={!!phoneValidation.error}
                                />
                                {phoneValidation.isValid && phoneValidation.touched && (
                                    <Check size={18} className={styles.checkIcon} />
                                )}
                            </div>
                            {phoneValidation.error && <span className={styles.errorText}>{phoneValidation.error}</span>}
                            <span className={styles.helpText}>Ketik nomor tanpa angka 0 di depan (format: 8123456789)</span>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="address" className={styles.label}>
                                <FileText size={14} />
                                Catatan (Opsional)
                            </label>
                            <div className={styles.inputWrapper}>
                                <textarea
                                    id="address"
                                    className={`${styles.textarea} ${addressValidation.error ? styles.inputError : ''} ${addressValidation.isValid && addressValidation.touched ? styles.inputSuccess : ''}`}
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    onBlur={() => addressValidation.markTouched(true)}
                                    placeholder="Alamat pengiriman atau catatan khusus..."
                                    rows={3}
                                    aria-invalid={!!addressValidation.error}
                                />
                                {addressValidation.isValid && addressValidation.touched && (
                                    <Check size={18} className={styles.checkIcon} />
                                )}
                            </div>
                            {addressValidation.error && <span className={styles.errorText}>{addressValidation.error}</span>}
                        </div>
                    </form>
                </section>
            </main>

            {isFormLoading && (
                <div className={styles.formOverlay} role="status" aria-live="polite">
                    <div className={styles.formOverlayContent}>
                        <span className={styles.loadingSpinner} aria-hidden></span>
                        <div>Memproses pesanan...</div>
                    </div>
                </div>
            )}

            {/* Sticky Footer */}
            <footer className={styles.footer}>
                <div className={styles.footerContent}>
                    <div className={styles.totalSection}>
                        <span className={styles.totalLabel}>Total</span>
                        <span className={styles.totalValue}>{formatPrice(totalPrice)}</span>
                    </div>
                    <button
                        type="submit"
                        form="checkout-form"
                        className={styles.submitBtn}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className={styles.loadingSpinner}></span>
                        ) : (
                            'Lanjut ke Pembayaran'
                        )}
                    </button>
                </div>
            </footer>
        </div>
    );
};
