import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order } from '../../types';
import { ClipboardList, Archive, Clock, CheckSquare, Square, Check, Trash2, Search, X } from 'lucide-react';
import styles from './AdminOrderPage.module.css';
import toast from 'react-hot-toast';
import { OrderDetailModal } from './OrderDetailModal';

type ViewMode = 'current_batch' | 'all_history';

export const AdminOrderPage: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<string>('pending_payment'); // Default to Pending
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('current_batch');
    const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

    // Bulk Action State
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const searchDropdownRef = React.useRef<HTMLDivElement>(null);

    // Fetch current batch
    useEffect(() => {
        const fetchCurrentBatch = async () => {
            const { data } = await supabase
                .from('batches')
                .select('id')
                .eq('status', 'open')
                .single();
            if (data) setCurrentBatchId(data.id);
        };
        fetchCurrentBatch();
    }, []);

    const fetchOrders = async () => {
        try {
            let query = supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            if (viewMode === 'current_batch' && currentBatchId) {
                query = query.eq('batch_id', currentBatchId);
            }

            const { data, error } = await query;

            if (error) throw error;
            let filteredOrders = data || [];

            // Apply search filter locally
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                filteredOrders = filteredOrders.filter(order =>
                    order.customer_name.toLowerCase().includes(query) ||
                    order.customer_phone.includes(query) ||
                    order.id.toLowerCase().includes(query)
                );
            }

            setOrders(filteredOrders);
            // Clear selection when list changes/refreshes to avoid phantom selections
            setSelectedOrderIds(new Set());
        } catch (error) {
            console.error('Error fetching orders:', error);
            toast.error('Failed to load orders');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();

        // Realtime subscription
        const subscription = supabase
            .channel('admin-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [filter, viewMode, currentBatchId, searchQuery]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
                setIsSearchDropdownOpen(false);
            }
        };

        if (isSearchDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSearchDropdownOpen]);

    const handleViewDetails = (order: Order) => {
        setSelectedOrder(order);
    };

    const handleCloseModal = () => {
        setSelectedOrder(null);
    };

    // Bulk Selection Helpers
    const handleToggleSelect = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        const newSelected = new Set(selectedOrderIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedOrderIds(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedOrderIds.size === orders.length && orders.length > 0) {
            setSelectedOrderIds(new Set());
        } else {
            const allIds = new Set(orders.map(o => o.id));
            setSelectedOrderIds(allIds);
        }
    };

    const handleBulkUpdate = async (newStatus: Order['status']) => {
        setIsBulkUpdating(true);
        try {
            const ids = Array.from(selectedOrderIds);

            // If cancelling orders, we need to restore stock first
            if (newStatus === 'cancelled') {
                // Get the orders being cancelled to know which batch they belong to
                const ordersToCancel = orders.filter(o => ids.includes(o.id));

                for (const order of ordersToCancel) {
                    // Skip if already cancelled (to avoid double restore)
                    if (order.status === 'cancelled') continue;

                    // Get order items for this order
                    const { data: orderItems, error: itemsError } = await supabase
                        .from('order_items')
                        .select('menu_id, quantity')
                        .eq('order_id', order.id);

                    if (itemsError) {
                        console.error('Error fetching order items:', itemsError);
                        continue;
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
                }
            }

            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .in('id', ids);

            if (error) throw error;

            toast.success(`Updated ${ids.length} orders to ${newStatus.replace('_', ' ').toUpperCase()}`);
            setSelectedOrderIds(new Set());
            fetchOrders();
        } catch (error) {
            console.error('Bulk update error:', error);
            toast.error('Failed to update orders');
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to permanently delete ${selectedOrderIds.size} cancelled order(s)? This action cannot be undone.`)) {
            return;
        }

        setIsBulkUpdating(true);
        try {
            const ids = Array.from(selectedOrderIds);
            console.log('Bulk delete starting for ids:', ids);

            // Delete orders directly - payment_proofs and order_items will be
            // automatically deleted via ON DELETE CASCADE constraint in database
            const { data, error } = await supabase
                .from('orders')
                .delete()
                .in('id', ids)
                .select();

            console.log('Bulk delete result - data:', data, 'error:', error);

            if (error) throw error;

            toast.success(`Deleted ${ids.length} cancelled order(s)`);
            setSelectedOrderIds(new Set());
            fetchOrders();
        } catch (error) {
            console.error('Bulk delete error:', error);
            toast.error('Failed to delete orders');
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'pending_payment': return styles.status_pending_payment;
            case 'payment_received': return styles.status_payment_received;
            case 'preparing': return styles.status_preparing;
            case 'ready': return styles.status_ready;
            case 'picked_up': return styles.status_picked_up;
            case 'cancelled': return styles.status_cancelled;
            default: return '';
        }
    };

    // Filter tabs WITHOUT "All Orders" - mapped with colors
    const filterTabs = [
        { id: 'pending_payment', label: 'Pending', colorClass: styles.status_pending_payment },
        { id: 'payment_received', label: 'Paid', colorClass: styles.status_payment_received },
        { id: 'preparing', label: 'Preparing', colorClass: styles.status_preparing },
        { id: 'ready', label: 'Ready', colorClass: styles.status_ready },
        { id: 'picked_up', label: 'Completed', colorClass: styles.status_picked_up },
        { id: 'cancelled', label: 'Cancelled', colorClass: styles.status_cancelled },
    ];

    if (isLoading) return <div className={styles.loading}>Loading orders...</div>;

    const allSelected = orders.length > 0 && selectedOrderIds.size === orders.length;

    return (
        <div className={styles.pageContainer}>
            <div className={styles.header}>
                <div className={styles.topRow}>
                    <h1 className={styles.title}>Order Management</h1>


                    {/* Dropdown Search - Mobile Only */}
                    <div className={styles.searchDropdownContainer} ref={searchDropdownRef}>
                        <button
                            className={styles.searchIconBtn}
                            onClick={() => {
                                setIsSearchDropdownOpen(!isSearchDropdownOpen);
                                if (!isSearchDropdownOpen) {
                                    setTimeout(() => searchInputRef.current?.focus(), 150);
                                }
                            }}
                            title="Search orders"
                        >
                            <Search size={20} />
                        </button>

                        {isSearchDropdownOpen && (
                            <div className={styles.searchDropdown}>
                                <div className={styles.searchContainer}>
                                    <Search size={16} className={styles.searchIcon} />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Cari nama/no HP..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className={styles.searchInput}
                                    />
                                    {searchQuery && (
                                        <button
                                            className={styles.clearSearch}
                                            onClick={() => setSearchQuery('')}
                                            title="Clear search"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Desktop Search - Always Visible */}
                    <div className={styles.desktopSearchContainer}>
                        <Search size={16} className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Cari nama/no HP..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                        {searchQuery && (
                            <button
                                className={styles.clearSearch}
                                onClick={() => setSearchQuery('')}
                                title="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <div className={styles.viewToggle}>
                        <button
                            className={`${styles.toggleOption} ${viewMode === 'current_batch' ? styles.activeOption : ''}`}
                            onClick={() => setViewMode('current_batch')}
                        >
                            <Clock size={16} />
                            <span>Current Batch</span>
                        </button>
                        <button
                            className={`${styles.toggleOption} ${viewMode === 'all_history' ? styles.activeOption : ''}`}
                            onClick={() => setViewMode('all_history')}
                        >
                            <Archive size={16} />
                            <span>All History</span>
                        </button>
                    </div>
                </div>

                <div className={styles.filterContainer}>
                    {filterTabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={`${styles.filterTab} ${tab.colorClass} ${filter === tab.id ? styles.activeTab : ''}`}
                            onClick={() => setFilter(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className={styles.toolbar}>
                    <div className={styles.toolbarRow}>
                        <div className={styles.leftToolbar}>
                            {filter !== 'all' && (
                                <button
                                    className={`${styles.selectAllBtn} ${allSelected ? styles.activeSelectAll : ''}`}
                                    onClick={handleSelectAll}
                                    title={allSelected ? "Deselect All" : "Select All Visible"}
                                >
                                    {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                    <span>{allSelected ? 'All Selected' : 'Select All'}</span>
                                </button>
                            )}
                        </div>

                        <div className={styles.rightToolbar}>
                            <button
                                className={`${styles.allOrdersBtn} ${filter === 'all' ? styles.activeAllBtn : ''}`}
                                onClick={() => setFilter('all')}
                            >
                                <ClipboardList size={16} />
                                <span>All Orders</span>
                            </button>
                        </div>
                    </div>

                    {/* Bulk Action Row - Below All Orders */}
                    {selectedOrderIds.size > 0 && filter !== 'all' && (
                        <div className={styles.bulkActionRow}>
                            {filter === 'pending_payment' && (
                                <button onClick={() => handleBulkUpdate('cancelled')} className={`${styles.bulkActionBtn} ${styles.deleteBtn}`} disabled={isBulkUpdating}>
                                    Batalkan Pesanan
                                </button>
                            )}
                            {filter === 'payment_received' && (
                                <button onClick={() => handleBulkUpdate('preparing')} className={styles.bulkActionBtn} disabled={isBulkUpdating}>
                                    Tandai Preparing
                                </button>
                            )}
                            {filter === 'preparing' && (
                                <button onClick={() => handleBulkUpdate('ready')} className={styles.bulkActionBtn} disabled={isBulkUpdating}>
                                    Tandai Ready
                                </button>
                            )}
                            {filter === 'ready' && (
                                <button onClick={() => handleBulkUpdate('picked_up')} className={styles.bulkActionBtn} disabled={isBulkUpdating}>
                                    Tandai Selesai
                                </button>
                            )}
                            {filter === 'cancelled' && (
                                <button onClick={handleBulkDelete} className={`${styles.bulkActionBtn} ${styles.deleteBtn}`} disabled={isBulkUpdating}>
                                    <Trash2 size={16} />
                                    Hapus Pesanan
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className={styles.list}>
                {orders.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>
                            <ClipboardList size={32} />
                        </div>
                        <h3 className={styles.emptyTitle}>No orders found</h3>
                        <p className={styles.emptyText}>
                            {filter === 'all'
                                ? 'Orders will appear here when customers place them.'
                                : `No orders with status "${filter.replace('_', ' ')}"`}
                        </p>
                    </div>
                ) : (
                    orders.map((order) => {
                        const isSelected = selectedOrderIds.has(order.id);
                        return (
                            <div
                                key={order.id}
                                className={`${styles.orderCard} ${getStatusStyle(order.status)} ${isSelected ? styles.selectedCard : ''}`}
                                onClick={() => handleViewDetails(order)}
                            >
                                {filter !== 'all' && (
                                    <div
                                        className={styles.selectionArea}
                                        onClick={(e) => handleToggleSelect(order.id, e)}
                                    >
                                        <div className={`${styles.checkbox} ${isSelected ? styles.checked : ''}`}>
                                            {isSelected && <Check size={12} color="white" />}
                                        </div>
                                    </div>
                                )}

                                <div className={styles.cardContent}>
                                    <div className={styles.orderInfo}>
                                        <div className={styles.orderHeader}>
                                            <h3 className={styles.orderId}>#{order.id.slice(0, 8)}</h3>
                                            <span className={`${styles.statusBadge} ${getStatusStyle(order.status)}`}>
                                                {order.status.replace('_', ' ')}
                                            </span>
                                            {order.payment_method && order.payment_method !== 'pending' && (
                                                <span className={styles.paymentMethodBadge}>
                                                    {order.payment_method === 'cod' ? 'COD' : order.payment_method.toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.customerInfo}>
                                            <span className={styles.customerName}>{order.customer_name}</span>
                                            <span className={styles.dot}></span>
                                            <span>{order.customer_phone}</span>
                                        </div>
                                        <p className={styles.date}>{new Date(order.created_at).toLocaleString()}</p>
                                    </div>

                                    <div className={styles.cardRight}>
                                        <span className={styles.price}>
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.total_amount)}
                                        </span>
                                        <span className={styles.viewBtn}>Tap to view details</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>





            {selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
                    onClose={handleCloseModal}
                    onUpdate={fetchOrders}
                />
            )}
        </div>
    );
};
