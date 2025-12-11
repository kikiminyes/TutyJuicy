import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order, OrderItem, PaymentProof } from '../../types';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
    X, ExternalLink, MessageCircle, CheckCircle,
    ArrowRight, XCircle, Banknote, Trash2, CreditCard, Building2
} from 'lucide-react';
import styles from './OrderDetailModal.module.css';
import toast from 'react-hot-toast';
import { generateStatusUpdateMessage, openWhatsApp } from '../../lib/whatsapp';

// 5-step workflow colors - consistent with customer view
const WORKFLOW_STEPS = [
    { key: 'pilih', label: 'Pilih', color: '#ff7f50' },
    { key: 'bayar', label: 'Bayar', color: '#f59e0b' },
    { key: 'terverifikasi', label: 'Terverifikasi', color: '#3b82f6' },
    { key: 'disiapkan', label: 'Disiapkan', color: '#8b5cf6' },
    { key: 'siap', label: 'Siap', color: '#10b981' },
];

interface OrderDetailModalProps {
    order: Order;
    onClose: () => void;
    onUpdate: () => void;
}

interface ExtendedOrderItem extends OrderItem {
    menu: { name: string } | null;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, onClose, onUpdate }) => {
    const [items, setItems] = useState<ExtendedOrderItem[]>([]);
    const [proof, setProof] = useState<PaymentProof | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<Order['status'] | null>(null);
    const [showWhatsAppConfirm, setShowWhatsAppConfirm] = useState(false);
    const [lastUpdatedStatus, setLastUpdatedStatus] = useState<Order['status'] | null>(null);

    // Delete state
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                // 1. Fetch Items with Menu details
                const { data: itemsData, error: itemsError } = await supabase
                    .from('order_items')
                    .select('*, menu:menus(name)')
                    .eq('order_id', order.id);

                if (itemsError) throw itemsError;
                setItems(itemsData || []);

                // 2. Fetch Payment Proof
                const { data: proofData } = await supabase
                    .from('payment_proofs')
                    .select('*')
                    .eq('order_id', order.id)
                    .single();

                if (proofData) setProof(proofData);

            } catch (error) {
                console.error('Error fetching details:', error);
                toast.error('Failed to load order details');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [order.id]);

    const handleStatusClick = (newStatus: Order['status']) => {
        setPendingStatus(newStatus);
    };

    const handleStatusConfirm = async () => {
        if (!pendingStatus) return;

        setIsUpdating(true);
        try {
            // If cancelling, restore stock first
            if (pendingStatus === 'cancelled') {
                // Get order items for this order
                const { data: orderItems, error: itemsError } = await supabase
                    .from('order_items')
                    .select('menu_id, quantity')
                    .eq('order_id', order.id);

                if (itemsError) {
                    console.error('Error fetching order items:', itemsError);
                }

                // Restore stock for each item
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
                            // Continue with other items even if one fails
                        }
                    }
                }

                // Delete payment proof if exists
                await supabase.rpc('delete_payment_proof', { p_order_id: order.id });
            }

            const { error } = await supabase
                .from('orders')
                .update({ status: pendingStatus })
                .eq('id', order.id);

            if (error) throw error;

            toast.success(`Order updated to ${pendingStatus}`);
            setLastUpdatedStatus(pendingStatus);
            setPendingStatus(null);

            // Show WhatsApp confirmation dialog
            setShowWhatsAppConfirm(true);
        } catch (error) {
            console.error('Update error:', error);
            toast.error('Failed to update status');
            setPendingStatus(null);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleWhatsAppConfirm = () => {
        if (lastUpdatedStatus) {
            const message = generateStatusUpdateMessage(order, lastUpdatedStatus);
            openWhatsApp(order.customer_phone, message);
        }
        setShowWhatsAppConfirm(false);
        setLastUpdatedStatus(null);
        onUpdate();
        onClose();
    };

    const handleWhatsAppCancel = () => {
        setShowWhatsAppConfirm(false);
        setLastUpdatedStatus(null);
        onUpdate();
        onClose();
    };

    const handleDeleteOrder = async () => {
        if (!order) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', order.id);

            if (error) throw error;

            toast.success('Order deleted permanently');
            onUpdate();
            onClose();
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Failed to delete order');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const getStatusLabel = (status: Order['status']) => {
        const labels: Record<Order['status'], string> = {
            pending_payment: 'Menunggu Pembayaran',
            payment_received: 'Terverifikasi',
            preparing: 'Disiapkan',
            ready: 'Siap Diambil',
            picked_up: 'Selesai',
            cancelled: 'Dibatalkan'
        };
        return labels[status] || status;
    };

    // Get current step based on order status
    const getCurrentStep = (status: string): number => {
        switch (status) {
            case 'pending_payment': return 2;
            case 'payment_received': return 3;
            case 'preparing': return 4;
            case 'ready':
            case 'picked_up': return 5;
            default: return 1;
        }
    };

    // Get quick action info
    const getQuickAction = () => {
        switch (order.status) {
            case 'pending_payment':
                return { label: 'Verifikasi Pembayaran', nextStatus: 'payment_received' as Order['status'], color: '#3b82f6' };
            case 'payment_received':
                return { label: 'Mulai Proses', nextStatus: 'preparing' as Order['status'], color: '#8b5cf6' };
            case 'preparing':
                return { label: 'Siap Diambil', nextStatus: 'ready' as Order['status'], color: '#10b981' };
            case 'ready':
                return { label: 'Selesai', nextStatus: 'picked_up' as Order['status'], color: '#10b981' };
            default:
                return null;
        }
    };

    const quickAction = getQuickAction();
    const currentStep = getCurrentStep(order.status);

    const handleNotify = () => {
        const message = generateStatusUpdateMessage(order, order.status);
        openWhatsApp(order.customer_phone, message);
    };

    if (!order) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Order Details</h2>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={24} />
                    </button>
                </div>

                <div className={styles.content}>
                    {/* Workflow Progress Indicator */}
                    {order.status !== 'cancelled' && (
                        <div className={styles.workflowSection}>
                            <div className={styles.workflowSteps}>
                                {WORKFLOW_STEPS.map((step, index) => {
                                    const stepNumber = index + 1;
                                    const isActive = stepNumber <= currentStep;

                                    return (
                                        <React.Fragment key={step.key}>
                                            <div className={`${styles.workflowStep} ${isActive ? styles.workflowStepActive : ''}`}>
                                                <div
                                                    className={styles.workflowDot}
                                                    style={{
                                                        backgroundColor: isActive ? step.color : '#e5e7eb',
                                                        borderColor: isActive ? step.color : '#e5e7eb'
                                                    }}
                                                >
                                                    {isActive && <CheckCircle size={12} color="white" />}
                                                </div>
                                                <span
                                                    className={styles.workflowLabel}
                                                    style={{ color: isActive ? step.color : '#9ca3af' }}
                                                >
                                                    {step.label}
                                                </span>
                                                {index < WORKFLOW_STEPS.length - 1 && (
                                                    <div
                                                        className={styles.workflowLine}
                                                        style={{
                                                            backgroundColor: stepNumber < currentStep ? WORKFLOW_STEPS[index + 1].color : '#e5e7eb'
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Cancelled Status & Delete Option */}
                    {order.status === 'cancelled' && (
                        <div className={styles.cancelledBadge}>
                            <div className={styles.cancelledBadgeContent}>
                                <XCircle size={20} />
                                <span>Pesanan Dibatalkan</span>
                            </div>
                            <button
                                className={styles.deleteOrderBtn}
                                onClick={() => setShowDeleteConfirm(true)}
                                title="Hapus Pesanan Permanen"
                            >
                                <Trash2 size={16} />
                                <span>Hapus</span>
                            </button>
                        </div>
                    )}

                    {/* Quick Action Button */}
                    {quickAction && (() => {
                        // For pending_payment, check if proof exists (except COD which doesn't need proof)
                        const needsProofButMissing = order.status === 'pending_payment'
                            && order.payment_method !== 'cod'
                            && !proof;

                        const isDisabled = isUpdating || needsProofButMissing;
                        const buttonColor = needsProofButMissing ? '#94a3b8' : quickAction.color;

                        return (
                            <div className={styles.quickActionSection}>
                                <button
                                    className={styles.quickActionBtn}
                                    style={{ backgroundColor: buttonColor }}
                                    onClick={() => handleStatusClick(quickAction.nextStatus)}
                                    disabled={isDisabled}
                                >
                                    <ArrowRight size={20} />
                                    {quickAction.label}
                                </button>
                                {needsProofButMissing && (
                                    <p className={styles.proofWarning}>
                                        ⚠️ Pembeli belum mengirim bukti pembayaran
                                    </p>
                                )}
                            </div>
                        );
                    })()}

                    <div className={styles.section}>
                        <div className={styles.customerHeader}>
                            <h3>Info Pelanggan</h3>
                            <Button size="sm" variant="outline" onClick={handleNotify}>
                                <MessageCircle size={16} />
                                Chat
                            </Button>
                        </div>
                        <div className={styles.customerInfo}>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Nama</span>
                                <span className={styles.infoValue}>{order.customer_name}</span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Telepon</span>
                                <span className={styles.infoValue}>{order.customer_phone}</span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Alamat/Catatan</span>
                                <span className={styles.infoValue}>{order.customer_address || '-'}</span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Checkout</span>
                                <span className={styles.infoValue}>
                                    {new Date(order.created_at).toLocaleString('id-ID', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Method Section */}
                    <div className={styles.section}>
                        <h3>Metode Pembayaran</h3>
                        <div className={`${styles.paymentMethodBadge} ${styles[`paymentMethod_${order.payment_method}`]}`}>
                            {order.payment_method === 'cod' && (
                                <>
                                    <Banknote size={20} />
                                    <div>
                                        <strong>Cash on Delivery (COD)</strong>
                                        <p>Bayar tunai saat mengambil pesanan</p>
                                    </div>
                                </>
                            )}
                            {order.payment_method === 'qris' && (
                                <>
                                    <CreditCard size={20} />
                                    <div>
                                        <strong>QRIS / E-Wallet</strong>
                                        <p>GoPay, OVO, Dana, ShopeePay</p>
                                    </div>
                                </>
                            )}
                            {order.payment_method === 'transfer' && (
                                <>
                                    <Building2 size={20} />
                                    <div>
                                        <strong>Transfer Bank</strong>
                                        <p>BCA, Mandiri, BNI</p>
                                    </div>
                                </>
                            )}
                            {order.payment_method === 'pending' && (
                                <>
                                    <span className={styles.pendingIcon}>⏳</span>
                                    <div>
                                        <strong>Belum Dipilih</strong>
                                        <p>Pembeli belum memilih metode pembayaran</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className={styles.section}>
                        <h3>Item Pesanan</h3>
                        <div className={styles.itemsList}>
                            {isLoading ? <p>Memuat...</p> : items.map((item) => (
                                <div key={item.id} className={styles.item}>
                                    <span>{item.quantity}x {item.menu?.name || 'Unknown Item'}</span>
                                    <span>
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price_per_item * item.quantity)}
                                    </span>
                                </div>
                            ))}
                            <div className={styles.totalRow}>
                                <span>Total</span>
                                <span className={styles.totalValue}>
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.total_amount)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <h3>Bukti Pembayaran</h3>
                        {proof ? (
                            proof.file_type === 'cod_confirmation' ? (
                                <div className={styles.codBadge}>
                                    <Banknote size={24} />
                                    <div>
                                        <strong>Cash on Delivery (COD)</strong>
                                        <p>Bayar saat mengambil pesanan</p>
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.proofContainer}>
                                    <a href={proof.file_url} target="_blank" rel="noopener noreferrer" className={styles.proofLink}>
                                        <img src={proof.file_url} alt="Payment Proof" className={styles.proofImage} />
                                        <span className={styles.viewProof}><ExternalLink size={16} /> Lihat Gambar</span>
                                    </a>
                                </div>
                            )
                        ) : (
                            <p className={styles.noProof}>Belum ada bukti pembayaran.</p>
                        )}
                    </div>

                    {/* Cancel Order Button */}
                    {
                        order.status !== 'cancelled' && order.status !== 'picked_up' && (
                            <div className={styles.cancelSection}>
                                <button
                                    className={styles.cancelOrderBtn}
                                    onClick={() => handleStatusClick('cancelled')}
                                    disabled={isUpdating}
                                >
                                    <XCircle size={18} />
                                    Batalkan Pesanan
                                </button>
                            </div>
                        )
                    }
                </div>
            </div>

            {/* Status Update Confirmation Dialog */}
            <ConfirmDialog
                isOpen={!!pendingStatus}
                title={pendingStatus === 'cancelled' ? 'Cancel Order' : 'Update Status'}
                message={pendingStatus === 'cancelled'
                    ? `Are you sure you want to cancel this order? This action cannot be undone.`
                    : `Update order status to "${pendingStatus ? getStatusLabel(pendingStatus) : ''}"?`
                }
                variant={pendingStatus === 'cancelled' ? 'danger' : 'default'}
                confirmText={pendingStatus === 'cancelled' ? 'Cancel Order' : 'Update'}
                cancelText="Back"
                onConfirm={handleStatusConfirm}
                onCancel={() => setPendingStatus(null)}
            />

            {/* WhatsApp Notification Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showWhatsAppConfirm}
                title="Notify Customer"
                message="Would you like to notify the customer about this status update via WhatsApp?"
                variant="default"
                confirmText="Send WhatsApp"
                cancelText="Skip"
                onConfirm={handleWhatsAppConfirm}
                onCancel={handleWhatsAppCancel}
            />

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Hapus Pesanan Permanen"
                message={`Apakah Anda yakin ingin menghapus pesanan #${order.id.slice(0, 8)}? Tindakan ini tidak dapat dibatalkan.`}
                variant="danger"
                confirmText={isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
                cancelText="Batal"
                onConfirm={handleDeleteOrder}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
};
