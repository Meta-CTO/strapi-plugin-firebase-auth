import React, { useState, useEffect } from "react";
import { Dialog, Flex, Typography, Button, TextInput, Tabs, Alert } from "@strapi/design-system";

type ResetMode = "direct" | "email";

interface ResetPasswordProps {
  isOpen: boolean;
  email: string;
  userId: string;
  onClose: () => void;
  onDirectReset: (password: string) => Promise<void>;
  onSendResetEmail: () => Promise<void>;
  passwordRegex?: string;
  passwordMessage?: string;
}

export const ResetPassword = ({
  isOpen,
  email,
  userId,
  onClose,
  onDirectReset,
  onSendResetEmail,
  passwordRegex = "^.{6,}$",
  passwordMessage = "Password must be at least 6 characters long",
}: ResetPasswordProps) => {
  const [mode, setMode] = useState<ResetMode>("direct");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");
  const [isPasswordChanged, setIsPasswordChanged] = useState(false);

  useEffect(() => {
    // Reset state when modal closes
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    setPassword("");
    setEmailSent(false);
    setError("");
    setMode("direct");
    setIsPasswordChanged(false);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const validatePassword = (password: string): boolean => {
    if (!password) return false;
    try {
      const regex = new RegExp(passwordRegex);
      return regex.test(password);
    } catch (e) {
      // Invalid regex, fallback to length check
      console.error("Invalid password regex:", e);
      return password.length >= 6;
    }
  };

  const handleDirectReset = async () => {
    if (!validatePassword(password)) return;

    try {
      setIsLoading(true);
      setError("");
      await onDirectReset(password);
      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmail = async () => {
    try {
      setIsLoading(true);
      setError("");
      await onSendResetEmail();
      setEmailSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && handleClose()}>
      <Dialog.Content>
        <Dialog.Header>Reset Password</Dialog.Header>
        <Dialog.Body>
          <Flex direction="column" gap={4}>
            <Flex direction="column" gap={1}>
              <Typography variant="sigma">User email</Typography>
              <Typography>{email}</Typography>
            </Flex>

            <Tabs.Root value={mode} onValueChange={(val: string) => setMode(val as ResetMode)}>
              <Tabs.List>
                <Tabs.Trigger value="direct">Set Password Directly</Tabs.Trigger>
                <Tabs.Trigger value="email">Send Reset Email</Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="direct">
                <Flex direction="column" gap={3} paddingTop={4}>
                  <Typography>
                    Set a new password for this user. The user will not be notified of this change.
                  </Typography>
                  <Flex direction="column" gap={1}>
                    <TextInput
                      type="password"
                      label="New password"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setIsPasswordChanged(true);
                        setPassword(e.target.value);
                        setError(""); // Clear error when typing
                      }}
                      error={
                        isPasswordChanged && password && !validatePassword(password)
                          ? passwordMessage
                          : undefined
                      }
                      required
                    />
                    {isPasswordChanged && password && !validatePassword(password) && (
                      <Typography variant="pi" textColor="danger500">
                        {passwordMessage}
                      </Typography>
                    )}
                  </Flex>
                </Flex>
              </Tabs.Content>

              <Tabs.Content value="email">
                <Flex direction="column" gap={3} paddingTop={4}>
                  {!emailSent ? (
                    <Typography>
                      Send a password reset email to <strong>{email}</strong>. The link will expire in 1 hour.
                    </Typography>
                  ) : (
                    <Alert variant="success" title="Email Sent">
                      Password reset email has been sent to {email}
                    </Alert>
                  )}
                </Flex>
              </Tabs.Content>
            </Tabs.Root>

            {error && (
              <Alert variant="danger" title="Error">
                {error}
              </Alert>
            )}
          </Flex>
        </Dialog.Body>
        <Dialog.Footer>
          <Button onClick={handleClose} variant="tertiary">
            {emailSent ? "Close" : "Cancel"}
          </Button>
          {!emailSent && (
            <Button
              variant={mode === "direct" ? "danger-light" : "success"}
              loading={isLoading}
              disabled={mode === "direct" && !validatePassword(password)}
              onClick={mode === "direct" ? handleDirectReset : handleSendEmail}
            >
              {mode === "direct" ? "Set Password" : "Send Reset Email"}
            </Button>
          )}
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
};
