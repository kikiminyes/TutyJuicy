import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { Batch } from '../../types';
import { MenuGrid } from '../../components/features/MenuGrid';
import { StickyCart } from '../../components/features/StickyCart';
import { CartSidebar } from '../../components/features/CartSidebar';
import { WaitlistModal } from '../../components/features/waitlist/WaitlistModal';
import { CustomerLayout } from '../../components/layout/CustomerLayout';
import { Bell, Calendar } from 'lucide-react';
import styles from './LandingPage.module.css';

export const LandingPage: React.FC = () => {
    const { t } = useTranslation();
    const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showWaitlist, setShowWaitlist] = useState(false);
    const [adminPhone, setAdminPhone] = useState<string | null>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
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

        const subscription = supabase
            .channel('landing-batch-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, () => fetchInitialData())
            .subscribe();

        return () => { subscription.unsubscribe(); };
    }, []);

    if (isLoading) {
        return (
            <CustomerLayout>
                <div className={styles.loadingContainer} role="status" aria-live="polite">
                    <div className={styles.loadingSpinner} aria-hidden="true" />
                    <span className="sr-only">{t('common.loading')}</span>
                </div>
            </CustomerLayout>
        );
    }

    return (
        <CustomerLayout hideCheckOrder={!activeBatch}>
            {/* Compact Hero with Batch Info */}
            {activeBatch ? (
                <div className={styles.compactHero}>
                    <div className={styles.batchInfo}>
                        <div className={styles.batchBadge}>
                            <span className={styles.liveDot} aria-hidden="true" />
                            {t('landing.openPreOrder')}
                        </div>
                        <h1 className={styles.batchTitle}>{activeBatch.title}</h1>
                        <div className={styles.batchMeta}>
                            <span className={styles.metaItem}>
                                <Calendar size={14} aria-hidden="true" />
                                {new Date(activeBatch.delivery_date).toLocaleDateString('id-ID', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short'
                                })}
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                /* No Active Batch - Waitlist CTA */
                <div className={styles.inactiveHero}>
                    <div className={styles.inactiveContent}>
                        <div className={styles.inactiveIcon} aria-hidden="true">⏳</div>
                        <h2 className={styles.inactiveTitle}>{t('landing.batchClosed')}</h2>
                        <p className={styles.inactiveText}>
                            {t('landing.batchClosedMessage')}
                        </p>
                        <button
                            className={styles.notifyBtn}
                            onClick={() => setShowWaitlist(true)}
                            aria-label={t('landing.notifyMe')}
                        >
                            <Bell size={18} aria-hidden="true" />
                            {t('landing.notifyMe')}
                        </button>
                    </div>
                </div>
            )}

            {/* Menu Grid - Direct, no section header */}
            {activeBatch && (
                <div className={styles.menuContainer}>
                    <MenuGrid batchId={activeBatch.id} />
                </div>
            )}

            <StickyCart />
            <CartSidebar />
            <WaitlistModal isOpen={showWaitlist} onClose={() => setShowWaitlist(false)} adminPhone={adminPhone} />
        </CustomerLayout>
    );
};
