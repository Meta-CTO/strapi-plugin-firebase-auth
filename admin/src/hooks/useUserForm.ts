import { useState, useCallback } from "react";
import { User } from "../../../model/User";
import { validateEmail, validatePhoneNumber } from "../utils/validation";

interface UseUserFormReturn {
  userData: Partial<User>;
  setUserData: React.Dispatch<React.SetStateAction<Partial<User>>>;
  emailError: string | null;
  phoneError: string | null;
  hasBeenTouched: boolean;
  handlers: {
    onTextInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onEmailBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
    onPhoneChange: (value: string | undefined) => void;
    onToggleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
  isSubmitDisabled: boolean;
}

export const useUserForm = (initialData: Partial<User> = {}): UseUserFormReturn => {
  const [userData, setUserData] = useState<Partial<User>>(initialData);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [hasBeenTouched, setHasBeenTouched] = useState(false);

  const onTextInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setUserData((prevState) => ({
      ...prevState,
      [name]: value,
    }));

    // Clear error when user starts typing in email field
    if (name === 'email' && emailError) {
      setEmailError(null);
    }
  }, [emailError]);

  const onEmailBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const validation = validateEmail(value);
    setEmailError(validation.error);
    setHasBeenTouched(true);
  }, []);

  const onPhoneChange = useCallback((value: string | undefined) => {
    setUserData((prevState) => ({
      ...prevState,
      phoneNumber: value || '',
    }));

    // Validate phone in real-time
    const validation = validatePhoneNumber(value);
    setPhoneError(validation.error);
  }, []);

  const onToggleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUserData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.checked,
    }));
  }, []);

  // Check for empty or whitespace-only strings (consistent with validation.ts)
  const isEmailEmpty = !userData?.email || userData.email.trim() === '';
  const isPhoneEmpty = !userData?.phoneNumber || userData.phoneNumber.trim() === '';

  const isSubmitDisabled =
    (isEmailEmpty && isPhoneEmpty) ||
    !!(userData?.password?.length && userData?.password?.length < 6) ||
    !!emailError ||
    !!phoneError;

  return {
    userData,
    setUserData,
    emailError,
    phoneError,
    hasBeenTouched,
    handlers: {
      onTextInputChange,
      onEmailBlur,
      onPhoneChange,
      onToggleInputChange
    },
    isSubmitDisabled
  };
};