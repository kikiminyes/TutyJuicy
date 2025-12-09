import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Menu } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Plus, Edit, Trash2, Image as ImageIcon, UtensilsCrossed, Search } from 'lucide-react';
import styles from './AdminMenuPage.module.css';
import toast from 'react-hot-toast';
import { MenuFormModal } from './MenuFormModal';

export const AdminMenuPage: React.FC = () => {
    const [menus, setMenus] = useState<Menu[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
    const [menuToDelete, setMenuToDelete] = useState<Menu | null>(null);
    const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

    const fetchMenus = async () => {
        try {
            const { data, error } = await supabase
                .from('menus')
                .select('*')
                .order('name');

            if (error) throw error;
            setMenus(data || []);
        } catch (error) {
            console.error('Error fetching menus:', error);
            toast.error('Failed to load menus');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMenus();
    }, []);

    const filteredMenus = menus.filter(menu =>
        menu.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        menu.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDeleteClick = async (menu: Menu) => {
        // Check if menu is used in any active batches (draft or open)
        try {
            const { data: batchStocks, error } = await supabase
                .from('batch_stocks')
                .select(`
                    batch_id,
                    batches!inner (
                        id,
                        title,
                        status
                    )
                `)
                .eq('menu_id', menu.id);

            if (error) throw error;

            const activeBatches = batchStocks?.filter(
                (bs: any) => bs.batches?.status === 'draft' || bs.batches?.status === 'open'
            ) || [];

            if (activeBatches.length > 0) {
                const batchNames = activeBatches.map((bs: any) => bs.batches?.title).join(', ');
                setDeleteWarning(`This menu is used in active batches: ${batchNames}. Deleting will remove it from these batches.`);
            } else {
                setDeleteWarning(null);
            }

            setMenuToDelete(menu);
        } catch (error) {
            console.error('Error checking batch usage:', error);
            setDeleteWarning(null);
            setMenuToDelete(menu);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!menuToDelete) return;

        try {
            const { error } = await supabase
                .from('menus')
                .delete()
                .eq('id', menuToDelete.id);

            if (error) throw error;

            toast.success('Menu deleted successfully');
            setMenuToDelete(null);
            setDeleteWarning(null);
            fetchMenus();
        } catch (error: any) {
            console.error('Delete error:', error);
            if (error.code === '23503') {
                toast.error('Cannot delete menu: It has associated orders. Remove from batches first.');
            } else {
                toast.error('Failed to delete menu');
            }
        }
    };

    const handleDeleteCancel = () => {
        setMenuToDelete(null);
        setDeleteWarning(null);
    };

    const handleEdit = (menu: Menu) => {
        setEditingMenu(menu);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingMenu(null);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingMenu(null);
    };

    const handleSuccess = () => {
        handleModalClose();
        fetchMenus();
    };

    if (isLoading) return <div>Loading menus...</div>;

    return (
        <div>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h1 className={styles.title}>Menu Management</h1>
                    <p className={styles.subtitle}>Manage your juice menu items and pricing</p>
                </div>
                <div className={styles.actions}>
                    <Button onClick={handleCreate}>
                        <Plus size={20} />
                        Add New Menu
                    </Button>
                </div>
            </div>

            <div className={styles.controls}>
                <div className={styles.searchWrapper}>
                    <Search className={styles.searchIcon} size={20} />
                    <input
                        type="text"
                        placeholder="Search menu items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>
            </div>

            {filteredMenus.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIconWrapper}>
                        <UtensilsCrossed size={40} />
                    </div>
                    <h3 className={styles.emptyTitle}>
                        {searchTerm ? 'No matching menus found' : 'No menu items yet'}
                    </h3>
                    <p className={styles.emptyText}>
                        {searchTerm
                            ? `We couldn't find any menu items matching "${searchTerm}". Try a different search term.`
                            : 'Add your first menu item to start receiving orders.'}
                    </p>
                    {!searchTerm && (
                        <Button onClick={handleCreate}>
                            <Plus size={20} />
                            Add First Menu
                        </Button>
                    )}
                </div>
            ) : (
                <div className={styles.grid}>
                    {filteredMenus.map((menu) => (
                        <Card key={menu.id} className={styles.menuCard}>
                            <div className={styles.imageContainer}>
                                {menu.image_url ? (
                                    <img src={menu.image_url} alt={menu.name} className={styles.image} />
                                ) : (
                                    <div className={styles.placeholderImage}>
                                        <ImageIcon size={40} />
                                    </div>
                                )}
                                <div className={styles.priceTag}>
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(menu.price)}
                                </div>
                            </div>

                            <div className={styles.content}>
                                <div className={styles.titleRow}>
                                    <h3 className={styles.name}>{menu.name}</h3>
                                    {menu.size && <span className={styles.sizeInfo}>{menu.size}</span>}
                                </div>
                                <p className={styles.description}>{menu.description}</p>

                                <div className={styles.cardActions}>
                                    <button className={styles.editBtn} onClick={() => handleEdit(menu)}>
                                        <Edit size={16} />
                                        Edit
                                    </button>
                                    <button className={styles.deleteBtn} onClick={() => handleDeleteClick(menu)}>
                                        <Trash2 size={16} />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Mobile FAB for adding new menu */}
            <button className={styles.fab} onClick={handleCreate} aria-label="Add new menu">
                <Plus size={24} />
            </button>

            {isModalOpen && (
                <MenuFormModal
                    isOpen={isModalOpen}
                    onClose={handleModalClose}
                    onSuccess={handleSuccess}
                    menuToEdit={editingMenu}
                />
            )}

            <ConfirmDialog
                isOpen={!!menuToDelete}
                title="Delete Menu"
                message={deleteWarning
                    ? `${deleteWarning}\n\nAre you sure you want to delete "${menuToDelete?.name}"?`
                    : `Are you sure you want to delete "${menuToDelete?.name}"? This action cannot be undone.`
                }
                variant={deleteWarning ? 'warning' : 'danger'}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
            />
        </div>
    );
};
