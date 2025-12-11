import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Menu } from '../../types';
import { Card } from '../ui/Card';
import { ImageCarousel } from '../ui/ImageCarousel';
import { Plus, Minus } from 'lucide-react';
import styles from './MenuGrid.module.css';
import { useCart } from '../../context/CartContext';
import toast from 'react-hot-toast';

interface MenuGridProps {
    batchId: string;
}

interface MenuItemWithStock extends Menu {
    quantity_available: number;
    images?: string[];
}

export const MenuGrid: React.FC<MenuGridProps> = ({ batchId }) => {
    const [menuItems, setMenuItems] = useState<MenuItemWithStock[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { items, addItem, updateQuantity, removeItem } = useCart();

    const fetchMenuAndStock = useCallback(async () => {
        try {
            // 1. Fetch all menus
            const { data: menus, error: menuError } = await supabase
                .from('menus')
                .select('*');

            if (menuError) throw menuError;

            // 2. Fetch stock for this batch
            const { data: stocks, error: stockError } = await supabase
                .from('batch_stocks')
                .select('menu_id, quantity_available')
                .eq('batch_id', batchId);

            if (stockError) throw stockError;

            // 3. Fetch all menu images
            let menuImages: { menu_id: string; image_url: string; display_order: number }[] = [];
            try {
                const { data: imgData } = await supabase
                    .from('menu_images')
                    .select('menu_id, image_url, display_order')
                    .order('display_order');
                if (imgData) menuImages = imgData;
            } catch {
                // Table might not exist yet, ignore
            }

            // 4. Merge data
            const mergedData = menus.map((menu) => {
                const stock = stocks?.find((s) => s.menu_id === menu.id);
                const images = menuImages
                    .filter(img => img.menu_id === menu.id)
                    .sort((a, b) => a.display_order - b.display_order)
                    .map(img => img.image_url);

                // Use images array, fallback to single image_url
                const finalImages = images.length > 0 ? images : (menu.image_url ? [menu.image_url] : []);

                return {
                    ...menu,
                    quantity_available: stock ? Math.max(0, stock.quantity_available) : 0,
                    images: finalImages,
                };
            });

            setMenuItems(mergedData);
        } catch (err) {
            console.error('Error loading menu:', err);
        } finally {
            setIsLoading(false);
        }
    }, [batchId]);

    useEffect(() => {
        fetchMenuAndStock();

        // Realtime subscription for stock updates
        const subscription = supabase
            .channel('menu-stock-updates')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'batch_stocks', filter: `batch_id=eq.${batchId}` },
                () => { fetchMenuAndStock(); }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [batchId, fetchMenuAndStock]);

    if (isLoading) {
        return <div className={styles.loading}>Loading menu...</div>;
    }

    return (
        <div>
            <div className={styles.grid}>
                {menuItems.map((item) => {
                    const isSoldOut = item.quantity_available <= 0;
                    return (
                        <Card
                            key={item.id}
                            className={`${styles.menuCard} ${isSoldOut ? styles.menuCardSoldOut : ''}`}
                        >
                            <div className={styles.imageContainer}>
                                {item.images && item.images.length > 0 ? (
                                    <ImageCarousel
                                        images={item.images}
                                        alt={item.name}
                                        className={styles.carousel}
                                    />
                                ) : (
                                    <div className={styles.placeholderImage}>🥤</div>
                                )}
                                {isSoldOut && (
                                    <div className={styles.soldOutOverlay}>
                                        <span className={styles.soldOutText}>Sold Out</span>
                                    </div>
                                )}
                            </div>

                            <div className={styles.content}>
                                <div className={styles.header}>
                                    <div className={styles.titleRow}>
                                        <h3 className={styles.name}>{item.name}</h3>
                                        {item.size && <span className={styles.sizeInfo}>{item.size}</span>}
                                    </div>
                                    <span className={styles.price}>
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price)}
                                    </span>
                                    <p className={styles.description}>{item.description}</p>
                                </div>

                                <div className={styles.footer}>
                                    <div className={styles.stockInfo}>
                                        <span className={`${styles.stockDot} ${item.quantity_available > 5 ? styles.green : item.quantity_available > 0 ? styles.yellow : styles.red}`}></span>
                                        {item.quantity_available > 0 ? `${item.quantity_available} Available` : 'Habis'}
                                    </div>

                                    {(() => {
                                        const cartItem = items.find(i => i.id === item.id);
                                        const qty = cartItem ? cartItem.quantity : 0;
                                        const canAddMore = qty < item.quantity_available;

                                        if (qty > 0) {
                                            return (
                                                <div className={styles.qtyControls}>
                                                    <button
                                                        className={styles.qtyBtn}
                                                        onClick={() => {
                                                            if (qty === 1) removeItem(item.id);
                                                            else updateQuantity(item.id, -1);
                                                        }}
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <span className={styles.qtyText}>{qty}</span>
                                                    <button
                                                        className={styles.qtyBtn}
                                                        onClick={() => {
                                                            if (canAddMore) {
                                                                updateQuantity(item.id, 1);
                                                            } else {
                                                                toast.error('Stok tidak cukup');
                                                            }
                                                        }}
                                                        disabled={!canAddMore}
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            );
                                        }

                                        return (
                                            <button
                                                className={styles.addBtn}
                                                disabled={item.quantity_available <= 0}
                                                onClick={() => addItem(item)}
                                            >
                                                <span className={styles.addText}>Add</span> <Plus size={20} />
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};
