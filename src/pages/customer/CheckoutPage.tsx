import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../../stores/cartStore';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, User, Phone, FileText, ChevronDown, ChevronUp, Trash2, Minus, Plus, Check, Loader2 } from 'lucide-react';
import styles from './CheckoutPage.module.css';
import toast from 'react-hot-toast';
import { normalizePhone, validateName, validatePhone, validateAddress, type CheckoutFormData } from '../../utils/validation';
import useFieldValidation from '../../hooks/useFieldValidation';
import { EmptyCartState } from '../../components/features/EmptyCartState';

export const CheckoutPage: React.FC = () => {
    const { t } = useTranslation();
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
        return <EmptyCartState variant="page" />;
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
            toast.error(t('validation.formIncomplete'));
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
                toast.error(t('errors.batchClosed'));
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
                toast.error(t('errors.stockVerifyFailed'));
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
                toast.error(t('errors.itemsSoldOut', { items: outOfStockItems.join(', ') }));
                return;
            }

            if (insufficientStockItems.length > 0) {
                const msg = insufficientStockItems.map(
                    item => `${item.name}: ${t('menu.available').toLowerCase()} ${item.available}`
                ).join(', ');
                toast.error(t('errors.stockInsufficient', { items: msg }));
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
                toast.error(t('errors.batchJustClosed'));
                navigate('/');
                return;
            }

            if (totalPrice <= 0) {
                toast.error(t('errors.invalidTotal'));
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
            toast.success(t('errors.orderSuccess'));
            navigate(`/payment/${orderId}`);

        } catch (error) {
            console.error('Checkout error:', error);
            const errorMessage = error instanceof Error ? error.message : t('errors.orderFailed');
            toast.error(errorMessage);
        } finally {
            setIsFormLoading(false);
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <button
                    className={styles.backBtn}
                    onClick={() => navigate('/')}
                    aria-label={t('common.back')}
                >
                    <ArrowLeft size={20} aria-hidden="true" />
                </button>
                <h1 className={styles.headerTitle}>{t('checkout.title')}</h1>
                <div className={styles.headerSpacer}></div>
            </header>

            <main className={styles.main}>
                {/* Order Summary */}
                <section className={styles.section} aria-labelledby="order-summary-heading">
                    <button
                        className={styles.sectionHeader}
                        onClick={() => setIsOrderExpanded(!isOrderExpanded)}
                        aria-expanded={isOrderExpanded}
                        aria-controls="order-items"
                    >
                        <div className={styles.sectionTitle}>
                            <ShoppingBag size={20} aria-hidden="true" />
                            <span id="order-summary-heading">
                                {t('checkout.orderSummary')} ({totalItems} {totalItems > 1 ? t('cart.items') : t('cart.item')})
                            </span>
                        </div>
                        {isOrderExpanded ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
                    </button>

                    {isOrderExpanded && (
                        <div id="order-items" className={styles.orderItems}>
                            {items.map((item) => (
                                <div key={item.id} className={styles.orderItem}>
                                    <div className={styles.itemImage}>
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.name} />
                                        ) : (
                                            <span className={styles.itemPlaceholder} aria-hidden="true">🥤</span>
                                        )}
                                    </div>
                                    <div className={styles.itemDetails}>
                                        <h4 className={styles.itemName}>{item.name}</h4>
                                        <span className={styles.itemPrice}>{formatPrice(item.price)}</span>
                                    </div>
                                    <div className={styles.itemActions}>
                                        <div className={styles.qtyControls} role="group" aria-label={`Quantity controls for ${item.name}`}>
                                            <button
                                                className={styles.qtyBtn}
                                                onClick={() => {
                                                    if (item.quantity === 1) removeItem(item.id);
                                                    else updateQuantity(item.id, -1);
                                                }}
                                                aria-label={item.quantity === 1 ? `Remove ${item.name}` : `Decrease quantity of ${item.name}`}
                                            >
                                                {item.quantity === 1 ? <Trash2 size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
                                            </button>
                                            <span className={styles.qtyValue} aria-live="polite">{item.quantity}</span>
                                            <button
                                                className={styles.qtyBtn}
                                                onClick={() => updateQuantity(item.id, 1)}
                                                aria-label={`Increase quantity of ${item.name}`}
                                            >
                                                <Plus size={14} aria-hidden="true" />
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
                <section className={styles.section} aria-labelledby="customer-info-heading">
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitle}>
                            <User size={20} aria-hidden="true" />
                            <span id="customer-info-heading">{t('checkout.customerInfo')}</span>
                        </div>
                    </div>

                    <form id="checkout-form" onSubmit={handleSubmit} className={styles.form} noValidate>
                        <div className={styles.formGroup}>
                            <label htmlFor="name" className={styles.label}>
                                {t('checkout.fullName')} <span className={styles.required}>*</span>
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
                                    placeholder={t('checkout.namePlaceholder')}
                                    aria-invalid={!!nameValidation.error}
                                    aria-describedby={nameValidation.error ? 'name-error' : undefined}
                                />
                                {nameValidation.isValidating && (
                                    <Loader2 size={18} className={styles.validatingIcon} aria-hidden="true" />
                                )}
                                {nameValidation.isValid && nameValidation.touched && !nameValidation.isValidating && (
                                    <Check size={18} className={styles.checkIcon} aria-hidden="true" />
                                )}
                            </div>
                            {nameValidation.error && (
                                <span id="name-error" className={styles.errorText} role="alert">
                                    {nameValidation.error}
                                </span>
                            )}
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="phone" className={styles.label}>
                                <Phone size={14} aria-hidden="true" />
                                {t('checkout.whatsappNumber')} <span className={styles.required}>*</span>
                            </label>
                            <div className={`${styles.inputWrapper} ${styles.phoneInputWrapper}`}>
                                <span className={styles.phonePrefix} aria-hidden="true">+62</span>
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
                                    placeholder={t('checkout.phonePlaceholder')}
                                    aria-invalid={!!phoneValidation.error}
                                    aria-describedby="phone-hint phone-error"
                                />
                                {phoneValidation.isValidating && (
                                    <Loader2 size={18} className={styles.validatingIcon} aria-hidden="true" />
                                )}
                                {phoneValidation.isValid && phoneValidation.touched && !phoneValidation.isValidating && (
                                    <Check size={18} className={styles.checkIcon} aria-hidden="true" />
                                )}
                            </div>
                            {phoneValidation.error && (
                                <span id="phone-error" className={styles.errorText} role="alert">
                                    {phoneValidation.error}
                                </span>
                            )}
                            <span id="phone-hint" className={styles.helpText}>
                                {t('checkout.phoneHint')}
                            </span>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="address" className={styles.label}>
                                <FileText size={14} aria-hidden="true" />
                                {t('checkout.notes')}
                            </label>
                            <div className={styles.inputWrapper}>
                                <textarea
                                    id="address"
                                    className={`${styles.textarea} ${addressValidation.error ? styles.inputError : ''} ${addressValidation.isValid && addressValidation.touched ? styles.inputSuccess : ''}`}
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    onBlur={() => addressValidation.markTouched(true)}
                                    placeholder={t('checkout.notesPlaceholder')}
                                    rows={3}
                                    aria-invalid={!!addressValidation.error}
                                    aria-describedby={addressValidation.error ? 'address-error' : undefined}
                                />
                                {addressValidation.isValidating && (
                                    <Loader2 size={18} className={styles.validatingIcon} aria-hidden="true" />
                                )}
                                {addressValidation.isValid && addressValidation.touched && !addressValidation.isValidating && (
                                    <Check size={18} className={styles.checkIcon} aria-hidden="true" />
                                )}
                            </div>
                            {addressValidation.error && (
                                <span id="address-error" className={styles.errorText} role="alert">
                                    {addressValidation.error}
                                </span>
                            )}
                        </div>
                    </form>
                </section>
            </main>

            {isFormLoading && (
                <div className={styles.formOverlay} role="status" aria-live="polite">
                    <div className={styles.formOverlayContent}>
                        <span className={styles.loadingSpinner} aria-hidden="true"></span>
                        <div>{t('checkout.processing')}</div>
                    </div>
                </div>
            )}

            {/* Sticky Footer */}
            <footer className={styles.footer}>
                <div className={styles.footerContent}>
                    <div className={styles.totalSection}>
                        <span className={styles.totalLabel}>{t('common.total')}</span>
                        <span className={styles.totalValue}>{formatPrice(totalPrice)}</span>
                    </div>
                    <button
                        type="submit"
                        form="checkout-form"
                        className={styles.submitBtn}
                        disabled={isLoading}
                        aria-busy={isLoading}
                    >
                        {isLoading ? (
                            <span className={styles.loadingSpinner} aria-hidden="true"></span>
                        ) : (
                            t('checkout.proceedToPayment')
                        )}
                    </button>
                </div>
            </footer>
        </div>
    );
};
