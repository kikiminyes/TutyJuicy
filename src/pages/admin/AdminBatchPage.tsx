import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Batch, BatchWithStock } from '../../types';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Dropdown, type DropdownItem } from '../../components/ui/Dropdown';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
    Plus, Edit, Package, Send, Lock, Copy, Trash2, Boxes,
    Calendar, X, ShoppingBag, DollarSign, Archive, Pencil, AlertTriangle, Check
} from 'lucide-react';
import styles from './AdminBatchPage.module.css';
import toast from 'react-hot-toast';
import { BatchFormModal } from './BatchFormModal';
import { EditStockModal } from './EditStockModal';

export const AdminBatchPage: React.FC = () => {
    const [batches, setBatches] = useState<BatchWithStock[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [batchToEdit, setBatchToEdit] = useState<Batch | null>(null);
    const [batchForStockEdit, setBatchForStockEdit] = useState<Batch | null>(null);
    const [selectedBatch, setSelectedBatch] = useState<BatchWithStock | null>(null); // For detail modal

    // Inline stock editing
    const [editingStockId, setEditingStockId] = useState<string | null>(null);
    const [editingStockValue, setEditingStockValue] = useState<number>(0);

    // Confirmation dialog
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant?: 'default' | 'warning' | 'danger';
        confirmText?: string;
        onConfirm: () => void | Promise<void>;
    } | null>(null);

    const fetchBatches = async () => {
        try {
            const { data, error } = await supabase
                .from('batches')
                .select(`
                    *,
                    batch_stocks (
                        quantity_available,
                        quantity_reserved,
                        menus (
                            id,
                            name,
                            image_url
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch order stats
            const { data: orders } = await supabase
                .from('orders')
                .select('batch_id, total_amount, status');

            const orderStats = (orders || []).reduce((acc: any, order: any) => {
                if (!acc[order.batch_id]) {
                    acc[order.batch_id] = { count: 0, revenue: 0 };
                }

                acc[order.batch_id].count += 1;

                // Only count revenue for non-cancelled orders
                if (order.status !== 'cancelled') {
                    acc[order.batch_id].revenue += (order.total_amount || 0);
                }

                return acc;
            }, {});

            const batchesWithStock = data.map((batch: any) => {
                const totalAvailable = batch.batch_stocks?.reduce(
                    (sum: number, s: any) => sum + (s.quantity_available || 0), 0
                ) || 0;

                const totalReserved = batch.batch_stocks?.reduce(
                    (sum: number, s: any) => sum + (s.quantity_reserved || 0), 0
                ) || 0;

                return {
                    ...batch,
                    total_items: batch.batch_stocks?.length || 0,
                    total_quantity: totalAvailable + totalReserved,
                    total_reserved: totalReserved,
                    order_count: orderStats[batch.id]?.count || 0,
                    total_revenue: orderStats[batch.id]?.revenue || 0
                };
            });

            setBatches(batchesWithStock);
        } catch (error) {
            console.error('Error fetching batches:', error);
            toast.error('Failed to load batches');
        } finally {
            setIsLoading(false);
        }
    };



    useEffect(() => {
        fetchBatches();
    }, []);

    // Filter batches by tab
    const activeBatches = batches.filter(b => b.status === 'draft' || b.status === 'open');
    const closedBatches = batches.filter(b => b.status === 'closed');
    const displayedBatches = activeTab === 'active' ? activeBatches : closedBatches;

    // Workflow handlers
    const handlePublish = async (batch: Batch) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Publish Batch',
            message: `Open "${batch.title}" for customer orders ? Only one batch can be open at a time.`,
            onConfirm: async () => {
                await supabase
                    .from('batches')
                    .update({ status: 'closed' })
                    .eq('status', 'open');

                const { error } = await supabase
                    .from('batches')
                    .update({ status: 'open' })
                    .eq('id', batch.id);

                if (!error) {
                    toast.success('Batch published successfully!');
                    fetchBatches();
                } else {
                    toast.error('Failed to publish batch');
                }
                setConfirmDialog(null);
            }
        });
    };

    const handleClose = async (batch: Batch) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Close Batch',
            message: `Close "${batch.title}" ? Customers will no longer be able to place orders.`,
            variant: 'warning',
            onConfirm: async () => {
                const { error } = await supabase
                    .from('batches')
                    .update({ status: 'closed' })
                    .eq('id', batch.id);

                if (!error) {
                    toast.success('Batch closed successfully!');
                    fetchBatches();
                } else {
                    toast.error('Failed to close batch');
                }
                setConfirmDialog(null);
            }
        });
    };

    const handleDuplicate = async (batch: Batch) => {
        try {
            const { data: batchData, error: fetchError } = await supabase
                .from('batches')
                .select('*, batch_stocks(*)')
                .eq('id', batch.id)
                .single();

            if (fetchError) throw fetchError;

            const newDeliveryDate = new Date(batch.delivery_date);
            newDeliveryDate.setDate(newDeliveryDate.getDate() + 7);

            const { data: newBatch, error: batchError } = await supabase
                .from('batches')
                .insert({
                    title: `${batch.title} (Copy)`,
                    delivery_date: newDeliveryDate.toISOString().split('T')[0],
                    status: 'draft'
                })
                .select()
                .single();

            if (batchError) throw batchError;

            const stockInserts = batchData.batch_stocks.map((stock: any) => ({
                batch_id: newBatch.id,
                menu_id: stock.menu_id,
                quantity_available: stock.quantity_available,
                quantity_reserved: 0
            }));

            const { error: stockError } = await supabase
                .from('batch_stocks')
                .insert(stockInserts);

            if (stockError) throw stockError;

            toast.success('Batch duplicated successfully!');
            fetchBatches();
        } catch (error: any) {
            console.error('Error duplicating batch:', error);
            toast.error(`Failed to duplicate batch: ${error.message} `);
        }
    };

    const handleDelete = async (batch: Batch) => {
        const { data: orders } = await supabase
            .from('orders')
            .select('id')
            .eq('batch_id', batch.id)
            .limit(1);

        if (orders && orders.length > 0) {
            toast.error('Cannot delete batch with existing orders. Close it instead.');
            return;
        }

        setConfirmDialog({
            isOpen: true,
            title: 'Delete Batch',
            message: `Permanently delete "${batch.title}" ? This action cannot be undone.`,
            variant: 'danger',
            confirmText: 'Delete',
            onConfirm: async () => {
                const { error } = await supabase
                    .from('batches')
                    .delete()
                    .eq('id', batch.id);

                if (!error) {
                    toast.success('Batch deleted successfully!');
                    fetchBatches();
                } else {
                    toast.error('Failed to delete batch. It may have orders.');
                }
                setConfirmDialog(null);
            }
        });
    };

    // Inline stock update
    const handleInlineStockSave = async (menuId: string, newTotal: number, reserved: number) => {
        // Can't reduce below reserved
        if (newTotal < reserved) {
            toast.error(`Cannot set stock below reserved amount (${reserved})`);
            return;
        }

        const newAvailable = newTotal - reserved;

        try {
            const { error } = await supabase
                .from('batch_stocks')
                .update({ quantity_available: newAvailable })
                .eq('batch_id', selectedBatch?.id)
                .eq('menu_id', menuId);

            if (error) throw error;

            toast.success('Stock updated!');
            setEditingStockId(null);
            fetchBatches();

            // Update selectedBatch locally
            if (selectedBatch) {
                const updatedStocks = (selectedBatch as any).batch_stocks.map((s: any) =>
                    s.menus?.id === menuId ? { ...s, quantity_available: newAvailable } : s
                );
                setSelectedBatch({ ...selectedBatch, batch_stocks: updatedStocks } as any);
            }
        } catch (error: any) {
            toast.error('Failed to update stock');
            console.error(error);
        }
    };

    // Get dropdown menu items
    const getMenuItems = (batch: Batch): DropdownItem[] => {
        const items: DropdownItem[] = [
            { label: 'Edit Batch', icon: Edit, onClick: () => setBatchToEdit(batch) },
            { label: 'Duplicate', icon: Copy, onClick: () => handleDuplicate(batch) }
        ];

        // Allow delete for draft and closed batches
        if (batch.status === 'draft' || batch.status === 'closed') {
            items.push({
                label: 'Delete Batch',
                icon: Trash2,
                onClick: () => handleDelete(batch),
                variant: 'danger'
            });
        }

        return items;
    };

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    // Calculate countdown
    const getCountdown = (deliveryDate: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const delivery = new Date(deliveryDate);
        delivery.setHours(0, 0, 0, 0);
        const diffTime = delivery.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { text: 'Passed', class: styles.countdownPassed };
        if (diffDays === 0) return { text: 'Today!', class: styles.countdownUrgent };
        if (diffDays === 1) return { text: 'Tomorrow', class: styles.countdownUrgent };
        if (diffDays <= 3) return { text: `${diffDays} days`, class: styles.countdownUrgent };
        return { text: `${diffDays} days`, class: styles.countdown };
    };



    // Get status badge class
    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'draft': return styles.statusDraft;
            case 'open': return styles.statusOpen;
            case 'closed': return styles.statusClosed;
            default: return '';
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loading}>
                <div className={styles.loadingSpinner}></div>
                Loading batches...
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Batches</h1>
                    <p className={styles.subtitle}>Manage pre-orders & stock</p>
                </div>
                <Button onClick={() => setIsCreateModalOpen(true)} size="sm" className={styles.newBatchBtn}>
                    <Plus size={18} />
                    New Batch
                </Button>
            </div>

            <div className={styles.tabsContainer}>
                <Tabs
                    tabs={[
                        { id: 'active', label: 'Open', count: activeBatches.length },
                        { id: 'closed', label: 'History', count: closedBatches.length }
                    ]}
                    activeTab={activeTab}
                    onChange={(tab) => setActiveTab(tab as 'active' | 'closed')}
                />
            </div>

            {displayedBatches.length === 0 ? (
                <div className={styles.emptyState}>
                    <Boxes size={48} className={styles.emptyIcon} />
                    <h3 className={styles.emptyTitle}>
                        {activeTab === 'active' ? 'No active batches' : 'No history yet'}
                    </h3>
                    <p className={styles.emptyText}>
                        {activeTab === 'active'
                            ? 'Create a new batch to start accepting pre-orders.'
                            : 'Closed batches will appear here.'
                        }
                    </p>
                    {activeTab === 'active' && (
                        <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
                            <Plus size={18} />
                            Create First Batch
                        </Button>
                    )}
                </div>
            ) : (
                <div className={styles.grid}>
                    {displayedBatches.map((batch) => {
                        const countdown = getCountdown(batch.delivery_date);

                        return (
                            <div
                                key={batch.id}
                                className={`${styles.card} ${batch.status === 'open' ? styles.cardActive : ''}`}
                                onClick={() => setSelectedBatch(batch)}
                            >
                                {/* Top Row: Status & Menu */}
                                <div className={styles.cardHeader}>
                                    <span className={`${styles.statusBadge} ${getStatusBadgeClass(batch.status)}`}>
                                        {batch.status === 'open' && <span className={styles.liveDot}></span>}
                                        {batch.status}
                                    </span>
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <Dropdown items={getMenuItems(batch)} />
                                    </div>
                                </div>

                                {/* Main Info: Title & Date - SIMPLIFIED */}
                                <div className={styles.cardBody}>
                                    <h3 className={styles.batchTitle}>{batch.title}</h3>

                                    <div className={styles.deliveryInfo}>
                                        <div className={styles.dateBadge}>
                                            <Calendar size={14} />
                                            {formatDate(batch.delivery_date)}
                                        </div>
                                        {batch.status !== 'closed' && (
                                            <span className={`${styles.countdownBadge} ${countdown.class}`}>
                                                {countdown.text}
                                            </span>
                                        )}
                                    </div>

                                    {/* Simple summary line */}
                                    <div className={styles.cardSummary}>
                                        <span>{batch.order_count || 0} orders</span>
                                        <span className={styles.dot}>•</span>
                                        <span>{batch.total_items || 0} items</span>
                                    </div>
                                </div>

                                {/* Simple Footer */}
                                <div className={styles.cardFooter}>
                                    {batch.status === 'draft' && (
                                        <button
                                            className={`${styles.actionBtn} ${styles.btnPublish}`}
                                            onClick={(e) => { e.stopPropagation(); handlePublish(batch); }}
                                        >
                                            Publish Batch
                                            <Send size={16} />
                                        </button>
                                    )}

                                    {batch.status === 'open' && (
                                        <button
                                            className={`${styles.actionBtn} ${styles.btnClose}`}
                                            onClick={(e) => { e.stopPropagation(); handleClose(batch); }}
                                        >
                                            Close Batch
                                            <Lock size={16} />
                                        </button>
                                    )}

                                    {batch.status === 'closed' && (
                                        <div className={styles.closedLabel}>
                                            <Archive size={14} />
                                            Archived
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
            {isCreateModalOpen && (
                <BatchFormModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => {
                        setIsCreateModalOpen(false);
                        fetchBatches();
                    }}
                />
            )}

            {/* Edit Modal */}
            {batchToEdit && (
                <BatchFormModal
                    isOpen={!!batchToEdit}
                    batchToEdit={batchToEdit}
                    onClose={() => setBatchToEdit(null)}
                    onSuccess={() => {
                        setBatchToEdit(null);
                        fetchBatches();
                    }}
                />
            )}

            {/* Edit Stock Modal */}
            {batchForStockEdit && (
                <EditStockModal
                    isOpen={!!batchForStockEdit}
                    batch={batchForStockEdit}
                    onClose={() => setBatchForStockEdit(null)}
                    onSuccess={() => {
                        setBatchForStockEdit(null);
                        fetchBatches();
                    }}
                />
            )}

            {/* Batch Detail Drawer */}
            {selectedBatch && (
                <div className={styles.detailOverlay} onClick={() => setSelectedBatch(null)}>
                    <div className={styles.detailModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.detailHeader}>
                            <div className={styles.detailHeaderInfo}>
                                <span className={`${styles.statusBadge} ${getStatusBadgeClass(selectedBatch.status)}`}>
                                    {selectedBatch.status === 'open' && <span className={styles.liveDot}></span>}
                                    {selectedBatch.status}
                                </span>
                                <h2 className={styles.detailTitle}>{selectedBatch.title}</h2>
                                <div className={styles.detailDate}>
                                    <Calendar size={16} />
                                    {formatDate(selectedBatch.delivery_date)}
                                    {selectedBatch.status !== 'closed' && (
                                        <span className={`${styles.countdownBadge} ${getCountdown(selectedBatch.delivery_date).class}`}>
                                            {getCountdown(selectedBatch.delivery_date).text}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setSelectedBatch(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.detailBody}>
                            {/* Summary Stats */}
                            <div className={styles.summaryRow}>
                                <div className={styles.summaryItem}>
                                    <ShoppingBag size={16} />
                                    <span className={styles.summaryValue}>{selectedBatch.order_count || 0}</span>
                                    <span className={styles.summaryLabel}>Orders</span>
                                </div>
                                <div className={styles.summaryDivider} />
                                <div className={styles.summaryItem}>
                                    <DollarSign size={16} />
                                    <span className={styles.summaryValue}>
                                        {new Intl.NumberFormat('id-ID', {
                                            style: 'currency',
                                            currency: 'IDR',
                                            maximumFractionDigits: 0
                                        }).format(selectedBatch.total_revenue || 0)}
                                    </span>
                                    <span className={styles.summaryLabel}>Omset</span>
                                </div>
                            </div>

                            {/* Stock Items List */}
                            <div className={styles.stockSection}>
                                <div className={styles.stockSectionHeader}>
                                    <Package size={16} />
                                    <span>Stock Details</span>
                                    <span className={styles.stockBadge}>
                                        {(selectedBatch as any).total_reserved || 0} / {selectedBatch.total_quantity || 0} reserved
                                    </span>
                                </div>
                                <div className={styles.stockList}>
                                    {(selectedBatch as any).batch_stocks?.map((stock: any) => {
                                        const total = stock.quantity_available + stock.quantity_reserved;
                                        const reserved = stock.quantity_reserved;
                                        const available = stock.quantity_available;
                                        const percent = total > 0 ? (reserved / total) * 100 : 0;
                                        const isLowStock = available > 0 && available <= 3;
                                        const isEditing = editingStockId === stock.menus?.id;

                                        return (
                                            <div key={stock.menus?.id || Math.random()} className={styles.stockItem}>
                                                {stock.menus?.image_url ? (
                                                    <img src={stock.menus.image_url} alt={stock.menus.name} className={styles.stockItemImage} />
                                                ) : (
                                                    <div className={styles.stockItemPlaceholder}>
                                                        <Package size={16} />
                                                    </div>
                                                )}
                                                <div className={styles.stockItemInfo}>
                                                    <div className={styles.stockItemHeader}>
                                                        <span className={styles.stockItemName}>{stock.menus?.name || 'Unknown'}</span>
                                                        {isLowStock && (
                                                            <span className={styles.lowStockBadge}>
                                                                <AlertTriangle size={12} />
                                                                Low
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className={styles.stockItemBar}>
                                                        <div
                                                            className={`${styles.stockItemBarFill} ${percent >= 80 ? styles.barHigh : ''}`}
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                    <div className={styles.stockItemMeta}>
                                                        <span className={styles.metaAvailable}>Available: {available}</span>
                                                        <span className={styles.metaReserved}>Reserved: {reserved}</span>
                                                    </div>
                                                </div>
                                                <div className={styles.stockItemActions}>
                                                    {isEditing ? (
                                                        <div className={styles.editStockForm}>
                                                            <input
                                                                type="number"
                                                                min={reserved}
                                                                value={editingStockValue}
                                                                onChange={(e) => setEditingStockValue(Math.max(reserved, parseInt(e.target.value) || 0))}
                                                                className={styles.editStockInput}
                                                                autoFocus
                                                            />
                                                            <button
                                                                className={styles.editStockSave}
                                                                onClick={() => handleInlineStockSave(stock.menus?.id, editingStockValue, reserved)}
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                            <button
                                                                className={styles.editStockCancel}
                                                                onClick={() => setEditingStockId(null)}
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className={styles.stockItemQty}>
                                                                <span className={styles.stockItemReserved}>{reserved}</span>
                                                                <span className={styles.stockItemTotal}>/ {total}</span>
                                                            </div>
                                                            <button
                                                                className={styles.editStockBtn}
                                                                onClick={() => {
                                                                    setEditingStockId(stock.menus?.id);
                                                                    setEditingStockValue(total);
                                                                }}
                                                                title="Edit stock"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {!(selectedBatch as any).batch_stocks?.length && (
                                        <div className={styles.emptyStock}>No stock items</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions - Only status actions */}
                        <div className={styles.detailActions}>
                            {selectedBatch.status === 'draft' && (
                                <button
                                    className={`${styles.actionBtnLarge} ${styles.btnPublish}`}
                                    onClick={() => {
                                        handlePublish(selectedBatch);
                                        setSelectedBatch(null);
                                    }}
                                >
                                    <Send size={18} />
                                    Publish Batch
                                </button>
                            )}

                            {selectedBatch.status === 'open' && (
                                <button
                                    className={`${styles.actionBtnLarge} ${styles.btnClose}`}
                                    onClick={() => {
                                        handleClose(selectedBatch);
                                        setSelectedBatch(null);
                                    }}
                                >
                                    <Lock size={18} />
                                    Close Batch
                                </button>
                            )}

                            {selectedBatch.status === 'closed' && (
                                <div className={styles.closedInfo}>
                                    <Archive size={16} />
                                    This batch has been archived
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Dialog */}
            {confirmDialog && (
                <ConfirmDialog
                    isOpen={confirmDialog.isOpen}
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    variant={confirmDialog.variant}
                    confirmText={confirmDialog.confirmText}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}
        </div>
    );
};
