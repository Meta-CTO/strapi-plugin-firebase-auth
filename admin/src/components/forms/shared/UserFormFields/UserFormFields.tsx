import React from "react";
import { TextInput, Toggle, Field } from "@strapi/design-system";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import styled from "styled-components";
import { User } from "../../../../../../model/User";

const StyledPhoneInputWrapper = styled.div`
  width: 100%;

  /* Main container styles */
  .react-tel-input {
    width: 100%;

    .form-control {
      width: 100%;
      height: 40px;
      padding: 0 0.75rem 0 58px;
      border: 1px solid ${({ theme }) => theme.colors.neutral200};
      border-radius: ${({ theme }) => theme.borderRadius};
      background: ${({ theme }) => theme.colors.neutral0};
      color: ${({ theme }) => theme.colors.neutral800};
      font-size: 14px;
      font-family:
        -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans",
        "Droid Sans", "Helvetica Neue", sans-serif;
      transition: all 0.2s;

      &:hover {
        border-color: ${({ theme }) => theme.colors.neutral300};
      }

      &:focus {
        border-color: ${({ theme }) => theme.colors.primary600};
        outline: none;
        box-shadow: ${({ theme }) => theme.colors.primary600} 0px 0px 0px 2px;
      }

      &::placeholder {
        color: ${({ theme }) => theme.colors.neutral600};
      }
    }
  }

  /* Flag dropdown button styles */
  .flag-dropdown {
    background: transparent;
    border: none;
    border-right: none;

    &.open {
      z-index: 1001;
    }

    .selected-flag {
      padding: 0 0 0 0.75rem;
      height: 40px;
      display: flex;
      align-items: center;

      &:hover {
        background: transparent;
      }

      .arrow {
        border-top-color: ${({ theme }) => theme.colors.neutral800};
        margin-left: 8px;
      }

      &.open .arrow {
        border-top-color: ${({ theme }) => theme.colors.neutral800};
      }
    }
  }

  /* Country dropdown list styles */
  .country-list {
    background: ${({ theme }) => theme.colors.neutral0};
    border: 1px solid ${({ theme }) => theme.colors.neutral200};
    border-radius: ${({ theme }) => theme.borderRadius};
    box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.15);
    max-height: 300px;
    overflow-y: auto;
    z-index: 1002;
    margin-top: 4px;
    width: 300px;

    /* Search field styles */
    .search {
      background: ${({ theme }) => theme.colors.neutral0};
      padding: 10px;
      position: sticky;
      top: 0;
      z-index: 10;
      border-bottom: 1px solid ${({ theme }) => theme.colors.neutral200};

      .search-box {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid ${({ theme }) => theme.colors.neutral200};
        border-radius: ${({ theme }) => theme.borderRadius};
        background: ${({ theme }) => theme.colors.neutral0};
        color: ${({ theme }) => theme.colors.neutral800};
        font-size: 14px;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans",
          "Droid Sans", "Helvetica Neue", sans-serif;

        &:focus {
          border-color: ${({ theme }) => theme.colors.primary600};
          outline: none;
          box-shadow: ${({ theme }) => theme.colors.primary600} 0px 0px 0px 2px;
        }

        &::placeholder {
          color: ${({ theme }) => theme.colors.neutral600};
        }
      }
    }

    /* Country item styles */
    .country {
      padding: 8px 12px;
      cursor: pointer;
      font-size: 14px;
      color: ${({ theme }) => theme.colors.neutral800};
      font-family:
        -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans",
        "Droid Sans", "Helvetica Neue", sans-serif;

      &:hover {
        background: ${({ theme }) => theme.colors.neutral100};
      }

      &.highlight {
        background: ${({ theme }) => theme.colors.primary100};
      }

      /* Country name and dial code */
      .country-name {
        color: ${({ theme }) => theme.colors.neutral800};
      }

      .dial-code {
        color: ${({ theme }) => theme.colors.neutral600};
      }
    }
  }
`;

interface UserFormFieldsProps {
  userData: Partial<User>;
  onTextInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhoneChange: (value: string | undefined) => void;
  onToggleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEmailBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  emailError: string | null;
  phoneError: string | null;
  showPasswordHint?: boolean;
  isPasswordRequired?: boolean;
  hasBeenTouched?: boolean;
}

export const UserFormFields = ({
  userData,
  onTextInputChange,
  onPhoneChange,
  onToggleInputChange,
  onEmailBlur,
  emailError,
  phoneError,
  showPasswordHint = false,
  isPasswordRequired = false,
  hasBeenTouched = false,
}: UserFormFieldsProps) => {
  return (
    <>
      <Field.Root
        style={{ width: "50%" }}
        error={
          emailError ||
          (hasBeenTouched && !userData?.email && !userData?.phoneNumber
            ? "Email or Phone Number is required"
            : undefined)
        }
      >
        <Field.Label>Email</Field.Label>
        <TextInput
          id="email"
          name="email"
          autoComplete="new-password"
          onChange={onTextInputChange}
          onBlur={onEmailBlur}
          value={userData.email || ""}
        />
        <Field.Error />
      </Field.Root>

      <Field.Root style={{ width: "50%" }}>
        <Field.Label>Display Name</Field.Label>
        <TextInput
          id="displayName"
          name="displayName"
          autoComplete="new-password"
          onChange={onTextInputChange}
          value={userData.displayName || ""}
        />
      </Field.Root>

      <Field.Root style={{ width: "50%" }} error={phoneError || undefined}>
        <Field.Label>Phone Number</Field.Label>
        <StyledPhoneInputWrapper>
          <PhoneInput
            value={userData.phoneNumber || ""}
            onChange={(phone) => onPhoneChange("+" + phone)}
            country={"us"}
            enableSearch={true}
            searchPlaceholder="Search countries..."
            searchStyle={{
              width: "100%",
              padding: "8px",
            }}
            inputProps={{
              placeholder: "+1 (555) 000-0000",
            }}
            containerStyle={{
              width: "100%",
            }}
            inputStyle={{
              width: "100%",
            }}
            buttonStyle={{
              borderRight: "none",
            }}
            dropdownStyle={{
              width: "300px",
            }}
          />
        </StyledPhoneInputWrapper>
        <Field.Error />
        <Field.Hint>E.164 format: +[country code][number] (e.g., +14155552671)</Field.Hint>
      </Field.Root>

      <Field.Root
        style={{ width: "50%" }}
        error={
          userData?.password?.length && userData?.password?.length < 6
            ? "Password must be at least 6 characters"
            : undefined
        }
      >
        <Field.Label>Password</Field.Label>
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          onChange={onTextInputChange}
          value={userData.password || ""}
          required={isPasswordRequired}
        />
        <Field.Error />
        {showPasswordHint && <Field.Hint>Leave empty to keep current password</Field.Hint>}
      </Field.Root>

      <Field.Root maxWidth="320px">
        <Field.Label>Disabled</Field.Label>
        <Toggle
          name="disabled"
          onLabel="True"
          offLabel="False"
          checked={Boolean(userData.disabled)}
          onChange={onToggleInputChange}
        />
      </Field.Root>

      <Field.Root maxWidth="320px">
        <Field.Label>Email Verified</Field.Label>
        <Toggle
          name="emailVerified"
          onLabel="True"
          offLabel="False"
          checked={Boolean(userData.emailVerified)}
          onChange={onToggleInputChange}
        />
      </Field.Root>
    </>
  );
};
