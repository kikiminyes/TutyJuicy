import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Menu, Batch } from '../../types';
import { Button } from '../../components/ui/Button';
import { X, Calendar, Tag, Package, Info } from 'lucide-react';
import styles from './BatchFormModal.module.css';
import toast from 'react-hot-toast';

interface BatchFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    batchToEdit?: Batch | null;
}

export const BatchFormModal: React.FC<BatchFormModalProps> = ({ isOpen, onClose, onSuccess, batchToEdit }) => {
    const [menus, setMenus] = useState<Menu[]>([]);
    const [stockData, setStockData] = useState<Record<string, number>>({});
    const [batchName, setBatchName] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchMenus = async () => {
            const { data, error } = await supabase.from('menus').select('*').order('name');
            if (error) {
                console.error('Error fetching menus:', error);
                return;
            }
            setMenus(data || []);

            // Initialize stock data
            const initialStock: Record<string, number> = {};
            data?.forEach(menu => {
                initialStock[menu.id] = 0;
            });
            setStockData(initialStock);
        };

        if (isOpen) {
            if (batchToEdit) {
                setBatchName(batchToEdit.title);
                setDeliveryDate(batchToEdit.delivery_date);
            } else {
                fetchMenus();
                setBatchName(`Batch ${new Date().toLocaleDateString('id-ID')}`);
                // Set default delivery date to 7 days from now
                const defaultDate = new Date();
                defaultDate.setDate(defaultDate.getDate() + 7);
                setDeliveryDate(defaultDate.toISOString().split('T')[0]);
            }
        }
    }, [isOpen, batchToEdit]);

    if (!isOpen) return null;

    const handleStockChange = (menuId: string, value: string) => {
        // Remove leading zeros and parse properly
        const sanitized = value.replace(/^0+/, '') || '0';
        const numValue = Math.max(0, parseInt(sanitized) || 0);
        setStockData(prev => ({
            ...prev,
            [menuId]: numValue
        }));
    };

    const adjustStock = (menuId: string, delta: number) => {
        setStockData(prev => ({
            ...prev,
            [menuId]: Math.max(0, (prev[menuId] || 0) + delta)
        }));
    };

    const setAllStock = (value: number) => {
        const newStock: Record<string, number> = {};
        menus.forEach(menu => {
            newStock[menu.id] = value;
        });
        setStockData(newStock);
    };

    const totalStock = Object.values(stockData).reduce((sum, qty) => sum + qty, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (batchToEdit) {
                const { error } = await supabase
                    .from('batches')
                    .update({
                        title: batchName,
                        delivery_date: deliveryDate
                    })
                    .eq('id', batchToEdit.id);

                if (error) throw error;
                toast.success('Batch updated successfully!');
            } else {
                // Check if there's an active open batch
                const { data: openBatch } = await supabase
                    .from('batches')
                    .select('id, title')
                    .eq('status', 'open')
                    .maybeSingle();

                if (openBatch) {
                    toast.error(`Close "${openBatch.title}" first before creating a new batch.`);
                    setIsLoading(false);
                    return;
                }

                // Create batch
                const { data: batch, error: batchError } = await supabase
                    .from('batches')
                    .insert({
                        title: batchName,
                        delivery_date: deliveryDate,
                        status: 'draft'
                    })
                    .select()
                    .single();

                if (batchError) throw batchError;

                // Create batch_stocks
                const stockInserts = menus.map(menu => ({
                    batch_id: batch.id,
                    menu_id: menu.id,
                    quantity_available: stockData[menu.id] || 0,
                    quantity_reserved: 0
                }));

                const { error: stockError } = await supabase
                    .from('batch_stocks')
                    .insert(stockInserts);

                if (stockError) throw stockError;
                toast.success('Batch created as draft!');
            }

            onSuccess();
        } catch (error: any) {
            console.error('Error:', error);
            toast.error(`Failed: ${error.message || 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <h2 className={styles.title}>
                            {batchToEdit ? 'Edit Batch' : 'Create New Batch'}
                        </h2>
                        <p className={styles.subtitle}>
                            {batchToEdit
                                ? 'Update batch name and delivery date'
                                : 'Set up a new pre-order batch with initial stock'
                            }
                        </p>
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Basic Info Section */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <Tag size={16} />
                            <span>Basic Information</span>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="batchName">Batch Name</label>
                            <input
                                type="text"
                                id="batchName"
                                value={batchName}
                                onChange={(e) => setBatchName(e.target.value)}
                                required
                                className={styles.input}
                                placeholder="e.g. December Batch #1"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="deliveryDate">Delivery Date</label>
                            <div className={styles.inputWithIcon}>
                                <Calendar size={16} className={styles.inputIcon} />
                                <input
                                    type="date"
                                    id="deliveryDate"
                                    value={deliveryDate}
                                    onChange={(e) => setDeliveryDate(e.target.value)}
                                    required
                                    className={styles.input}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Stock Section - Only for CREATE mode */}
                    {!batchToEdit && (
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <Package size={16} />
                                <span>Initial Stock</span>
                                <span className={styles.stockTotal}>Total: {totalStock}</span>
                            </div>

                            <div className={styles.quickActions}>
                                <button type="button" className={styles.quickBtn} onClick={() => setAllStock(0)}>
                                    Reset All
                                </button>
                                <button type="button" className={styles.quickBtn} onClick={() => setAllStock(10)}>
                                    Set All: 10
                                </button>
                                <button type="button" className={styles.quickBtn} onClick={() => setAllStock(20)}>
                                    Set All: 20
                                </button>
                            </div>

                            <div className={styles.menuList}>
                                {menus.length === 0 ? (
                                    <div className={styles.emptyMenus}>
                                        <Info size={16} />
                                        <span>No menu items found. Add menus first.</span>
                                    </div>
                                ) : (
                                    menus.map(menu => (
                                        <div key={menu.id} className={styles.menuItem}>
                                            <div className={styles.menuInfo}>
                                                {menu.image_url && (
                                                    <img
                                                        src={menu.image_url}
                                                        alt={menu.name}
                                                        className={styles.menuImage}
                                                    />
                                                )}
                                                <span className={styles.menuName}>{menu.name}</span>
                                            </div>
                                            <div className={styles.quantityControl}>
                                                <button
                                                    type="button"
                                                    className={styles.quantityBtn}
                                                    onClick={() => adjustStock(menu.id, -1)}
                                                    disabled={(stockData[menu.id] || 0) <= 0}
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={stockData[menu.id] || 0}
                                                    onChange={(e) => handleStockChange(menu.id, e.target.value)}
                                                    className={styles.stockInput}
                                                />
                                                <button
                                                    type="button"
                                                    className={styles.quantityBtn}
                                                    onClick={() => adjustStock(menu.id, 1)}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Info Note */}
                    {!batchToEdit && (
                        <div className={styles.infoNote}>
                            <Info size={14} />
                            <span>Batch will be created as <strong>Draft</strong>. Publish it when ready to accept orders.</span>
                        </div>
                    )}

                    <div className={styles.footer}>
                        <Button type="button" variant="outline" onClick={onClose} size="sm">
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isLoading} size="sm">
                            {batchToEdit ? 'Update Batch' : 'Create Batch'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
