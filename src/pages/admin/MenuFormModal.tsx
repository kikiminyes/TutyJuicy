import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Menu } from '../../types';
import { Button } from '../../components/ui/Button';
import { X, Upload } from 'lucide-react';
import styles from './MenuFormModal.module.css';
import toast from 'react-hot-toast';

interface MenuFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    menuToEdit: Menu | null;
}

export const MenuFormModal: React.FC<MenuFormModalProps> = ({ isOpen, onClose, onSuccess, menuToEdit }) => {
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        description: '',
        image_url: '',
        size: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (menuToEdit) {
            setFormData({
                name: menuToEdit.name,
                price: menuToEdit.price.toString(),
                description: menuToEdit.description || '',
                image_url: menuToEdit.image_url || '',
                size: menuToEdit.size || '',
            });
        } else {
            setFormData({ name: '', price: '', description: '', image_url: '', size: '' });
        }
    }, [menuToEdit]);

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
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    };

    const handleFileUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }

        setIsUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `menu-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('menu-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('menu-images')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, image_url: publicUrl }));
            toast.success('Image uploaded!');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Failed to upload image');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate price
        const price = parseFloat(formData.price);
        if (isNaN(price) || price <= 0) {
            toast.error('Please enter a valid price greater than 0');
            return;
        }

        setIsLoading(true);

        try {
            const menuData = {
                name: formData.name.trim(),
                price,
                description: formData.description.trim(),
                image_url: formData.image_url,
                size: formData.size.trim() || null,
            };

            if (menuToEdit) {
                const { error } = await supabase
                    .from('menus')
                    .update(menuData)
                    .eq('id', menuToEdit.id);
                if (error) throw error;
                toast.success('Menu updated successfully');
            } else {
                const { error } = await supabase
                    .from('menus')
                    .insert(menuData);
                if (error) throw error;
                toast.success('Menu created successfully');
            }

            onSuccess();
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save menu');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>{menuToEdit ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label>Menu Image</label>
                        <div
                            className={`${styles.imageUpload} ${isDragging ? styles.dragging : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            {formData.image_url ? (
                                <>
                                    <img src={formData.image_url} alt="Preview" className={styles.preview} />
                                    <label className={styles.uploadBtn}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            hidden
                                            disabled={isUploading}
                                        />
                                        Replace Image
                                    </label>
                                </>
                            ) : (
                                <label className={styles.uploadLabel}>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        hidden
                                        disabled={isUploading}
                                    />
                                    <div className={styles.uploadIconWrapper}>
                                        <Upload size={24} />
                                    </div>
                                    <span className={styles.uploadText}>
                                        {isUploading ? 'Uploading...' : 'Click to upload or drag and drop'}
                                    </span>
                                    <span className={styles.uploadSubtext}>SVG, PNG, JPG or GIF (max. 5MB)</span>
                                </label>
                            )}
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="name">Name</label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="e.g. Mango Tango"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="price">Price (IDR)</label>
                        <input
                            type="number"
                            id="price"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            required
                            placeholder="e.g. 15000"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="size">Size (Optional)</label>
                        <input
                            type="text"
                            id="size"
                            value={formData.size}
                            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                            placeholder="e.g. 350ml, 500ml"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="description">Description</label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe your juice (ingredients, taste, benefits)..."
                            className={styles.textarea}
                        />
                    </div>
                </form>

                <div className={styles.footer}>
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" isLoading={isLoading} disabled={isUploading} onClick={handleSubmit}>
                        {menuToEdit ? 'Save Changes' : 'Create Menu Item'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
