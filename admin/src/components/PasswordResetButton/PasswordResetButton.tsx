import React from "react";
import { Button, Tooltip, Box } from "@strapi/design-system";
import { Key } from "@strapi/icons";
import { User } from "../../../../model/User";
import { hasPasswordProvider, getPasswordResetTooltip } from "../../utils/hasPasswordProvider";

interface PasswordResetButtonProps {
  user: User | null;
  onClick?: () => void;
  fullWidth?: boolean;
  variant?: "default" | "secondary" | "tertiary" | "success" | "danger" | "success-light" | "danger-light";
  size?: "S" | "M" | "L";
}

export const PasswordResetButton: React.FC<PasswordResetButtonProps> = ({
  user,
  onClick,
  fullWidth = false,
  variant = "secondary",
  size = "M",
}) => {
  const canResetPassword = hasPasswordProvider(user);
  const tooltipMessage = getPasswordResetTooltip(user);

  const handleClick = () => {
    if (canResetPassword && onClick) {
      onClick();
    }
  };

  const button = (
    <Button
      onClick={handleClick}
      disabled={!canResetPassword}
      startIcon={<Key />}
      variant={variant}
      size={size}
      fullWidth={fullWidth}
    >
      Reset Password
    </Button>
  );

  // Only show tooltip when button is disabled
  if (!canResetPassword) {
    return (
      <Tooltip label={tooltipMessage}>
        <Box>{button}</Box>
      </Tooltip>
    );
  }

  return button;
};

export default PasswordResetButton;
