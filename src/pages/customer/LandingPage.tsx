import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Batch } from '../../types';
import { MenuGrid } from '../../components/features/MenuGrid';
import { StickyCart } from '../../components/features/StickyCart';
import { WaitlistModal } from '../../components/features/waitlist/WaitlistModal';
import { CustomerLayout } from '../../components/layout/CustomerLayout';
import { Bell } from 'lucide-react';
import styles from './LandingPage.module.css';

export const LandingPage: React.FC = () => {
    const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showWaitlist, setShowWaitlist] = useState(false);
    const [adminPhone, setAdminPhone] = useState<string | null>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // 1. Fetch active batch
                const { data: batchData, error: batchError } = await supabase
                    .from('batches')
                    .select('*')
                    .eq('status', 'open')
                    .single();

                if (batchError && batchError.code !== 'PGRST116') {
                    console.error('Error fetching active batch:', batchError);
                } else if (batchData) {
                    setActiveBatch(batchData);
                }

                // 2. Fetch admin phone from admin_contacts
                const { data: contactData } = await supabase
                    .from('admin_contacts')
                    .select('phone_number')
                    .eq('is_active', true)
                    .limit(1)
                    .single();

                if (contactData?.phone_number) {
                    setAdminPhone(contactData.phone_number);
                }

            } catch (error) {
                console.error('Error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();

        // Subscribe to batch changes
        const subscription = supabase
            .channel('landing-batch-updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'batches' },
                () => fetchInitialData()
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    if (isLoading) {
        return (
            <CustomerLayout>
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingBadge}>
                        <div className={styles.dot}></div>
                        Loading menu...
                    </div>
                </div>
            </CustomerLayout>
        );
    }

    return (
        <CustomerLayout>
            {/* Hero Section */}
            <div className={styles.hero}>
                {/* Floating Decorations */}
                <div className={styles.floatingDecor}>
                    <div className={styles.bubble1} />
                    <div className={styles.bubble2} />
                    <div className={styles.bubble3} />
                    <div className={styles.bubble4} />
                </div>

                <div className={styles.heroContent}>
                    <div className={styles.brandWrapper}>
                        <h1 className={styles.title}>TutyJuicy</h1>
                        <p className={styles.tagline}>Fresh, Healthy, and Made with Love</p>
                    </div>

                    <div className={styles.batchStatus}>
                        {activeBatch ? (
                            <div className={styles.activeBatchCard}>
                                <div className={styles.activeBadge}>
                                    <div className={styles.dot}></div>
                                    Open Pre-Order
                                </div>
                                <h2 className={styles.batchTitle}>{activeBatch.title}</h2>
                                <div className={styles.deliveryInfo}>
                                    <span className={styles.deliveryLabel}>Pengiriman/Pickup:</span>
                                    <span className={styles.deliveryDate}>
                                        {new Date(activeBatch.delivery_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.inactiveBatchCard}>
                                <div className={styles.inactiveIconWrapper}>
                                    <div className={styles.inactiveIconBg}></div>
                                    <div className={styles.inactiveIcon}>⏳</div>
                                </div>
                                <h2 className={styles.inactiveTitle}>Yah, Batch Kali Ini Sudah Tutup</h2>
                                <p className={styles.inactiveText}>
                                    Tapi jangan khawatir! Stok segar akan segera hadir kembali.
                                    Gabung <strong>Priority Waitlist</strong> biar kamu dapet info duluan pas kami open order lagi.
                                </p>
                                <button
                                    className={styles.notifyBtn}
                                    onClick={() => setShowWaitlist(true)}
                                >
                                    <Bell size={20} />
                                    Ingatkan Saya via WhatsApp
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Menu Section - Only show if there is an active batch */}
            {activeBatch && (
                <div className={styles.menuSection}>
                    <div className="container mx-auto px-4">
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Menu Batch Ini</h2>
                            <p className={styles.sectionSubtitle}>Dibuat segar sesuai pesanan</p>
                        </div>
                        <MenuGrid batchId={activeBatch.id} />
                    </div>
                </div>
            )}

            {/* Sticky Cart */}
            <StickyCart />

            <WaitlistModal
                isOpen={showWaitlist}
                onClose={() => setShowWaitlist(false)}
                adminPhone={adminPhone}
            />
        </CustomerLayout>
    );
};
