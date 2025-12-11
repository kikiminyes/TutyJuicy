import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Menu } from '../../types';
import { Button } from '../../components/ui/Button';
import { X, Trash2, Plus, Loader2 } from 'lucide-react';
import styles from './MenuFormModal.module.css';
import toast from 'react-hot-toast';

interface MenuFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    menuToEdit: Menu | null;
}

const MAX_IMAGES = 5;

export const MenuFormModal: React.FC<MenuFormModalProps> = ({ isOpen, onClose, onSuccess, menuToEdit }) => {
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        description: '',
        size: '',
    });
    const [images, setImages] = useState<{ id?: string; url: string; isNew?: boolean }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    useEffect(() => {
        if (menuToEdit) {
            setFormData({
                name: menuToEdit.name,
                price: menuToEdit.price.toString(),
                description: menuToEdit.description || '',
                size: menuToEdit.size || '',
            });
            // Fetch existing images
            fetchMenuImages(menuToEdit.id);
        } else {
            setFormData({ name: '', price: '', description: '', size: '' });
            setImages([]);
        }
    }, [menuToEdit]);

    const fetchMenuImages = async (menuId: string) => {
        try {
            const { data, error } = await supabase
                .from('menu_images')
                .select('id, image_url, display_order')
                .eq('menu_id', menuId)
                .order('display_order');

            if (error) {
                // Table might not exist yet, use legacy image_url
                if (menuToEdit?.image_url) {
                    setImages([{ url: menuToEdit.image_url }]);
                }
                return;
            }

            if (data && data.length > 0) {
                setImages(data.map(img => ({ id: img.id, url: img.image_url })));
            } else if (menuToEdit?.image_url) {
                // Fallback to legacy single image
                setImages([{ url: menuToEdit.image_url }]);
            }
        } catch (err) {
            console.error('Error fetching images:', err);
            if (menuToEdit?.image_url) {
                setImages([{ url: menuToEdit.image_url }]);
            }
        }
    };

    if (!isOpen) return null;

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        handleMultipleFiles(Array.from(files));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleMultipleFiles(Array.from(e.target.files));
        }
    };

    const handleMultipleFiles = async (files: File[]) => {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        const availableSlots = MAX_IMAGES - images.length;

        if (imageFiles.length > availableSlots) {
            toast.error(`Maksimal ${MAX_IMAGES} gambar. Tersisa ${availableSlots} slot.`);
            imageFiles.splice(availableSlots);
        }

        if (imageFiles.length === 0) return;

        setIsUploading(true);

        for (const file of imageFiles) {
            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `menu-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('menu-images')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('menu-images')
                    .getPublicUrl(fileName);

                setImages(prev => [...prev, { url: publicUrl, isNew: true }]);
            } catch (error) {
                console.error('Upload error:', error);
                toast.error('Gagal mengupload gambar');
            }
        }

        setIsUploading(false);
        toast.success('Gambar berhasil diupload!');
    };

    const handleRemoveImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    // Drag to reorder handlers
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragEnter = (index: number) => {
        if (draggedIndex === null || draggedIndex === index) return;

        setImages(prev => {
            const newImages = [...prev];
            const draggedItem = newImages[draggedIndex];
            newImages.splice(draggedIndex, 1);
            newImages.splice(index, 0, draggedItem);
            return newImages;
        });
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const price = parseFloat(formData.price);
        if (isNaN(price) || price <= 0) {
            toast.error('Masukkan harga yang valid');
            return;
        }

        if (images.length === 0) {
            toast.error('Tambahkan minimal 1 gambar');
            return;
        }

        setIsLoading(true);

        try {
            // First image becomes the primary thumbnail
            const primaryImage = images[0]?.url || null;

            const menuData = {
                name: formData.name.trim(),
                price,
                description: formData.description.trim(),
                image_url: primaryImage, // Keep for backward compatibility
                size: formData.size.trim() || null,
            };

            let menuId: string;

            if (menuToEdit) {
                const { error } = await supabase
                    .from('menus')
                    .update(menuData)
                    .eq('id', menuToEdit.id);
                if (error) throw error;
                menuId = menuToEdit.id;

                // Delete old images and insert new ones
                await supabase.from('menu_images').delete().eq('menu_id', menuId);
            } else {
                const { data, error } = await supabase
                    .from('menus')
                    .insert(menuData)
                    .select('id')
                    .single();
                if (error) throw error;
                menuId = data.id;
            }

            // Insert all images with display order
            if (images.length > 0) {
                const imageRecords = images.map((img, index) => ({
                    menu_id: menuId,
                    image_url: img.url,
                    display_order: index,
                }));

                const { error: imgError } = await supabase
                    .from('menu_images')
                    .insert(imageRecords);

                if (imgError) {
                    console.warn('Failed to save images to menu_images table:', imgError);
                    // Don't throw - menu was still created/updated
                }
            }

            toast.success(menuToEdit ? 'Menu berhasil diperbarui' : 'Menu berhasil dibuat');
            onSuccess();
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Gagal menyimpan menu');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>{menuToEdit ? 'Edit Menu' : 'Tambah Menu Baru'}</h2>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Multi-Image Gallery */}
                    <div className={styles.formGroup}>
                        <label>Gambar Menu ({images.length}/{MAX_IMAGES})</label>
                        <p className={styles.imageHint}>Gambar pertama akan menjadi thumbnail utama. Drag untuk mengubah urutan.</p>

                        {/* Image Grid */}
                        <div className={styles.imageGrid}>
                            {images.map((img, index) => (
                                <div
                                    key={img.id || img.url}
                                    className={`${styles.imageItem} ${index === 0 ? styles.primaryImage : ''} ${draggedIndex === index ? styles.dragging : ''}`}
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDragEnter={() => handleDragEnter(index)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <img src={img.url} alt={`Image ${index + 1}`} className={styles.thumbnail} />
                                    <div className={styles.imageOverlay}>
                                        <select
                                            className={styles.positionSelect}
                                            value={index}
                                            onChange={(e) => {
                                                const newPos = parseInt(e.target.value);
                                                if (newPos !== index) {
                                                    setImages(prev => {
                                                        const newImages = [...prev];
                                                        const item = newImages.splice(index, 1)[0];
                                                        newImages.splice(newPos, 0, item);
                                                        return newImages;
                                                    });
                                                }
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {images.map((_, i) => (
                                                <option key={i} value={i}>{i + 1}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className={styles.removeBtn}
                                            onClick={() => handleRemoveImage(index)}
                                            title="Hapus gambar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    {index === 0 && <span className={styles.primaryBadge}>Utama</span>}
                                </div>
                            ))}

                            {/* Add Image Button */}
                            {images.length < MAX_IMAGES && (
                                <label
                                    className={`${styles.addImageBtn} ${isDragging ? styles.dragging : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageChange}
                                        hidden
                                        disabled={isUploading}
                                    />
                                    {isUploading ? (
                                        <Loader2 size={24} className={styles.spinner} />
                                    ) : (
                                        <>
                                            <Plus size={24} />
                                            <span>Tambah</span>
                                        </>
                                    )}
                                </label>
                            )}
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="name">Nama Menu</label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="contoh: Mango Tango"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="price">Harga (Rp)</label>
                        <input
                            type="number"
                            id="price"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            required
                            placeholder="contoh: 15000"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="size">Ukuran (Opsional)</label>
                        <input
                            type="text"
                            id="size"
                            value={formData.size}
                            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                            placeholder="contoh: 350ml"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="description">Deskripsi</label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Jelaskan bahan, rasa, atau manfaat..."
                            className={styles.textarea}
                        />
                    </div>
                </form>

                <div className={styles.footer}>
                    <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
                    <Button type="submit" isLoading={isLoading} disabled={isUploading} onClick={handleSubmit}>
                        {menuToEdit ? 'Simpan Perubahan' : 'Tambah Menu'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
