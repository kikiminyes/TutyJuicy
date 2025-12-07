
import React, { useState } from 'react';
import { X, Bell, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import styles from './WaitlistModal.module.css';

interface WaitlistModalProps {
    isOpen: boolean;
    onClose: () => void;
    adminPhone: string | null;
}

export const WaitlistModal: React.FC<WaitlistModalProps> = ({ isOpen, onClose, adminPhone }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim()) {
            toast.error('Mohon lengkapi data Anda');
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Save to database
            const { error } = await supabase
                .from('waitlist_leads')
                .insert({
                    name: name.trim(),
                    phone: phone.trim()
                });

            if (error) throw error;

            toast.success('Terima kasih! Kami akan mengingatkan Anda.');

            // 2. Redirect to WhatsApp (if admin phone exists)
            if (adminPhone) {
                const message = `Halo Admin, saya ${name} tertarik untuk ikut PO batch selanjutnya. Tolong kabari saya ya!`;
                const url = `https://wa.me/${adminPhone}?text=${encodeURIComponent(message)}`;
                window.open(url, '_blank');
            }

            onClose();
        } catch (error) {
            console.error('Waitlist error:', error);
            toast.error('Gagal menyimpan data.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>
                    <X size={24} />
                </button>

                <div className={styles.header}>
                    <div className={styles.iconWrapper}>
                        <Bell size={24} />
                    </div>
                    <h2 className={styles.title}>Gabung Waitlist</h2>
                    <p className={styles.subtitle}>
                        Dapatkan notifikasi prioritas saat PO dibuka kembali.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label htmlFor="wName">Nama Lengkap</label>
                        <input
                            id="wName"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Contoh: Budi Santoso"
                            className={styles.input}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="wPhone">Nomor WhatsApp</label>
                        <input
                            id="wPhone"
                            type="tel"
                            value={phone}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setPhone(val);
                            }}
                            placeholder="Contoh: 08123456789"
                            className={styles.input}
                            required
                        />
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 size={18} className={styles.spinner} />
                                Menyimpan...
                            </>
                        ) : (
                            'Ingatkan Saya'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
