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
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (menuToEdit) {
            setFormData({
                name: menuToEdit.name,
                price: menuToEdit.price.toString(),
                description: menuToEdit.description || '',
                image_url: menuToEdit.image_url || '',
            });
        } else {
            setFormData({ name: '', price: '', description: '', image_url: '' });
        }
    }, [menuToEdit]);

    if (!isOpen) return null;

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
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
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>{menuToEdit ? 'Edit Menu' : 'Add New Menu'}</h2>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label htmlFor="name">Name</label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
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
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="description">Description</label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className={styles.textarea}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Image</label>
                        <div className={styles.imageUpload}>
                            {formData.image_url && (
                                <img src={formData.image_url} alt="Preview" className={styles.preview} />
                            )}
                            <label className={styles.uploadBtn}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    hidden
                                    disabled={isUploading}
                                />
                                <Upload size={20} />
                                {isUploading ? 'Uploading...' : 'Upload Image'}
                            </label>
                        </div>
                    </div>

                    <div className={styles.footer}>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" isLoading={isLoading} disabled={isUploading}>
                            {menuToEdit ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
