// Validation utilities for TutyJuicy forms
// Supports Indonesian phone numbers and customer data validation

// Phone validation regex - supports Indonesian formats:
// - 08xxxxxxxxx (local format)
// - +628xxxxxxxxx (international format)
// - 628xxxxxxxxx (without + prefix)
// Accepts optional prefix (+62|62|0) or bare numbers starting with 8
export const PHONE_REGEX = /^(?:\+62|62|0)?8[0-9]{8,11}$/;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates Indonesian phone numbers
 * Accepts formats: 08xxx, +628xxx, 628xxx
 *
 * @param phone - Phone number to validate
 * @returns ValidationResult with isValid flag and optional error message
 *
 * @example
 * validatePhone('08123456789') // { isValid: true }
 * validatePhone('+628123456789') // { isValid: true }
 * validatePhone('12345') // { isValid: false, error: '...' }
 */
export const validatePhone = (phone: string): ValidationResult => {
  const cleaned = phone.trim();

  if (!cleaned) {
    return { isValid: false, error: 'Nomor telepon wajib diisi' };
  }

  if (!PHONE_REGEX.test(cleaned)) {
    return {
      isValid: false,
      error: 'Format nomor tidak valid. Gunakan format: 08... atau +628...'
    };
  }

  return { isValid: true };
};

/**
 * Normalizes phone number to E.164 format (+62xxx)
 * Converts local format (08xxx) to international format
 *
 * @param phone - Phone number to normalize
 * @returns Normalized phone number in E.164 format
 *
 * @example
 * normalizePhone('08123456789') // '+628123456789'
 * normalizePhone('+628123456789') // '+628123456789'
 * normalizePhone('628123456789') // '+628123456789'
 */
export const normalizePhone = (phone: string): string => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // If user typed leading 0 and UI already shows +62, remove leading 0
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }

  // Ensure we have country code 62 prefix
  if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }

  // Add + prefix for E.164 format
  return '+' + cleaned;
};

/**
 * Validates customer name
 * - Must not be empty
 * - Must be at least 2 characters
 * - Must be less than 100 characters
 * - Can contain letters (including Unicode/accented), spaces, and common punctuation (. - ')
 *
 * @param name - Customer name to validate
 * @returns ValidationResult with isValid flag and optional error message
 */
export const validateName = (name: string): ValidationResult => {
  const cleaned = name.trim();

  if (!cleaned) {
    return { isValid: false, error: 'Nama wajib diisi' };
  }

  if (cleaned.length < 2) {
    return { isValid: false, error: 'Nama minimal 2 karakter' };
  }

  if (cleaned.length > 100) {
    return { isValid: false, error: 'Nama maksimal 100 karakter' };
  }

  // Allow Unicode letters (including accented chars like é, ü, etc.), spaces, and common punctuation
  // \p{L} matches any Unicode letter
  if (!/^[\p{L}\s.\-']+$/u.test(cleaned)) {
    return {
      isValid: false,
      error: 'Nama hanya boleh berisi huruf, spasi, dan tanda baca umum'
    };
  }

  return { isValid: true };
};

/**
 * Validates address/notes (optional field)
 * - Can be empty (optional)
 * - Must be less than 500 characters if provided
 *
 * @param address - Address or delivery notes
 * @returns ValidationResult with isValid flag and optional error message
 */
export const validateAddress = (address: string): ValidationResult => {
  const cleaned = address.trim();

  // Address is optional, so empty is valid
  if (cleaned.length === 0) {
    return { isValid: true };
  }

  if (cleaned.length > 500) {
    return {
      isValid: false,
      error: 'Catatan alamat maksimal 500 karakter'
    };
  }

  return { isValid: true };
};

/**
 * Checkout form data interface
 */
export interface CheckoutFormData {
  name: string;
  phone: string;
  address: string;
}

/**
 * Validates entire checkout form
 * Returns aggregated validation results for all fields
 *
 * @param data - Checkout form data
 * @returns Object with isValid flag and errors object
 *
 * @example
 * const result = validateCheckoutForm({
 *   name: 'John Doe',
 *   phone: '08123456789',
 *   address: '123 Main St'
 * });
 * if (!result.isValid) {
 *   console.log(result.errors); // { name?: string, phone?: string, address?: string }
 * }
 */
export const validateCheckoutForm = (data: CheckoutFormData): {
  isValid: boolean;
  errors: Partial<Record<keyof CheckoutFormData, string>>;
} => {
  const errors: Partial<Record<keyof CheckoutFormData, string>> = {};

  // Validate name
  const nameResult = validateName(data.name);
  if (!nameResult.isValid) {
    errors.name = nameResult.error;
  }

  // Validate phone
  const phoneResult = validatePhone(data.phone);
  if (!phoneResult.isValid) {
    errors.phone = phoneResult.error;
  }

  // Validate address (optional)
  const addressResult = validateAddress(data.address);
  if (!addressResult.isValid) {
    errors.address = addressResult.error;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
