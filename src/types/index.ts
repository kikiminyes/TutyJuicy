export interface Menu {
    id: string;
    name: string;
    price: number;
    description: string | null;
    image_url: string | null;
    size: string | null;
    created_at: string;
    updated_at: string;
}

export interface MenuImage {
    id: string;
    menu_id: string;
    image_url: string;
    display_order: number;
}

export interface Batch {
    id: string;
    title: string;
    delivery_date: string;
    status: 'draft' | 'open' | 'closed';
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface BatchWithStock extends Batch {
    batch_stocks?: Array<{
        quantity_available: number;
        quantity_reserved: number;
    }>;
    total_items?: number;
    total_quantity?: number;
    order_count?: number;
    total_revenue?: number;
}

export interface StockUpdateInput {
    menu_id: string;
    quantity_available: number;
}

export interface BatchStock {
    id: string;
    batch_id: string;
    menu_id: string;
    quantity_available: number;
    quantity_reserved: number;
    created_at: string;
    updated_at: string;
}

export interface Order {
    id: string;
    batch_id: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string | null;
    total_amount: number;
    status: 'pending_payment' | 'payment_received' | 'preparing' | 'ready' | 'picked_up' | 'cancelled';
    payment_method: 'qris' | 'transfer' | 'cod' | 'pending';
    payment_started_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface OrderItem {
    id: string;
    order_id: string;
    menu_id: string;
    quantity: number;
    price_per_item: number;
}

export interface PaymentProof {
    id: string;
    order_id: string;
    file_url: string;
    file_type: string;
    uploaded_at: string;
}

export interface PaymentSettings {
    id: string;
    qris_image_url: string | null;
    bank_name: string | null;
    account_number: string | null;
    account_holder: string | null;
    admin_phone_number: string | null;
    created_at: string;
}

export interface WaitlistLead {
    id: string;
    name: string;
    phone: string;
    created_at: string;
    notified: boolean;
    notified_at: string | null;
}
