import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { WaitlistLead } from '../../types';
import { Card } from '../../components/ui/Card';
import { Users, Phone, Clock, Trash2, RefreshCw, MessageCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';
import styles from './AdminWaitlistPage.module.css';

export const AdminWaitlistPage: React.FC = () => {
    const [leads, setLeads] = useState<WaitlistLead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const fetchLeads = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('waitlist_leads')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLeads(data || []);
        } catch (error) {
            console.error('Error fetching waitlist:', error);
            toast.error('Gagal memuat data waitlist');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Yakin ingin menghapus data ini?')) return;

        setIsDeleting(id);
        try {
            const { error } = await supabase
                .from('waitlist_leads')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setLeads(prev => prev.filter(lead => lead.id !== id));
            toast.success('Data berhasil dihapus');
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Gagal menghapus data');
        } finally {
            setIsDeleting(null);
        }
    };

    const handleWhatsApp = (lead: WaitlistLead) => {
        const message = `Halo ${lead.name}! Batch PO baru TutyJuicy sudah dibuka. Yuk segera order!`;
        const url = `https://wa.me/${lead.phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getRelativeTime = (dateStr: string) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return `${diffMins} menit yang lalu`;
        if (diffHours < 24) return `${diffHours} jam yang lalu`;
        if (diffDays < 7) return `${diffDays} hari yang lalu`;
        return formatDate(dateStr);
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingWrapper}>
                    <div className={styles.loadingSpinner}></div>
                    <p className={styles.loadingText}>Memuat data waitlist...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <div className={styles.titleWrapper}>
                        <div className={styles.iconBadge}>
                            <Users size={24} />
                        </div>
                        <div>
                            <h1 className={styles.title}>Waitlist Management</h1>
                            <p className={styles.subtitle}>
                                Kelola pelanggan yang tertarik saat batch PO ditutup
                            </p>
                        </div>
                    </div>
                </div>
                <Button
                    variant="secondary"
                    onClick={fetchLeads}
                    className={styles.refreshBtn}
                >
                    <RefreshCw size={18} />
                    Refresh
                </Button>
            </div>

            {leads.length === 0 ? (
                <Card className={styles.emptyCard}>
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>
                            <Users size={64} />
                        </div>
                        <h3>Belum ada data waitlist</h3>
                        <p>Pelanggan yang mendaftar waitlist saat batch PO ditutup akan muncul di sini.</p>
                    </div>
                </Card>
            ) : (
                <>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon}>
                                <Users size={24} />
                            </div>
                            <div className={styles.statContent}>
                                <span className={styles.statValue}>{leads.length}</span>
                                <span className={styles.statLabel}>Total Leads</span>
                            </div>
                        </div>
                        <div className={`${styles.statCard} ${styles.statCardSecondary}`}>
                            <div className={styles.statIcon}>
                                <MessageCircle size={24} />
                            </div>
                            <div className={styles.statContent}>
                                <span className={styles.statValue}>
                                    {leads.filter(l => new Date(l.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
                                </span>
                                <span className={styles.statLabel}>Minggu Ini</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.leadsGrid}>
                        {leads.map((lead) => (
                            <Card key={lead.id} className={styles.leadCard}>
                                <div className={styles.leadHeader}>
                                    <div className={styles.leadAvatar}>
                                        {lead.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={styles.leadInfo}>
                                        <h3 className={styles.leadName}>{lead.name}</h3>
                                        <div className={styles.leadMeta}>
                                            <Clock size={14} />
                                            <span>{getRelativeTime(lead.created_at)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.leadBody}>
                                    <div className={styles.leadContact}>
                                        <Phone size={16} />
                                        <span>{lead.phone}</span>
                                    </div>
                                </div>

                                <div className={styles.leadActions}>
                                    <button
                                        className={styles.whatsappBtn}
                                        onClick={() => handleWhatsApp(lead)}
                                        title="Kirim pesan WhatsApp"
                                    >
                                        <MessageCircle size={18} />
                                        <span>Hubungi via WhatsApp</span>
                                    </button>
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={() => handleDelete(lead.id)}
                                        disabled={isDeleting === lead.id}
                                        title="Hapus"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
