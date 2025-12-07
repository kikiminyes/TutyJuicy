import React, { useState } from 'react';
import { Upload, Package, Loader2, Copy, CreditCard, Building2, Maximize2, X, ArrowLeft } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { PaymentSettings } from '../../../types';
import toast from 'react-hot-toast';
import styles from './PaymentProofUploader.module.css';

export interface PaymentProofUploaderProps {
  orderId: string;
  selectedPaymentMethod: 'qris' | 'transfer';
  paymentSettings: PaymentSettings | null;
  displayTotal: number;
  onUploadSuccess: () => void;
  onChangeMethod: () => void;
  /** If false, the "change method" button will be hidden (e.g., after admin verification) */
  isChangeAllowed?: boolean;
}

export const PaymentProofUploader: React.FC<PaymentProofUploaderProps> = ({
  orderId,
  selectedPaymentMethod,
  paymentSettings,
  displayTotal,
  onUploadSuccess,
  onChangeMethod,
  isChangeAllowed = true,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showQrisFullscreen, setShowQrisFullscreen] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    processFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (file: File) => {
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

    if (file.size > MAX_FILE_SIZE) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Format: JPG, PNG, WebP, atau PDF');
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Disalin!');
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${orderId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('payment_proofs')
        .insert({ order_id: orderId, file_url: publicUrl, file_type: selectedFile.type });

      if (dbError) throw dbError;

      setSelectedFile(null);
      setFilePreview(null);
      toast.success('Bukti pembayaran terkirim!');
      onUploadSuccess();

    } catch (error: any) {
      toast.error('Gagal mengirim bukti.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className={styles.section}>
      {/* Back Button - Only show if change is allowed */}
      {isChangeAllowed && (
        <div className={styles.backButtonContainer}>
          <button
            className={styles.backButton}
            onClick={onChangeMethod}
            type="button"
          >
            <ArrowLeft size={18} />
            <span>Ganti Metode Pembayaran</span>
          </button>
        </div>
      )}

      {/* QRIS */}
      {selectedPaymentMethod === 'qris' && paymentSettings?.qris_image_url && (
        <div className={styles.qrisSection}>
          <h2 className={styles.sectionTitle}>
            <CreditCard size={20} />
            Scan Kode QRIS
          </h2>
          <div className={styles.qrisContainer}>
            <img
              src={paymentSettings.qris_image_url}
              alt="QRIS"
              className={styles.qrisImage}
              onClick={() => setShowQrisFullscreen(true)}
            />
            <button
              className={styles.expandBtn}
              onClick={() => setShowQrisFullscreen(true)}
            >
              <Maximize2 size={16} />
              Perbesar
            </button>
          </div>
          <p className={styles.qrisHint}>
            Scan menggunakan aplikasi e-wallet atau mobile banking
          </p>
        </div>
      )}

      {/* Bank Transfer */}
      {selectedPaymentMethod === 'transfer' && paymentSettings?.bank_name && (
        <div className={styles.bankSection}>
          <h2 className={styles.sectionTitle}>
            <Building2 size={20} />
            Transfer ke Rekening
          </h2>
          <div className={styles.bankCard}>
            <div className={styles.bankRow}>
              <span className={styles.bankLabel}>Bank</span>
              <span className={styles.bankValue}>{paymentSettings.bank_name}</span>
            </div>
            <div className={styles.bankRow}>
              <span className={styles.bankLabel}>No. Rekening</span>
              <div className={styles.bankCopy}>
                <span className={styles.bankValue}>{paymentSettings.account_number}</span>
                <button
                  className={styles.copyBtn}
                  onClick={() => copyToClipboard(paymentSettings.account_number || '')}
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
            <div className={styles.bankRow}>
              <span className={styles.bankLabel}>Atas Nama</span>
              <span className={styles.bankValue}>{paymentSettings.account_holder}</span>
            </div>
            <div className={styles.bankRow}>
              <span className={styles.bankLabel}>Total</span>
              <div className={styles.bankCopy}>
                <span className={`${styles.bankValue} ${styles.bankTotal}`}>
                  {formatPrice(displayTotal)}
                </span>
                <button
                  className={styles.copyBtn}
                  onClick={() => copyToClipboard(displayTotal.toString())}
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className={styles.uploadSection}>
        <h3 className={styles.uploadTitle}>
          <Upload size={18} />
          Upload Bukti Pembayaran
        </h3>

        {selectedFile ? (
          <div className={styles.filePreview}>
            {filePreview ? (
              <img src={filePreview} alt="Preview" className={styles.previewImage} />
            ) : (
              <div className={styles.pdfPreview}>
                <Package size={32} />
                <span>PDF</span>
              </div>
            )}
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{selectedFile.name}</span>
              <span className={styles.fileSize}>{formatFileSize(selectedFile.size)}</span>
            </div>
            <div className={styles.fileActions}>
              <button
                className={styles.secondaryBtn}
                onClick={handleClearFile}
                disabled={isUploading}
              >
                Ganti
              </button>
              <button
                className={styles.primaryBtn}
                onClick={handleConfirmUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} className={styles.spinner} />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Kirim Bukti
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <label
            className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              hidden
            />
            <Upload size={32} />
            <span className={styles.dropzoneText}>
              Tap untuk pilih file atau drag & drop
            </span>
            <span className={styles.dropzoneHint}>
              JPG, PNG, WebP, PDF (max 5MB)
            </span>
          </label>
        )}
      </div>

      {/* Ganti Metode button removed - it appears in PaymentPage after upload success */}

      {/* QRIS Fullscreen Modal */}
      {showQrisFullscreen && paymentSettings?.qris_image_url && (
        <div className={styles.modal} onClick={() => setShowQrisFullscreen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setShowQrisFullscreen(false)}>
              <X size={24} />
            </button>
            <img
              src={paymentSettings.qris_image_url}
              alt="QRIS"
              className={styles.modalImage}
            />
          </div>
        </div>
      )}
    </section>
  );
};
