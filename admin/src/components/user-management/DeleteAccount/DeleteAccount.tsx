import React, { useEffect, useState } from "react";
import { Box } from "@strapi/design-system";
import { Checkbox } from "@strapi/design-system";
import { Modal, Flex, Typography, Button } from "@strapi/design-system";
import { WarningCircle } from "@strapi/icons";

interface DeleteAccountProps {
  isOpen: boolean;
  email: string;
  onToggleDialog: () => void;
  onConfirm: (isStrapiIncluded: boolean, isFirebaseIncluded: boolean) => void;
  isSingleRecord?: boolean;
}

export const DeleteAccount = ({
  isOpen,
  email,
  onConfirm,
  onToggleDialog,
  isSingleRecord = false,
}: DeleteAccountProps) => {
  const [isStrapiIncluded, setIsStrapiIncluded] = useState(true);
  const [isFirebaseIncluded, setIsFirebaseIncluded] = useState(true);

  useEffect(() => {
    setIsStrapiIncluded(true);
    setIsFirebaseIncluded(true);
  }, [isOpen]);

  return (
    <Modal.Root open={isOpen} onOpenChange={(open: boolean) => !open && onToggleDialog()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Delete Account</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Flex direction="row" alignItems="center" gap={2}>
              <WarningCircle fill="danger700" width="20px" height="20px" />
              <Typography textColor="danger700">
                After you delete an account, it's permanently deleted. Accounts cannot be undeleted.
              </Typography>
            </Flex>
            {isSingleRecord && (
              <>
                <Flex direction="column" alignItems="stretch" gap={1}>
                  <Typography variant="sigma">User account</Typography>
                  <Typography>{email}</Typography>
                </Flex>
                <Flex direction="column" alignItems="stretch" gap={2}>
                  <Typography>Delete user from:</Typography>
                  <Flex direction="row" alignItems="center" gap={4}>
                    <Checkbox
                      onCheckedChange={(checked: boolean | 'indeterminate') =>
                        setIsStrapiIncluded(checked === true)
                      }
                      checked={isStrapiIncluded}
                    >
                      Strapi
                    </Checkbox>
                    <Checkbox
                      onCheckedChange={(checked: boolean | 'indeterminate') =>
                        setIsFirebaseIncluded(checked === true)
                      }
                      checked={isFirebaseIncluded}
                    >
                      Firebase
                    </Checkbox>
                  </Flex>
                </Flex>
              </>
            )}
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={onToggleDialog} variant="tertiary">
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm(isStrapiIncluded, isFirebaseIncluded);
            }}
            disabled={!isFirebaseIncluded && !isStrapiIncluded}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};
