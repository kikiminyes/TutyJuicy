import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Batch } from '../../types';
import { Button } from '../../components/ui/Button';
import { X, AlertTriangle } from 'lucide-react';
import styles from './EditStockModal.module.css';
import toast from 'react-hot-toast';

interface EditStockModalProps {
    isOpen: boolean;
    batch: Batch | null;
    onClose: () => void;
    onSuccess: () => void;
}

interface StockItem {
    id: string;
    menu_id: string;
    menu_name: string;
    menu_image?: string;
    quantity_available: number;
    quantity_reserved: number;
}

export const EditStockModal: React.FC<EditStockModalProps> = ({ isOpen, batch, onClose, onSuccess }) => {
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    useEffect(() => {
        const fetchStockData = async () => {
            if (!batch) return;

            setIsFetching(true);
            try {
                const { data, error } = await supabase
                    .from('batch_stocks')
                    .select(`
                        id,
                        menu_id,
                        quantity_available,
                        quantity_reserved,
                        menus!inner (
                            name,
                            image_url
                        )
                    `)
                    .eq('batch_id', batch.id)
                    .order('menus(name)');

                if (error) throw error;

                const formattedData: StockItem[] = (data || []).map((item: any) => ({
                    id: item.id,
                    menu_id: item.menu_id,
                    menu_name: item.menus.name,
                    menu_image: item.menus.image_url,
                    quantity_available: item.quantity_available,
                    quantity_reserved: item.quantity_reserved
                }));

                setStockItems(formattedData);
            } catch (error: any) {
                console.error('Error fetching stock data:', error);
                toast.error('Failed to load stock data');
            } finally {
                setIsFetching(false);
            }
        };

        if (isOpen && batch) {
            fetchStockData();
        }
    }, [isOpen, batch]);

    if (!isOpen || !batch) return null;

    const handleQuantityChange = (stockId: string, value: string) => {
        // Remove leading zeros and parse properly
        const sanitized = value.replace(/^0+/, '') || '0';
        const newValue = Math.max(0, parseInt(sanitized) || 0);
        setStockItems(prev =>
            prev.map(item =>
                item.id === stockId
                    ? { ...item, quantity_available: newValue }
                    : item
            )
        );
    };

    const adjustQuantity = (stockId: string, delta: number) => {
        setStockItems(prev =>
            prev.map(item =>
                item.id === stockId
                    ? { ...item, quantity_available: Math.max(0, item.quantity_available + delta) }
                    : item
            )
        );
    };

    const getInvalidItems = () => {
        return stockItems.filter(item => item.quantity_available < item.quantity_reserved);
    };

    const hasValidationErrors = getInvalidItems().length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const invalidItems = getInvalidItems();
        if (invalidItems.length > 0) {
            const itemNames = invalidItems.map(i => i.menu_name).join(', ');
            toast.error(`Cannot set available stock below reserved quantity for: ${itemNames}`);
            return;
        }

        setIsLoading(true);

        try {
            const updates = stockItems.map(item =>
                supabase
                    .from('batch_stocks')
                    .update({ quantity_available: item.quantity_available })
                    .eq('id', item.id)
            );

            const results = await Promise.all(updates);

            const failedUpdate = results.find(result => result.error);
            if (failedUpdate?.error) {
                throw failedUpdate.error;
            }

            toast.success('Stock updated successfully!');
            onSuccess();
        } catch (error: any) {
            console.error('Error updating stock:', error);
            toast.error(`Failed: ${error.message || 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const isItemInvalid = (item: StockItem) => item.quantity_available < item.quantity_reserved;
    const getStockStatus = (item: StockItem) => {
        const remaining = item.quantity_available - item.quantity_reserved;
        if (remaining === 0) return 'sold-out';
        if (remaining <= 3) return 'low';
        return 'normal';
    };

    const totalAvailable = stockItems.reduce((sum, item) => sum + item.quantity_available, 0);
    const totalReserved = stockItems.reduce((sum, item) => sum + item.quantity_reserved, 0);
    const totalRemaining = totalAvailable - totalReserved;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <h2 className={styles.title}>Edit Stock</h2>
                        <p className={styles.subtitle}>{batch.title}</p>
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>

                {isFetching ? (
                    <div className={styles.loading}>
                        <div className={styles.loadingSpinner}></div>
                        Loading stock data...
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className={styles.form}>
                        {/* Summary Stats */}
                        <div className={styles.summary}>
                            <div className={styles.summaryItem}>
                                <span className={styles.summaryLabel}>Total Stock</span>
                                <span className={styles.summaryValue}>{totalAvailable}</span>
                            </div>
                            <div className={styles.summaryItem}>
                                <span className={styles.summaryLabel}>Reserved</span>
                                <span className={`${styles.summaryValue} ${styles.summaryReserved}`}>
                                    {totalReserved}
                                </span>
                            </div>
                            <div className={styles.summaryItem}>
                                <span className={styles.summaryLabel}>Remaining</span>
                                <span className={`${styles.summaryValue} ${totalRemaining <= 5 ? styles.summaryLow : styles.summaryGood}`}>
                                    {totalRemaining}
                                </span>
                            </div>
                        </div>

                        {/* Stock List */}
                        <div className={styles.stockList}>
                            <div className={styles.stockHeader}>
                                <div>Menu Item</div>
                                <div>Available</div>
                                <div>Reserved</div>
                            </div>

                            {stockItems.map(item => {
                                const status = getStockStatus(item);
                                const invalid = isItemInvalid(item);

                                return (
                                    <div
                                        key={item.id}
                                        className={`${styles.stockRow} ${invalid ? styles.stockRowError : ''} ${status === 'low' ? styles.stockRowLow : ''} ${status === 'sold-out' ? styles.stockRowSoldOut : ''}`}
                                    >
                                        <div className={styles.menuColumn}>
                                            <div className={styles.menuInfo}>
                                                {item.menu_image && (
                                                    <img
                                                        src={item.menu_image}
                                                        alt={item.menu_name}
                                                        className={styles.menuImage}
                                                    />
                                                )}
                                                <div className={styles.menuDetails}>
                                                    <span className={styles.menuName}>{item.menu_name}</span>
                                                    {status === 'low' && (
                                                        <span className={styles.stockWarning}>
                                                            <AlertTriangle size={10} />
                                                            Low stock
                                                        </span>
                                                    )}
                                                    {status === 'sold-out' && (
                                                        <span className={styles.stockSoldOut}>Sold out</span>
                                                    )}
                                                    {invalid && (
                                                        <span className={styles.errorHint}>
                                                            Available must be ≥ Reserved
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={styles.quantityColumn}>
                                            <div className={styles.quantityControl}>
                                                <button
                                                    type="button"
                                                    className={styles.quantityBtn}
                                                    onClick={() => adjustQuantity(item.id, -1)}
                                                    disabled={item.quantity_available <= 0}
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.quantity_available}
                                                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                    className={`${styles.input} ${invalid ? styles.inputError : ''}`}
                                                />
                                                <button
                                                    type="button"
                                                    className={styles.quantityBtn}
                                                    onClick={() => adjustQuantity(item.id, 1)}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                        <div className={styles.reservedColumn}>
                                            <span className={styles.reservedText}>{item.quantity_reserved}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className={styles.footer}>
                            {hasValidationErrors && (
                                <span className={styles.footerError}>
                                    <AlertTriangle size={14} />
                                    Fix errors before saving
                                </span>
                            )}
                            <Button type="button" variant="outline" onClick={onClose} size="sm">
                                Cancel
                            </Button>
                            <Button type="submit" isLoading={isLoading} disabled={hasValidationErrors} size="sm">
                                Save Changes
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
