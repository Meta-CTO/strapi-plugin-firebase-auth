import React, { useState } from "react";
import { Dialog, Flex, Typography, Button, Alert } from "@strapi/design-system";

interface ResendVerificationProps {
  isOpen: boolean;
  email: string;
  userId: string;
  onClose: () => void;
  onSendVerificationEmail: () => Promise<void>;
}

export const ResendVerification = ({
  isOpen,
  email,
  userId,
  onClose,
  onSendVerificationEmail,
}: ResendVerificationProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");

  const resetState = () => {
    setEmailSent(false);
    setError("");
    setIsLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSendEmail = async () => {
    try {
      setIsLoading(true);
      setError("");
      await onSendVerificationEmail();
      setEmailSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send verification email");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && handleClose()}>
      <Dialog.Content>
        <Dialog.Header>Resend Verification Email</Dialog.Header>
        <Dialog.Body>
          <Flex direction="column" gap={4} alignItems="center">
            {!emailSent ? (
              <>
                <Typography textAlign="center">
                  Send a verification email to <strong>{email}</strong>?
                </Typography>
                <Typography variant="omega" textColor="neutral600" textAlign="center">
                  The link will expire in 1 hour.
                </Typography>
              </>
            ) : (
              <Alert variant="success" title="Email Sent">
                Verification email has been sent to {email}
              </Alert>
            )}

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
            <Button variant="success" loading={isLoading} onClick={handleSendEmail}>
              Send
            </Button>
          )}
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
};
