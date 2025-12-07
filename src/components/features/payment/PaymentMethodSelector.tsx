import React, { useState } from 'react';
import { CreditCard, Building2, Banknote, ChevronRight, Loader2 } from 'lucide-react';
import styles from './PaymentMethodSelector.module.css';

// This component intentionally owns the COD confirmation modal logic,
// even though the original design suggested a simpler selector.
// This keeps the modal UX tightly coupled to the method selection UI.

export interface PaymentMethodSelectorProps {
  onSelectMethod: (method: 'qris' | 'transfer' | 'cod') => Promise<void>;
  isLoading?: boolean;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  onSelectMethod,
  isLoading = false,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCodConfirm, setShowCodConfirm] = useState(false);


  const handleSelect = async (method: 'qris' | 'transfer' | 'cod') => {
    if (method === 'cod') {
      setShowCodConfirm(true);
      return;
    }
    setIsUpdating(true);
    try {
      await onSelectMethod(method);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCodConfirm = async () => {
    setIsUpdating(true);
    try {
      await onSelectMethod('cod');
      setShowCodConfirm(false);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div className={styles.methodGrid}>
        <button
          className={styles.methodCard}
          onClick={() => handleSelect('qris')}
          disabled={isUpdating || isLoading}
        >
          <div className={styles.methodIcon}>
            <CreditCard size={28} />
          </div>
          <div className={styles.methodInfo}>
            <h3>QRIS / E-Wallet</h3>
            <p>GoPay, OVO, Dana, dll</p>
          </div>
          <ChevronRight size={20} />
        </button>

        <button
          className={styles.methodCard}
          onClick={() => handleSelect('transfer')}
          disabled={isUpdating || isLoading}
        >
          <div className={styles.methodIcon}>
            <Building2 size={28} />
          </div>
          <div className={styles.methodInfo}>
            <h3>Transfer Bank</h3>
            <p>BCA, Mandiri, BNI</p>
          </div>
          <ChevronRight size={20} />
        </button>

        <button
          className={styles.methodCard}
          onClick={() => handleSelect('cod')}
          disabled={isUpdating || isLoading}
        >
          <div className={styles.methodIcon}>
            <Banknote size={28} />
          </div>
          <div className={styles.methodInfo}>
            <h3>Bayar di Tempat</h3>
            <p>Cash on Delivery</p>
          </div>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* COD Confirmation Modal */}
      {showCodConfirm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Konfirmasi COD</h3>
            <p>Bayar tunai saat mengambil pesanan. Siapkan uang pas.</p>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowCodConfirm(false)}
                disabled={isUpdating}
              >
                Batal
              </button>
              <button
                className={styles.confirmBtn}
                onClick={handleCodConfirm}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    Memproses...
                  </>
                ) : (
                  'Ya, Pilih COD'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
