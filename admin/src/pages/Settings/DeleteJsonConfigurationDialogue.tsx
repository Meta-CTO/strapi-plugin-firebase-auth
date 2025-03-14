import React from "react";
import { Dialog } from "@strapi/design-system";
import { Button } from "@strapi/design-system";
import { Typography } from "@strapi/design-system";
import { WarningCircle } from "@strapi/icons";

interface DeleteJsonConfigurationDialogueProps {
  isOpen: boolean;
  onToggleDialog: () => void;
  onConfirm: () => void;
}

export const DeleteJsonConfigurationDialogue = ({
  isOpen,
  onToggleDialog,
  onConfirm,
}: DeleteJsonConfigurationDialogueProps) => {
  console.log("Dialog props:", { isOpen });
  return (
    <Dialog.Root onClose={onToggleDialog} isOpen={isOpen}>
      <Dialog.Content>
        <Dialog.Header>Delete Configuration</Dialog.Header>
        <Dialog.Body icon={<WarningCircle fill="danger600" />}>
          <Typography textColor="danger700">
            Are you sure you want to delete your current firebase configuration?
          </Typography>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Cancel>
            <Button fullWidth variant="tertiary" onClick={onToggleDialog}>
              Cancel
            </Button>
          </Dialog.Cancel>
          <Dialog.Action>
            <Button fullWidth variant="danger-light" onClick={onConfirm}>
              Yes, delete
            </Button>
          </Dialog.Action>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
};
