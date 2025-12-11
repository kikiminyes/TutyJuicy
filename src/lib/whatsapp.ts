import type { Order, OrderItem } from '../types';

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
};

export const generateOrderMessage = (order: Order, items: OrderItem[]) => {
    const header = `*New Order #${order.id.slice(0, 8)}*`;
    const customer = `Name: ${order.customer_name}\nPhone: ${order.customer_phone}\nAddress: ${order.customer_address || '-'}`;

    const itemsList = items.map(item => {
        // Note: We assume item.menu is populated or we use a fallback
        const menuName = (item as any).menu?.name || 'Item';
        return `- ${item.quantity}x ${menuName} (${formatCurrency(item.price_per_item * item.quantity)})`;
    }).join('\n');

    const total = `*Total: ${formatCurrency(order.total_amount)}*`;
    const footer = `Thank you for ordering with TutyJuicy!`;

    return `${header}\n\n${customer}\n\n*Order Details:*\n${itemsList}\n\n${total}\n\n${footer}`;
};

export const generateStatusUpdateMessage = (order: Order, status: string) => {
    let message = `Hi ${order.customer_name}, your order #${order.id.slice(0, 8)} status has been updated to: *${status.replace('_', ' ').toUpperCase()}*.`;

    if (status === 'payment_received') {
        message += `\n\nWe have received your payment. We will start preparing your order soon!`;
    } else if (status === 'ready') {
        message += `\n\nYour order is ready for pickup/delivery!`;
    }

    return message;
};

export const generatePaymentVerifiedMessage = (
    customerName: string,
    orderId: string,
    totalAmount: number,
    items: { name: string; quantity: number }[]
) => {
    const baseUrl = window.location.origin;
    const trackingUrl = `${baseUrl}/payment/${orderId}`;
    const formattedTotal = formatCurrency(totalAmount);

    const itemsList = items.map(item => `- ${item.quantity}x ${item.name}`).join('\n');

    return `*Tuty Juicy*

*PEMBAYARAN TERVERIFIKASI*

Halo Kak ${customerName},
Terima kasih! Pesanan PO kakak sudah kami terima dan siap kami proses.

=================
*Rincian:*
${itemsList}
*Total : ${formattedTotal}*
=================

Pantau status pesanan di sini:
${trackingUrl}

Ditunggu ya, terima kasih banyak!`;
};

export const openWhatsApp = (phone: string, message: string) => {
    // Remove non-digits and ensure ID country code if missing (simple heuristic)
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.slice(1);
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
};
