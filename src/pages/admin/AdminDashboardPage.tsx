import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Wallet, ShoppingBag, Clock, AlertTriangle, Activity, ArrowRight, Calendar, ExternalLink } from 'lucide-react';
import styles from './AdminDashboardPage.module.css';



interface RecentOrder {
    id: string;
    customer_name: string;
    total_amount: number;
    status: string;
    created_at: string;
}

interface BatchInfo {
    id: string;
    title: string;
    delivery_date: string;
    status: string;
}

export const AdminDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [batch, setBatch] = useState<BatchInfo | null>(null);
    const [stats, setStats] = useState({
        totalOrders: 0,
        pendingPayment: 0,
        revenue: 0,
    });
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

    const fetchDashboardData = async () => {
        try {
            // 1. Get Active Batch (status = 'open')
            const { data: batchData, error: batchError } = await supabase
                .from('batches')
                .select('id, title, delivery_date, status')
                .eq('status', 'open')
                .maybeSingle();

            if (batchError) throw batchError;

            if (!batchData) {
                setBatch(null);
                setIsLoading(false);
                return;
            }

            setBatch(batchData);

            // 2. Get Orders for this batch
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('id, status, total_amount, customer_name, created_at')
                .eq('batch_id', batchData.id)
                .order('created_at', { ascending: false });

            if (ordersError) throw ordersError;

            // 3. Calculate Stats
            const totalOrders = orders?.length || 0;
            const pendingPayment = orders?.filter(o => o.status === 'pending_payment').length || 0;
            const revenue = orders?.reduce((sum, order) => {
                return order.status !== 'cancelled' ? sum + (order.total_amount || 0) : sum;
            }, 0) || 0;

            setStats({ totalOrders, pendingPayment, revenue });

            // 4. Set Recent Orders (5 latest)
            setRecentOrders((orders || []).slice(0, 5));

        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();

        // Realtime subscription
        const subscription = supabase
            .channel('dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchDashboardData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, fetchDashboardData)
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending_payment: 'Pending',
            payment_received: 'Paid',
            preparing: 'Preparing',
            ready: 'Ready',
            picked_up: 'Completed',
            cancelled: 'Cancelled'
        };
        return labels[status] || status;
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            pending_payment: '#f59e0b',
            payment_received: '#3b82f6',
            preparing: '#8b5cf6',
            ready: '#10b981',
            picked_up: '#6b7280',
            cancelled: '#ef4444'
        };
        return colors[status] || '#6b7280';
    };

    if (isLoading) {
        return (
            <div className={styles.loading}>
                <div className={styles.loadingSpinner}></div>
                Loading dashboard...
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Page Header */}
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.title}>Dashboard</h1>
                    <p className={styles.subtitle}>Overview of your business</p>
                </div>
                <Link to="/" target="_blank" className={styles.viewStoreBtn}>
                    <ExternalLink size={16} />
                    <span>Lihat Toko</span>
                </Link>
            </div>

            {/* No Active Batch Alert */}
            {!batch && (
                <div className={styles.alert}>
                    <AlertTriangle size={18} />
                    <span>No active batch. <Link to="/admin/batches" className={styles.alertLink}>Create one</Link> to start taking orders.</span>
                </div>
            )}

            {/* Batch Context Card */}
            {batch && (
                <div className={styles.batchContext}>
                    <div className={styles.batchInfo}>
                        <div className={styles.liveBadge}>
                            <span className={styles.liveDot}></span>
                            LIVE
                        </div>
                        <h2 className={styles.batchTitle}>{batch.title}</h2>
                        <div className={styles.batchDate}>
                            <Calendar size={14} />
                            {formatDate(batch.delivery_date)}
                        </div>
                    </div>
                    <Link to="/admin/batches" className={styles.viewBatchBtn}>
                        Kelola Batch <ArrowRight size={14} />
                    </Link>
                </div>
            )}

            {/* Stats Grid */}
            {batch && (
                <div className={styles.statsGrid}>
                    <Card className={`${styles.statCard} ${styles.revenueCard}`}>
                        <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                            <Wallet size={22} />
                        </div>
                        <div className={styles.statContent}>
                            <span className={styles.statLabel}>Omset</span>
                            <span className={styles.statValue}>
                                {new Intl.NumberFormat('id-ID', {
                                    style: 'currency',
                                    currency: 'IDR',
                                    maximumFractionDigits: 0
                                }).format(stats.revenue)}
                            </span>
                        </div>
                    </Card>

                    <Card className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                            <ShoppingBag size={20} />
                        </div>
                        <div className={styles.statContent}>
                            <span className={styles.statLabel}>Orders</span>
                            <span className={styles.statValue}>{stats.totalOrders}</span>
                        </div>
                    </Card>

                    <Link to="/admin/orders?filter=pending_payment" className={styles.statLink}>
                        <Card className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                                <Clock size={20} />
                            </div>
                            <div className={styles.statContent}>
                                <span className={styles.statLabel}>Pending</span>
                                <span className={styles.statValue}>{stats.pendingPayment}</span>
                            </div>
                        </Card>
                    </Link>
                </div>
            )}

            {/* Recent Activity Section */}
            {batch && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitleWrapper}>
                            <Activity size={18} />
                            <h3 className={styles.sectionTitle}>Recent Activity</h3>
                        </div>
                        <Link to="/admin/orders" className={styles.viewAllBtn}>
                            View All <ArrowRight size={14} />
                        </Link>
                    </div>
                    <Card className={styles.sectionCard}>
                        {recentOrders.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p>Belum ada pesanan</p>
                            </div>
                        ) : (
                            <div className={styles.activityList}>
                                {recentOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className={styles.activityItem}
                                        onClick={() => navigate('/admin/orders')}
                                    >
                                        <div className={styles.activityInfo}>
                                            <span className={styles.activityName}>{order.customer_name}</span>
                                            <span className={styles.activityTime}>{formatTime(order.created_at)}</span>
                                        </div>
                                        <div className={styles.activityRight}>
                                            <span
                                                className={styles.activityStatus}
                                                style={{ color: getStatusColor(order.status), background: `${getStatusColor(order.status)}15` }}
                                            >
                                                {getStatusLabel(order.status)}
                                            </span>
                                            <span className={styles.activityAmount}>
                                                {new Intl.NumberFormat('id-ID', {
                                                    style: 'currency',
                                                    currency: 'IDR',
                                                    maximumFractionDigits: 0
                                                }).format(order.total_amount)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
};
