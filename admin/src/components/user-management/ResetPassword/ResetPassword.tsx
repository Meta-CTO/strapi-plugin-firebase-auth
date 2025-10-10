import React, { useState, useEffect } from "react";
import { Modal, Flex, Typography, Button } from "@strapi/design-system";
import { TextInput } from "@strapi/design-system";

interface ResetPasswordProps {
  isOpen: boolean;
  email: string;
  onClose: () => void;
  onConfirm: (newPassword: string) => void;
}

export const ResetPassword = ({ isOpen, email, onClose, onConfirm }: ResetPasswordProps) => {
  const [newPassword, setNewPassword] = useState("");
  const [isNewPasswordChange, setIsNewPasswordChanged] = useState(false);

  useEffect(() => {
    // Only reset state when modal closes, not when it opens
    // This prevents state updates from interfering with modal opening
    if (!isOpen) {
      setNewPassword("");
      setIsNewPasswordChanged(false);
    }
  }, [isOpen]);

  const resetState = () => {
    setNewPassword("");
    setIsNewPasswordChanged(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleConfirm = () => {
    resetState();
    onConfirm(newPassword);
  };

  return (
    <Modal.Root open={isOpen} onOpenChange={(open: boolean) => !open && handleClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Reset password</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Typography>Send a password reset email.</Typography>
            <Flex direction="column" alignItems="stretch" gap={1}>
              <Typography variant="sigma">User account</Typography>
              <Typography>{email}</Typography>
            </Flex>
            <TextInput
              type="password"
              label="New password"
              aria-label="Password"
              value={newPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setIsNewPasswordChanged(true);
                setNewPassword(e.target.value);
              }}
              required
              error={
                !isNewPasswordChange
                  ? ""
                  : !newPassword
                    ? "Password is required"
                    : newPassword.length < 6
                      ? "Password must contain at least 6 characters"
                      : ""
              }
            />
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleClose} variant="tertiary">
            Cancel
          </Button>
          <Button
            variant="danger-light"
            disabled={newPassword === "" || newPassword.length < 6}
            onClick={handleConfirm}
          >
            Reset password
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};
