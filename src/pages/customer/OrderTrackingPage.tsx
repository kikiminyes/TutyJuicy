import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Search, ArrowLeft, Clock, CheckCircle, Package,
    XCircle, ChevronRight, Phone
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { validatePhone, normalizePhone } from '../../utils/validation';
import toast from 'react-hot-toast';
import type { Order } from '../../types';
import styles from './OrderTrackingPage.module.css';

export const OrderTrackingPage: React.FC = () => {
    const [phone, setPhone] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const navigate = useNavigate();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setPhoneError('');
        setHasSearched(false);

        const validation = validatePhone(phone);
        if (!validation.isValid) {
            setPhoneError(validation.error || 'Nomor tidak valid');
            return;
        }

        setIsLoading(true);
        try {
            const normalizedPhone = normalizePhone(phone);

            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('customer_phone', normalizedPhone)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setOrders(data || []);
            setHasSearched(true);

            if (!data || data.length === 0) {
                toast('Tidak ada pesanan ditemukan', { icon: 'ℹ️' });
            }
        } catch (error: any) {
            toast.error('Gagal mencari pesanan');
        } finally {
            setIsLoading(false);
        }
    };

    // 5-step workflow colors
    const WORKFLOW_STEPS = [
        { key: 'pilih', color: '#ff7f50' },      // Orange
        { key: 'bayar', color: '#f59e0b' },      // Amber
        { key: 'terverifikasi', color: '#3b82f6' }, // Blue
        { key: 'disiapkan', color: '#8b5cf6' },  // Purple
        { key: 'siap', color: '#10b981' },       // Green
    ];

    const getStepFromStatus = (status: string): number => {
        switch (status) {
            case 'pending_payment': return 2; // Bayar
            case 'payment_received': return 3; // Terverifikasi
            case 'preparing': return 4; // Disiapkan
            case 'ready':
            case 'picked_up': return 5; // Siap
            default: return 1;
        }
    };

    const getStatusInfo = (status: string) => {
        const statusMap: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
            pending_payment: { label: 'Menunggu Pembayaran', color: '#f59e0b', bgColor: '#fef3c7', icon: Clock },
            payment_received: { label: 'Pembayaran Terverifikasi', color: '#3b82f6', bgColor: '#dbeafe', icon: CheckCircle },
            preparing: { label: 'Sedang Disiapkan', color: '#8b5cf6', bgColor: '#ede9fe', icon: Package },
            ready: { label: 'Siap Diambil', color: '#10b981', bgColor: '#d1fae5', icon: CheckCircle },
            picked_up: { label: 'Selesai', color: '#10b981', bgColor: '#d1fae5', icon: CheckCircle },
            cancelled: { label: 'Dibatalkan', color: '#ef4444', bgColor: '#fee2e2', icon: XCircle },
        };
        return statusMap[status] || { label: status, color: '#6b7280', bgColor: '#f3f4f6', icon: Clock };
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(price);
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <Link to="/" className={styles.backBtn}>
                    <ArrowLeft size={20} />
                </Link>
                <h1 className={styles.headerTitle}>Cek Pesanan</h1>
                <div className={styles.headerSpacer}></div>
            </header>

            <main className={styles.main}>
                {/* Search Section */}
                <section className={styles.searchSection}>
                    <div className={styles.searchIcon}>
                        <Search size={32} />
                    </div>
                    <h2 className={styles.searchTitle}>Lacak Pesananmu</h2>
                    <p className={styles.searchDesc}>
                        Masukkan nomor WhatsApp yang digunakan saat memesan
                    </p>

                    <form onSubmit={handleSearch} className={styles.searchForm}>
                        <div className={styles.inputWrapper}>
                            <Phone size={18} className={styles.inputIcon} />
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '');
                                    setPhone(value);
                                    if (phoneError) setPhoneError('');
                                }}
                                placeholder="08123456789"
                                className={`${styles.input} ${phoneError ? styles.inputError : ''}`}
                            />
                        </div>
                        {phoneError && (
                            <span className={styles.errorText}>{phoneError}</span>
                        )}
                        <button
                            type="submit"
                            className={styles.searchBtn}
                            disabled={isLoading || !phone}
                        >
                            {isLoading ? (
                                <span className={styles.spinner}></span>
                            ) : (
                                <>
                                    <Search size={18} />
                                    Cari Pesanan
                                </>
                            )}
                        </button>
                    </form>
                </section>

                {/* Results Section */}
                {hasSearched && (
                    <section className={styles.resultsSection}>
                        {orders.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>
                                    <Package size={32} />
                                </div>
                                <h3 className={styles.emptyTitle}>Pesanan Tidak Ditemukan</h3>
                                <p className={styles.emptyText}>
                                    Pastikan nomor yang dimasukkan sama dengan saat memesan.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className={styles.resultsHeader}>
                                    <h3 className={styles.resultsTitle}>
                                        Ditemukan {orders.length} pesanan
                                    </h3>
                                </div>

                                <div className={styles.ordersList}>
                                    {orders.map((order) => {
                                        const statusInfo = getStatusInfo(order.status);
                                        const StatusIcon = statusInfo.icon;
                                        const currentStep = getStepFromStatus(order.status);
                                        const isCancelled = order.status === 'cancelled';

                                        return (
                                            <button
                                                key={order.id}
                                                className={styles.orderCard}
                                                onClick={() => navigate(`/payment/${order.id}`)}
                                            >
                                                <div className={styles.orderMain}>
                                                    <div
                                                        className={styles.orderStatus}
                                                        style={{ backgroundColor: statusInfo.bgColor }}
                                                    >
                                                        <StatusIcon size={20} style={{ color: statusInfo.color }} />
                                                    </div>
                                                    <div className={styles.orderInfo}>
                                                        <span className={styles.orderId}>
                                                            #{order.id.slice(0, 8)}
                                                        </span>
                                                        <span
                                                            className={styles.orderStatusText}
                                                            style={{ color: statusInfo.color }}
                                                        >
                                                            {statusInfo.label}
                                                        </span>
                                                    </div>
                                                    <ChevronRight size={20} className={styles.orderArrow} />
                                                </div>

                                                {/* Mini Step Progress */}
                                                {!isCancelled && (
                                                    <div className={styles.miniProgress}>
                                                        {WORKFLOW_STEPS.map((step, index) => (
                                                            <div
                                                                key={step.key}
                                                                className={styles.miniDot}
                                                                style={{
                                                                    backgroundColor: index + 1 <= currentStep ? step.color : '#e5e7eb'
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}

                                                <div className={styles.orderMeta}>
                                                    <span className={styles.orderDate}>
                                                        {formatDate(order.created_at)}
                                                    </span>
                                                    <span className={styles.orderPrice}>
                                                        {formatPrice(order.total_amount)}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
};
