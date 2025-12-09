import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Order, PaymentSettings } from '../../types';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PaymentProgressTracker, PaymentMethodSelector, PaymentProofUploader, OrderStatusTimeline } from '../../components/features/payment';
import {
    ArrowLeft, CheckCircle, XCircle,
    MessageCircle, X, Loader2, Clock
} from 'lucide-react';
import styles from './PaymentPage.module.css';
import toast from 'react-hot-toast';
import { openWhatsApp } from '../../lib/whatsapp';

interface OrderItem {
    quantity: number;
    price_per_item: number;
    menus: {
        name: string;
    } | null;
}

interface OrderWithItems extends Order {
    order_items?: OrderItem[];
}

export const PaymentPage: React.FC = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<OrderWithItems | null>(null);
    const [displayTotal, setDisplayTotal] = useState<number>(0);
    const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'qris' | 'transfer' | 'cod' | null>(null);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [showBackDialog, setShowBackDialog] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    const [activeAdminPhone, setActiveAdminPhone] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrderAndSettings = async () => {
            try {
                if (!orderId) return;

                // 1. Fetch Order
                const { data: orderData, error: orderError } = await supabase
                    .from('orders')
                    .select(`*, order_items (quantity, price_per_item, menus(name))`)
                    .eq('id', orderId)
                    .single();

                if (orderError) throw orderError;
                setOrder(orderData);

                let total = orderData.total_amount || 0;
                if (total === 0 && orderData.order_items) {
                    total = (orderData.order_items as OrderItem[]).reduce(
                        (sum, item) => sum + (item.quantity * item.price_per_item), 0
                    );
                }
                setDisplayTotal(total);

                // 2. Set Payment Method
                if (orderData.payment_method === 'pending') {
                    setSelectedPaymentMethod(null);
                } else {
                    setSelectedPaymentMethod(orderData.payment_method as 'qris' | 'transfer' | 'cod');
                }

                // 3. Fetch Payment Settings (Bank info etc)
                const { data: settingsData } = await supabase
                    .from('payment_settings')
                    .select('*')
                    .single();

                if (settingsData) {
                    setPaymentSettings(settingsData);
                }

                // 4. Fetch Active Admin Contact
                const { data: contactData } = await supabase
                    .from('admin_contacts')
                    .select('phone_number')
                    .eq('is_active', true)
                    .limit(1)
                    .single();

                if (contactData?.phone_number) {
                    setActiveAdminPhone(contactData.phone_number);
                }

                // 5. Check for Payment Proof
                const { data: proofData } = await supabase
                    .from('payment_proofs')
                    .select('id')
                    .eq('order_id', orderId)
                    .single();

                if (proofData) {
                    setUploadSuccess(true);
                }

            } catch (err) {
                console.error('Error loading data:', err);
                toast.error('Gagal memuat detail pesanan.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrderAndSettings();

        // Realtime subscription
        const subscription = supabase
            .channel(`order-${orderId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
                setOrder(payload.new as Order);
                toast('Status pesanan diperbarui!', { icon: '🔔' });
            })
            .subscribe();

        return () => { subscription.unsubscribe(); };
    }, [orderId]);

    // Helper function for formatting price
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    };

    // Computed status values
    const isPending = order?.status === 'pending_payment';
    const isCancelled = order?.status === 'cancelled';
    const isCompleted = order?.status === 'picked_up';

    // Calculate current step for progress tracker
    const getCurrentStep = (): number => {
        if (!order) return 1;
        switch (order.status) {
            case 'pending_payment': return selectedPaymentMethod ? 2 : 1;
            case 'payment_received': return 3;
            case 'preparing': return 3;
            case 'ready': return 4;
            case 'picked_up': return 4;
            default: return 1;
        }
    };
    const currentStep = getCurrentStep();

    // Handle payment method selection
    const handlePaymentMethodSelect = async (method: 'qris' | 'transfer' | 'cod') => {
        if (!orderId) return;

        // Check if order is still valid
        const isValid = await checkOrderStillValid();
        if (!isValid) return;

        try {
            const { error } = await supabase
                .from('orders')
                .update({ payment_method: method })
                .eq('id', orderId);

            if (error) throw error;

            setSelectedPaymentMethod(method);
            toast.success(`Metode pembayaran: ${method.toUpperCase()}`);
        } catch (err) {
            console.error('Error updating payment method:', err);
            toast.error('Gagal memilih metode pembayaran');
        }
    };

    // Handle change payment method
    const handleChangePaymentMethod = async () => {
        if (!orderId) return;

        // Check if order is still valid
        const isValid = await checkOrderStillValid();
        if (!isValid) return;

        try {
            const { error } = await supabase
                .from('orders')
                .update({ payment_method: 'pending' })
                .eq('id', orderId);

            if (error) throw error;

            setSelectedPaymentMethod(null);
            setUploadSuccess(false);
            toast('Silakan pilih metode pembayaran baru');
        } catch (err) {
            console.error('Error resetting payment method:', err);
            toast.error('Gagal mengubah metode pembayaran');
        }
    };

    // Check if order can be cancelled
    const canCancel = () => {
        if (!order) return false;
        return order.status === 'pending_payment';
    };

    // Check if order is still valid before any action
    const checkOrderStillValid = async (): Promise<boolean> => {
        if (!orderId) return false;

        try {
            const { data, error } = await supabase
                .from('orders')
                .select('status')
                .eq('id', orderId)
                .single();

            if (error || !data) {
                toast.error('Pesanan tidak ditemukan');
                navigate('/');
                return false;
            }

            if (data.status === 'cancelled') {
                toast.error('Pesanan ini sudah dibatalkan oleh admin');
                navigate('/');
                return false;
            }

            // Update local order state if needed
            if (order && order.status !== data.status) {
                setOrder({ ...order, status: data.status });
            }

            return true;
        } catch (err) {
            console.error('Error checking order status:', err);
            return false;
        }
    };

    // Handle cancel order
    const handleCancelOrder = async () => {
        if (!orderId || !order) return;

        setIsCancelling(true);
        try {
            // Check fresh status from database before cancelling
            const { data: freshOrder, error: checkError } = await supabase
                .from('orders')
                .select('status')
                .eq('id', orderId)
                .single();

            if (checkError || !freshOrder) {
                toast.error('Gagal memeriksa status pesanan');
                setIsCancelling(false);
                return;
            }

            if (freshOrder.status !== 'pending_payment') {
                toast.error('Pesanan sudah diverifikasi oleh admin dan tidak dapat dibatalkan');
                // Refresh local order state
                setOrder({ ...order, status: freshOrder.status });
                setShowCancelDialog(false);
                setIsCancelling(false);
                return;
            }

            // 1. Get order items
            const { data: orderItems, error: itemsError } = await supabase
                .from('order_items')
                .select('menu_id, quantity')
                .eq('order_id', orderId);

            if (itemsError) {
                console.error('Error fetching order items:', itemsError);
            }

            // 2. Restore stock for each item
            if (orderItems && order.batch_id) {
                for (const item of orderItems) {
                    try {
                        await supabase.rpc('restore_stock', {
                            p_batch_id: order.batch_id,
                            p_menu_id: item.menu_id,
                            p_quantity: item.quantity
                        });
                    } catch (restoreError) {
                        console.error('Error restoring stock for item:', item.menu_id, restoreError);
                    }
                }
            }

            // 3. Update order status
            const { error } = await supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', orderId);

            if (error) throw error;

            toast.success('Pesanan berhasil dibatalkan');
            setShowCancelDialog(false);
            navigate('/');
        } catch (err) {
            console.error('Error cancelling order:', err);
            toast.error('Gagal membatalkan pesanan');
        } finally {
            setIsCancelling(false);
        }
    };

    // Handle back button - cancel order and go to checkout
    const handleBackToCheckout = async () => {
        if (!orderId || !order) return;

        setIsCancelling(true);
        try {
            // Check fresh status from database before cancelling
            const { data: freshOrder, error: checkError } = await supabase
                .from('orders')
                .select('status')
                .eq('id', orderId)
                .single();

            if (checkError || !freshOrder) {
                toast.error('Gagal memeriksa status pesanan');
                setIsCancelling(false);
                return;
            }

            if (freshOrder.status !== 'pending_payment') {
                toast.error('Pesanan sudah diverifikasi oleh admin dan tidak dapat dibatalkan');
                // Refresh local order state
                setOrder({ ...order, status: freshOrder.status });
                setShowBackDialog(false);
                setIsCancelling(false);
                return;
            }

            // 1. Get order items
            const { data: orderItems, error: itemsError } = await supabase
                .from('order_items')
                .select('menu_id, quantity')
                .eq('order_id', orderId);

            if (itemsError) {
                console.error('Error fetching order items:', itemsError);
            }

            // 2. Restore stock for each item
            if (orderItems && order.batch_id) {
                for (const item of orderItems) {
                    try {
                        await supabase.rpc('restore_stock', {
                            p_batch_id: order.batch_id,
                            p_menu_id: item.menu_id,
                            p_quantity: item.quantity
                        });
                    } catch (restoreError) {
                        console.error('Error restoring stock for item:', item.menu_id, restoreError);
                    }
                }
            }

            // 3. Update order status
            const { error } = await supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', orderId);

            if (error) throw error;

            toast.success('Pesanan dibatalkan. Silakan isi ulang data Anda.');
            setShowBackDialog(false);
            navigate('/checkout');
        } catch (err) {
            console.error('Error cancelling order:', err);
            toast.error('Gagal membatalkan pesanan');
        } finally {
            setIsCancelling(false);
        }
    };

    const handleContactAdmin = () => {
        if (!order || !activeAdminPhone) {
            toast.error('Kontak admin tidak tersedia saat ini');
            return;
        }
        const message = `Halo Bu Tuty, saya ingin bertanya mengenai pesanan #${order.id.slice(0, 8)}.`;
        openWhatsApp(activeAdminPhone, message);
    };


    if (isLoading) {
        return (
            <div className={styles.loadingState}>
                <Loader2 size={32} className={styles.spinner} />
                <span>Memuat...</span>
            </div>
        );
    }

    if (!order) {
        return (
            <div className={styles.errorState}>
                <XCircle size={48} />
                <h2>Pesanan Tidak Ditemukan</h2>
                <button className={styles.primaryBtn} onClick={() => navigate('/')}>
                    Kembali ke Menu
                </button>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <button className={styles.backBtn} onClick={() => canCancel() ? setShowBackDialog(true) : navigate('/')}> <ArrowLeft size={20} /> </button>
                <h1 className={styles.headerTitle}>Pembayaran</h1>
                <button className={styles.contactBtn} onClick={handleContactAdmin} disabled={!activeAdminPhone}>
                    <MessageCircle size={18} />
                </button>
            </header>
            <main className={styles.main}>
                <div className={styles.orderInfo}>
                    <div className={styles.orderHeaderRow}>
                        <span className={styles.orderLabel}>Order ID</span>
                        <span className={styles.orderId}>#{order.id.slice(0, 8)}</span>
                    </div>

                    <div className={styles.itemsList}>
                        {order.order_items?.map((item, index) => (
                            <div key={index} className={styles.itemRow}>
                                <div className={styles.itemMeta}>
                                    <span className={styles.itemQty}>{item.quantity}x</span>
                                    <span className={styles.itemName}>{item.menus?.name || 'Menu Item'}</span>
                                </div>
                                <span className={styles.itemPrice}>
                                    {formatPrice(item.quantity * item.price_per_item)}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className={styles.divider} />

                    <div className={styles.totalRow}>
                        <span className={styles.totalLabel}>Total Tagihan</span>
                        <span className={styles.orderTotal}>{formatPrice(displayTotal)}</span>
                    </div>
                </div>
                {isCancelled ? (
                    <div className={styles.cancelledCard}>
                        <XCircle size={48} />
                        <h2>Pesanan Dibatalkan</h2>
                        <p>Hubungi kami untuk informasi lebih lanjut.</p>
                        <button className={styles.primaryBtn} onClick={() => navigate('/')}>Kembali ke Menu</button>
                    </div>
                ) : (
                    <>
                        {/* Progress Tracker */}
                        <PaymentProgressTracker currentStep={currentStep} />
                        {/* Payment Method Selection */}
                        {isPending && !selectedPaymentMethod && (
                            <>
                                <PaymentMethodSelector
                                    onSelectMethod={handlePaymentMethodSelect}
                                    isLoading={isLoading}
                                />
                                {/* Contact Admin Info Card */}
                                <div className={styles.contactInfoCard}>
                                    <div className={styles.contactInfoContent}>
                                        <MessageCircle size={20} className={styles.contactInfoIcon} />
                                        <div className={styles.contactInfoText}>
                                            <h3>Butuh Bantuan?</h3>
                                            <p>Hubungi Bu Tuty untuk pertanyaan seputar pembayaran</p>
                                        </div>
                                    </div>
                                    <button
                                        className={styles.contactInfoBtn}
                                        onClick={handleContactAdmin}
                                        disabled={!activeAdminPhone}
                                    >
                                        <MessageCircle size={16} />
                                        <span>Hubungi Bu Tuty</span>
                                    </button>
                                </div>
                            </>
                        )}
                        {/* Payment Proof Uploader */}
                        {isPending && (selectedPaymentMethod === 'qris' || selectedPaymentMethod === 'transfer') && !uploadSuccess && (
                            <PaymentProofUploader
                                orderId={orderId!}
                                selectedPaymentMethod={selectedPaymentMethod}
                                paymentSettings={paymentSettings}
                                displayTotal={displayTotal}
                                onUploadSuccess={() => setUploadSuccess(true)}
                                onChangeMethod={handleChangePaymentMethod}
                                isChangeAllowed={isPending}
                            />
                        )}
                        {/* COD Selected */}
                        {isPending && selectedPaymentMethod === 'cod' && (
                            <section className={styles.section}>
                                <div className={styles.successCard}>
                                    <CheckCircle size={48} />
                                    <h2>Cash on Delivery</h2>
                                    <p>Siapkan uang pas saat mengambil pesanan.</p>
                                    <p className={styles.successHint}>Anda akan menerima notifikasi WhatsApp ketika pesanan siap.</p>
                                    {/* Only show change button if payment is still pending */}
                                    {isPending && (
                                        <button className={styles.changeMethodBtn} onClick={handleChangePaymentMethod}>
                                            <ArrowLeft size={16} style={{ marginRight: '0.5rem', display: 'inline-block', verticalAlign: 'text-bottom' }} />
                                            Ganti Metode Pembayaran
                                        </button>
                                    )}
                                </div>
                            </section>
                        )}
                        {/* Upload Success - Only show when still pending */}
                        {uploadSuccess && selectedPaymentMethod !== 'cod' && isPending && (
                            <section className={styles.section}>
                                <div className={styles.successCard}>
                                    <CheckCircle size={48} />
                                    <h2>Bukti Terkirim!</h2>
                                    <p>Menunggu verifikasi dari admin.</p>
                                    <p className={styles.successHint}>Anda akan menerima notifikasi WhatsApp setelah pembayaran diverifikasi.</p>
                                    {/* Only show change button if payment is still pending (not yet verified by admin) */}
                                    {isPending && (
                                        <button className={styles.changeMethodBtn} onClick={handleChangePaymentMethod}>
                                            <ArrowLeft size={16} style={{ marginRight: '0.5rem', display: 'inline-block', verticalAlign: 'text-bottom' }} />
                                            Ganti Metode Pembayaran
                                        </button>
                                    )}
                                </div>
                            </section>
                        )}
                        {/* Timeline History */}
                        {!isPending && (
                            <OrderStatusTimeline order={order} />
                        )}
                        {/* Cancel Button */}
                        {canCancel() && (
                            <button className={styles.cancelBtn} onClick={() => setShowCancelDialog(true)}>
                                <X size={18} /> Batalkan Pesanan
                            </button>
                        )}
                        {/* Cannot Cancel Message */}
                        {!canCancel() && !isCompleted && !isCancelled && (
                            <div className={styles.cannotCancelNotice}>
                                <Clock size={16} />
                                <span>Pembatalan tidak tersedia setelah pembayaran diverifikasi. Hubungi admin jika ada kendala.</span>
                            </div>
                        )}
                    </>
                )}
            </main>
            {/* Cancel Order Dialog */}
            <ConfirmDialog
                isOpen={showCancelDialog}
                title="Batalkan Pesanan"
                message="Apakah Anda yakin ingin membatalkan pesanan ini?"
                variant="danger"
                confirmText={isCancelling ? 'Membatalkan...' : 'Ya, Batalkan'}
                cancelText="Tidak"
                onConfirm={handleCancelOrder}
                onCancel={() => setShowCancelDialog(false)}
            />
            {/* Back to Checkout Dialog */}
            <ConfirmDialog
                isOpen={showBackDialog}
                title="Kembali ke Checkout?"
                message="Pesanan ini akan dibatalkan dan stok dikembalikan. Anda bisa mengisi ulang data dan memesan lagi."
                variant="default"
                confirmText={isCancelling ? 'Memproses...' : 'Ya, Kembali'}
                cancelText="Tetap di Sini"
                onConfirm={handleBackToCheckout}
                onCancel={() => setShowBackDialog(false)}
            />
        </div>
    );
};
