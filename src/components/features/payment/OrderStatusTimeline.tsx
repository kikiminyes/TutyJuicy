import React from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import type { Order } from '../../../types';
import styles from './OrderStatusTimeline.module.css';

export interface OrderStatusTimelineProps {
  order: Order;
}

const STATUS_CONFIG = [
  { key: 'payment_received', label: 'Pembayaran Terverifikasi', color: '#3b82f6' },
  { key: 'preparing', label: 'Sedang Disiapkan', color: '#8b5cf6' },
  { key: 'ready', label: 'Siap Diambil', color: '#10b981' },
  { key: 'picked_up', label: 'Pesanan Selesai', color: '#10b981' },
];

export const OrderStatusTimeline: React.FC<OrderStatusTimelineProps> = ({ order }) => {
  const statusOrder = ['payment_received', 'preparing', 'ready', 'picked_up'];
  const currentIndex = statusOrder.indexOf(order.status);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <Clock size={20} />
        Riwayat Pesanan
      </h2>
      <div className={styles.timelineHistory}>
        {STATUS_CONFIG.map((step, index) => {
          const stepIndex = statusOrder.indexOf(step.key);
          const isCompleted = stepIndex < currentIndex;
          const isCurrent = stepIndex === currentIndex;
          const isActive = stepIndex <= currentIndex;

          return (
            <div
              key={step.key}
              className={`${styles.historyItem} ${isActive ? styles.historyItemActive : ''}`}
            >
              <div
                className={styles.historyDot}
                style={{
                  backgroundColor: isActive ? step.color : '#e5e7eb',
                  borderColor: isActive ? step.color : '#e5e7eb',
                }}
              >
                {isCompleted || isCurrent ? (
                  <CheckCircle size={14} color="white" />
                ) : (
                  <Clock size={14} color="#9ca3af" />
                )}
              </div>
              <div className={styles.historyContent}>
                <span
                  className={styles.historyLabel}
                  style={{ color: isActive ? step.color : '#9ca3af' }}
                >
                  {step.label}
                </span>

                {isCompleted && (
                  <span className={styles.historyTime}>
                    {new Date(order.updated_at || order.created_at).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
              {index < 3 && (
                <div
                  className={styles.historyLine}
                  style={{
                    backgroundColor: stepIndex < currentIndex ? STATUS_CONFIG[index + 1].color : '#e5e7eb',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
