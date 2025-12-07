import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { PaymentSettings } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Upload, Save } from 'lucide-react';
import styles from './AdminPaymentSettingsPage.module.css';
import toast from 'react-hot-toast';

interface ValidationErrors {
    bank_name?: string;
    account_number?: string;
    account_holder?: string;
}

export const AdminPaymentSettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<PaymentSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [errors, setErrors] = useState<ValidationErrors>({});

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('payment_settings')
                    .select('*')
                    .single();

                if (error && error.code !== 'PGRST116') throw error;

                if (data) {
                    setSettings(data);
                } else {
                    // Initialize empty settings if none exist
                    setSettings({
                        id: '',
                        qris_image_url: '',
                        bank_name: '',
                        account_number: '',
                        account_holder: '',
                        admin_phone_number: '',
                        created_at: ''
                    });
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
                toast.error('Failed to load settings');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        setIsUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `qris-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('menu-images') // Reusing bucket for simplicity, or create 'payment-proofs' public read? Better 'menu-images' is public read.
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('menu-images')
                .getPublicUrl(filePath);

            setSettings(prev => prev ? { ...prev, qris_image_url: publicUrl } : null);
            toast.success('QRIS image uploaded!');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Failed to upload image');
        } finally {
            setIsUploading(false);
        }
    };

    const validateSettings = (): boolean => {
        if (!settings) return false;

        const newErrors: ValidationErrors = {};
        const hasBankInfo = settings.bank_name || settings.account_number || settings.account_holder;

        // If any bank field is filled, all are required
        if (hasBankInfo) {
            if (!settings.bank_name?.trim()) {
                newErrors.bank_name = 'Bank name is required when setting up bank transfer';
            }
            if (!settings.account_number?.trim()) {
                newErrors.account_number = 'Account number is required when setting up bank transfer';
            } else if (!/^\d+$/.test(settings.account_number.trim())) {
                newErrors.account_number = 'Account number must contain only digits';
            }
            if (!settings.account_holder?.trim()) {
                newErrors.account_holder = 'Account holder name is required when setting up bank transfer';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        // Validate before saving
        if (!validateSettings()) {
            toast.error('Please fix the validation errors');
            return;
        }

        setIsSaving(true);

        try {
            // Exclude admin_phone_number as it's managed in AdminContactPage
            const { id, created_at, admin_phone_number, ...updates } = settings;

            // Trim values before saving
            const trimmedUpdates = {
                ...updates,
                bank_name: updates.bank_name?.trim() || null,
                account_number: updates.account_number?.trim() || null,
                account_holder: updates.account_holder?.trim() || null,
            };

            if (settings.id) {
                const { error } = await supabase
                    .from('payment_settings')
                    .update(trimmedUpdates)
                    .eq('id', settings.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('payment_settings')
                    .insert(trimmedUpdates);
                if (error) throw error;
            }

            toast.success('Settings saved successfully');
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const clearError = (field: keyof ValidationErrors) => {
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    if (isLoading) return <div>Loading settings...</div>;
    if (!settings) return <div>Error loading settings.</div>;

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>Payment Settings</h1>

            <Card>
                <form onSubmit={handleSave} className={styles.form}>
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>QRIS Payment</h3>
                        <div className={styles.formGroup}>
                            <label>QRIS Image</label>
                            <div className={styles.imageUpload}>
                                {settings.qris_image_url && (
                                    <img src={settings.qris_image_url} alt="QRIS Preview" className={styles.preview} />
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
                                    {isUploading ? 'Uploading...' : 'Upload QRIS Image'}
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className={styles.divider} />

                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Bank Transfer</h3>
                        <p className={styles.sectionHint}>Fill all fields below to enable bank transfer payment option</p>

                        <div className={styles.formGroup}>
                            <label htmlFor="bankName">Bank Name</label>
                            <input
                                type="text"
                                id="bankName"
                                value={settings.bank_name || ''}
                                onChange={(e) => {
                                    setSettings({ ...settings, bank_name: e.target.value });
                                    clearError('bank_name');
                                }}
                                className={`${styles.input} ${errors.bank_name ? styles.inputError : ''}`}
                                placeholder="e.g. BCA"
                            />
                            {errors.bank_name && <span className={styles.errorText}>{errors.bank_name}</span>}
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="accountNumber">Account Number</label>
                            <input
                                type="text"
                                id="accountNumber"
                                value={settings.account_number || ''}
                                onChange={(e) => {
                                    setSettings({ ...settings, account_number: e.target.value });
                                    clearError('account_number');
                                }}
                                className={`${styles.input} ${errors.account_number ? styles.inputError : ''}`}
                                placeholder="e.g. 1234567890"
                            />
                            {errors.account_number && <span className={styles.errorText}>{errors.account_number}</span>}
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="accountHolder">Account Holder Name</label>
                            <input
                                type="text"
                                id="accountHolder"
                                value={settings.account_holder || ''}
                                onChange={(e) => {
                                    setSettings({ ...settings, account_holder: e.target.value });
                                    clearError('account_holder');
                                }}
                                className={`${styles.input} ${errors.account_holder ? styles.inputError : ''}`}
                                placeholder="e.g. Tuty Juicy"
                            />
                            {errors.account_holder && <span className={styles.errorText}>{errors.account_holder}</span>}
                        </div>
                    </div>

                    {/* Admin Contact section moved to dedicated page */}

                    <div className={styles.footer}>
                        <Button type="submit" size="lg" isLoading={isSaving} disabled={isUploading}>
                            <Save size={20} />
                            Save Settings
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
