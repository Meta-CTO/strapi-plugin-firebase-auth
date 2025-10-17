import validator from "validator";

export function validateEmail(email: string | null | undefined): {
  isValid: boolean;
  error: string | null;
} {
  // Empty is valid (field is optional if phone provided)
  if (!email || email.trim() === "") {
    return { isValid: true, error: null };
  }

  const trimmed = email.trim();

  if (!validator.isEmail(trimmed)) {
    return {
      isValid: false,
      error: "Please enter a valid email address",
    };
  }

  return { isValid: true, error: null };
}

export function validatePhoneNumber(phone: string | null | undefined): {
  isValid: boolean;
  error: string | null;
} {
  // Empty is valid (field is optional if email provided)
  if (!phone || phone.trim() === "") {
    return { isValid: true, error: null };
  }

  // react-phone-number-input returns undefined for invalid numbers
  // and E.164 string for valid numbers
  // Just check it starts with + (E.164 format)
  const trimmed = phone.trim();

  if (!trimmed.startsWith("+")) {
    return {
      isValid: false,
      error: "Phone number must be in international format (E.164)",
    };
  }

  return { isValid: true, error: null };
}

export function validateUserForm(
  email?: string,
  phoneNumber?: string
): {
  isValid: boolean;
  errors: { email?: string; phoneNumber?: string; general?: string };
} {
  const errors: { email?: string; phoneNumber?: string; general?: string } = {};

  // At least one required
  if (!email && !phoneNumber) {
    errors.general = "Email or Phone Number is required";
    return { isValid: false, errors };
  }

  // Validate email if provided
  if (email) {
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      errors.email = emailValidation.error!;
    }
  }

  // Validate phone if provided
  if (phoneNumber) {
    const phoneValidation = validatePhoneNumber(phoneNumber);
    if (!phoneValidation.isValid) {
      errors.phoneNumber = phoneValidation.error!;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
