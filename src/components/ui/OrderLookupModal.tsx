import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from './Button';
import { validatePhone, normalizePhone } from '../../utils/validation';
import styles from './OrderLookupModal.module.css';
import toast from 'react-hot-toast';

interface Order {
    id: string;
    customer_name: string;
    total_amount: number;
    status: string;
    created_at: string;
}

interface OrderLookupModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const OrderLookupModal: React.FC<OrderLookupModalProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const [phone, setPhone] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate phone
        const validation = validatePhone(phone);
        if (!validation.isValid) {
            setError(validation.error || 'Nomor tidak valid');
            return;
        }

        setIsSearching(true);
        setHasSearched(true);

        try {
            const normalizedPhone = normalizePhone(phone);

            const { data, error: queryError } = await supabase
                .from('orders')
                .select('id, customer_name, total_amount, status, created_at')
                .eq('customer_phone', normalizedPhone)
                .order('created_at', { ascending: false });

            if (queryError) throw queryError;

            setOrders(data || []);
        } catch (err) {
            console.error('Search error:', err);
            toast.error('Gagal mencari pesanan');
        } finally {
            setIsSearching(false);
        }
    };

    const handleOrderClick = (orderId: string) => {
        onClose();
        navigate(`/payment/${orderId}`);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending_payment': return styles.statusPending;
            case 'payment_received': return styles.statusReceived;
            case 'preparing': return styles.statusPreparing;
            case 'ready': return styles.statusReady;
            case 'picked_up': return styles.statusCompleted;
            case 'cancelled': return styles.statusCancelled;
            default: return '';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending_payment': return 'Menunggu Pembayaran';
            case 'payment_received': return 'Pembayaran Diterima';
            case 'preparing': return 'Sedang Disiapkan';
            case 'ready': return 'Siap Diambil';
            case 'picked_up': return 'Selesai';
            case 'cancelled': return 'Dibatalkan';
            default: return status;
        }
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

    const handleClose = () => {
        setPhone('');
        setOrders([]);
        setHasSearched(false);
        setError('');
        onClose();
    };

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Cek Status Pesanan</h2>
                    <button className={styles.closeButton} onClick={handleClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSearch} className={styles.searchForm}>
                    <div className={styles.inputGroup}>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => {
                                setPhone(e.target.value);
                                setError('');
                            }}
                            placeholder="Masukkan nomor WhatsApp..."
                            className={`${styles.input} ${error ? styles.inputError : ''}`}
                        />
                        <Button type="submit" isLoading={isSearching}>
                            <Search size={16} />
                            Cari
                        </Button>
                    </div>
                    {error && <p className={styles.error}>{error}</p>}
                    <p className={styles.hint}>Contoh: 08123456789 atau +628123456789</p>
                </form>

                <div className={styles.results}>
                    {hasSearched && orders.length === 0 && !isSearching && (
                        <div className={styles.emptyState}>
                            <Package size={48} className={styles.emptyIcon} />
                            <p>Tidak ada pesanan ditemukan</p>
                            <span className={styles.emptyHint}>
                                Pastikan nomor WhatsApp yang dimasukkan benar
                            </span>
                        </div>
                    )}

                    {orders.length > 0 && (
                        <div className={styles.orderList}>
                            <p className={styles.resultCount}>
                                Ditemukan {orders.length} pesanan
                            </p>
                            {orders.map((order) => (
                                <button
                                    key={order.id}
                                    className={styles.orderCard}
                                    onClick={() => handleOrderClick(order.id)}
                                >
                                    <div className={styles.orderHeader}>
                                        <span className={styles.orderId}>
                                            #{order.id.slice(0, 8)}
                                        </span>
                                        <span className={`${styles.status} ${getStatusColor(order.status)}`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </div>
                                    <div className={styles.orderDetails}>
                                        <span className={styles.orderName}>{order.customer_name}</span>
                                        <span className={styles.orderPrice}>
                                            {new Intl.NumberFormat('id-ID', {
                                                style: 'currency',
                                                currency: 'IDR',
                                                maximumFractionDigits: 0
                                            }).format(order.total_amount)}
                                        </span>
                                    </div>
                                    <span className={styles.orderDate}>{formatDate(order.created_at)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
