import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Plus, Trash2, Phone, User, CheckCircle, XCircle } from 'lucide-react';
import styles from './AdminContactPage.module.css';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface AdminContact {
    id: string;
    name: string;
    phone_number: string;
    is_active: boolean;
}

export const AdminContactPage: React.FC = () => {
    const [contacts, setContacts] = useState<AdminContact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Form state
    const [formData, setFormData] = useState({ name: '', phone: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Delete dialog
    const [contactToDelete, setContactToDelete] = useState<AdminContact | null>(null);

    const fetchContacts = async () => {
        try {
            const { data, error } = await supabase
                .from('admin_contacts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setContacts(data || []);
        } catch (error) {
            console.error('Error fetching contacts:', error);
            toast.error('Failed to load contacts');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.phone.trim()) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('admin_contacts')
                .insert({
                    name: formData.name.trim(),
                    phone_number: formData.phone.trim(),
                    is_active: true
                });

            if (error) throw error;

            toast.success('Contact added successfully');
            setFormData({ name: '', phone: '' });
            setIsFormOpen(false);
            fetchContacts();
        } catch (error) {
            console.error('Error adding contact:', error);
            toast.error('Failed to add contact');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleStatus = async (contact: AdminContact) => {
        try {
            const { error } = await supabase
                .from('admin_contacts')
                .update({ is_active: !contact.is_active })
                .eq('id', contact.id);

            if (error) throw error;
            fetchContacts(); // Refresh to ensure sync
            toast.success(`Contact ${!contact.is_active ? 'activated' : 'deactivated'}`);
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Failed to update status');
        }
    };

    const handleDelete = async () => {
        if (!contactToDelete) return;

        try {
            const { error } = await supabase
                .from('admin_contacts')
                .delete()
                .eq('id', contactToDelete.id);

            if (error) throw error;

            toast.success('Contact deleted');
            fetchContacts();
        } catch (error) {
            console.error('Error deleting contact:', error);
            toast.error('Failed to delete contact');
        } finally {
            setContactToDelete(null);
        }
    };

    if (isLoading) return <div className={styles.loading}>Loading contacts...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Admin Contacts</h1>
                    <p className={styles.subtitle}>
                        Manage WhatsApp contacts for customer notifications
                    </p>
                </div>
                <Button onClick={() => setIsFormOpen(true)} size="sm">
                    <Plus size={18} />
                    Add Contact
                </Button>
            </div>

            {/* Add Contact Form (Inline Card) */}
            {isFormOpen && (
                <Card className={styles.formCard}>
                    <h3 className={styles.formTitle}>Add New Contact</h3>
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label>Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Admin Sales"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className={styles.input}
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>WhatsApp Number</label>
                            <input
                                type="text"
                                placeholder="e.g. 628123456789"
                                value={formData.phone}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setFormData({ ...formData, phone: val });
                                }}
                                className={styles.input}
                                required
                            />
                            <p className={styles.hint}>Format: 628...</p>
                        </div>
                        <div className={styles.formActions}>
                            <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" isLoading={isSubmitting}>
                                Save Contact
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            <div className={styles.grid}>
                {contacts.length === 0 && !isFormOpen ? (
                    <div className={styles.emptyState}>
                        <p>No contacts found. Add one to get started.</p>
                    </div>
                ) : (
                    contacts.map(contact => (
                        <div key={contact.id} className={`${styles.contactCard} ${!contact.is_active ? styles.inactive : ''}`}>
                            <div className={styles.cardInfo}>
                                <div className={styles.avatar}>
                                    <User size={20} />
                                </div>
                                <div>
                                    <h4 className={styles.contactName}>{contact.name}</h4>
                                    <div className={styles.contactPhone}>
                                        <Phone size={14} />
                                        +{contact.phone_number}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.cardActions}>
                                <button
                                    className={`${styles.iconBtn} ${contact.is_active ? styles.activeBtn : styles.inactiveBtn}`}
                                    onClick={() => toggleStatus(contact)}
                                    title={contact.is_active ? "Deactivate" : "Activate"}
                                >
                                    {contact.is_active ? <CheckCircle size={18} /> : <XCircle size={18} />}
                                </button>
                                <button
                                    className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                    onClick={() => setContactToDelete(contact)}
                                    title="Delete"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {contactToDelete && (
                <ConfirmDialog
                    isOpen={!!contactToDelete}
                    title="Delete Contact"
                    message={`Are you sure you want to delete "${contactToDelete.name}"?`}
                    variant="danger"
                    confirmText="Delete"
                    onConfirm={handleDelete}
                    onCancel={() => setContactToDelete(null)}
                />
            )}
        </div>
    );
};
