import React from 'react';
import { CheckCircle } from 'lucide-react';
import styles from './PaymentProgressTracker.module.css';

export interface PaymentProgressTrackerProps {
  currentStep: number; // 1-3
}

const WORKFLOW_STEPS = [
  { key: 'pilih', label: 'Pilih', color: '#ff7f50' },        // Orange
  { key: 'bayar', label: 'Bayar', color: '#f59e0b' },        // Amber
  { key: 'terverifikasi', label: 'Terverifikasi', color: '#3b82f6' }, // Blue
];



export const PaymentProgressTracker: React.FC<PaymentProgressTrackerProps> = ({
  currentStep,
}) => {
  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressSteps}>
        {WORKFLOW_STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber <= currentStep;

          return (
            <React.Fragment key={step.key}>
              <div className={`${styles.progressStep} ${isActive ? styles.progressStepActive : ''}`}>
                <div
                  className={styles.progressDot}
                  style={{
                    backgroundColor: isActive ? step.color : '#e5e7eb',
                    borderColor: isActive ? step.color : '#e5e7eb',
                  }}
                >
                  {isActive ? <CheckCircle size={14} color="white" /> : stepNumber}
                </div>
                <span
                  className={styles.progressLabel}
                  style={{ color: isActive ? step.color : '#9ca3af' }}
                >
                  {step.label}
                </span>

                {/* Connecting Line - Now inside the step to be relative to it */}
                {index < WORKFLOW_STEPS.length - 1 && (
                  <div className={styles.progressLine}>
                    {/* Background grey line (full width of the gap) */}
                    <div className={styles.lineBackground} />

                    {/* Colored active line (animates width) */}
                    <div
                      className={styles.lineActive}
                      style={{
                        backgroundColor: stepNumber < currentStep ? WORKFLOW_STEPS[index + 1].color : 'transparent',
                        width: stepNumber < currentStep ? '100%' : '0%'
                      }}
                    />
                  </div>
                )}


              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
