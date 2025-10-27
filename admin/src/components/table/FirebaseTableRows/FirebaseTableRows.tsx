import React from "react";
import { Box, Flex, Checkbox, Typography, Button, Tbody, Tr, Td, Tooltip } from "@strapi/design-system";
import { useNavigate, useLocation } from "react-router-dom";
import { useIntl } from "react-intl";
import { RxCross2, RxCheck } from "react-icons/rx";
import styled from "styled-components";
import { MapProviderToIcon } from "../../../utils/provider";
import { User } from "../../../../../model/User";
import { Key, Trash } from "@strapi/icons";
import { format } from "date-fns";
import { hasPasswordProvider, getPasswordResetTooltip } from "../../../utils/hasPasswordProvider";

const TypographyMaxWidth = styled(Typography)`
  max-width: 300px;
`;

const CellLink = styled(Td)`
  text-decoration: underline;
  color: ${({ theme }) => theme.colors.primary600};
  &:hover {
    cursor: pointer;
    color: ${({ theme }) => theme.colors.primary700};
  }
  & > span {
    color: ${({ theme }) => theme.colors.primary600};
  }
`;

const ActionCell = styled(Td)`
  /* Prevent scroll on button clicks */
  position: relative;

  /* Critical: Prevent browser from scrolling to this cell */
  scroll-margin: 0;
  scroll-snap-margin: 0;

  /* Stop event bubbling at cell level */
  & button {
    position: relative;
    z-index: 1;

    /* Ensure button is immediately clickable */
    pointer-events: auto;
    touch-action: manipulation;
  }
`;

interface FirebaseTableRowsProps {
  rows: User[];
  entriesToDelete: string[];
  onSelectRow: ({ name, value }: { name: string; value: boolean }) => void;
  onResetPasswordClick: (data: User) => void;
  onDeleteAccountClick: (data: User) => void;
}

export const FirebaseTableRows = ({
  rows,
  entriesToDelete,
  onSelectRow,
  onResetPasswordClick,
  onDeleteAccountClick,
}: FirebaseTableRowsProps) => {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Tbody>
      {rows.map((data: User) => {
        const isChecked = entriesToDelete.includes(data.id);

        return (
          <Tr key={data.uid}>
            <Td>
              <Flex justifyContent="center" alignItems="center">
                <Checkbox
                  aria-label={formatMessage({
                    id: "app.component.table.select.one-entry",
                    defaultMessage: `Select {target}`,
                  })}
                  checked={isChecked}
                  onCheckedChange={(checked: boolean | "indeterminate") => {
                    onSelectRow({ name: data.id, value: checked === true });
                  }}
                />
              </Flex>
            </Td>
            <CellLink
              key={data.uid}
              onClick={() => {
                navigate(data.uid, {
                  state: {
                    strapiId: data.strapiId,
                    strapiDocumentId: data.strapiDocumentId,
                  },
                });
              }}
            >
              <TypographyMaxWidth ellipsis textColor="neutral800">
                {data.uid}
              </TypographyMaxWidth>
            </CellLink>
            <CellLink key={data.strapiId}>
              <TypographyMaxWidth ellipsis textColor="neutral800">
                <Box
                  onClick={() => {
                    navigate(
                      `/content-manager/collection-types/plugin::users-permissions.user/${data.strapiDocumentId || data.strapiId}`,
                      { state: { from: location.pathname } }
                    );
                  }}
                >
                  {data.strapiId}
                </Box>
              </TypographyMaxWidth>
            </CellLink>
            <Td key={data.username}>
              <TypographyMaxWidth ellipsis textColor="neutral800">
                {data.username}
              </TypographyMaxWidth>
            </Td>
            <Td>
              <TypographyMaxWidth ellipsis textColor="neutral800">
                {data.displayName}
              </TypographyMaxWidth>
            </Td>
            <Td key={data.email} style={{ padding: 16 }}>
              <TypographyMaxWidth ellipsis textColor="neutral800">
                {data.email}
              </TypographyMaxWidth>
            </Td>
            <Td key={data.phoneNumber} style={{ padding: 16 }}>
              <TypographyMaxWidth ellipsis textColor="neutral800">
                {data.phoneNumber || "-"}
              </TypographyMaxWidth>
            </Td>
            <Td>
              <MapProviderToIcon providerData={data.providerData}></MapProviderToIcon>
            </Td>
            <Td>{data.emailVerified ? <RxCheck size={24} /> : <RxCross2 size={24} />}</Td>
            <Td key={data.disabled}>{data.disabled ? <RxCheck size={24} /> : <RxCross2 size={24} />}</Td>
            <Td key={data.createdAt}>
              <TypographyMaxWidth ellipsis textColor="neutral800">
                {data.createdAt
                  ? format(new Date(data.createdAt), "yyyy/MM/dd HH:mm z")
                  : data.metadata?.creationTime
                    ? format(new Date(data.metadata.creationTime), "yyyy/MM/dd HH:mm z")
                    : "-"}
              </TypographyMaxWidth>
            </Td>
            <Td key={data.metadata?.lastSignInTime || "lastSignInTime"}>
              <TypographyMaxWidth ellipsis textColor="neutral800">
                {data.metadata?.lastSignInTime
                  ? format(new Date(data.metadata.lastSignInTime), "yyyy/MM/dd HH:mm z")
                  : "-"}
              </TypographyMaxWidth>
            </Td>
            <ActionCell
              onClick={(e: React.MouseEvent<HTMLTableCellElement>) => {
                // CRITICAL: Prevent default AND stop propagation at cell level
                // This prevents browser scroll-into-view from consuming click events
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseDown={(e: React.MouseEvent<HTMLTableCellElement>) => {
                // CRITICAL: Prevent browser scroll-into-view behavior at mousedown level
                // This is the key fix - scroll-into-view triggers on mousedown, not click
                e.preventDefault();
              }}
            >
              <Flex gap={2} justifyContent="center" alignItems="center">
                {/* Password Reset Button with conditional logic */}
                {hasPasswordProvider(data) ? (
                  <Button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      // Critical: Prevent all default behaviors and event propagation
                      e.preventDefault();
                      e.stopPropagation();

                      // Prevent focus from triggering scroll-into-view
                      e.currentTarget.blur();

                      onResetPasswordClick(data);
                    }}
                    variant="secondary"
                    size="S"
                    type="button"
                    tabIndex={-1}
                    style={{
                      display: "inline-flex",
                      justifyContent: "center",
                      alignItems: "center",
                      padding: "0.25rem 0.75rem",
                      minWidth: "5.5rem",
                    }}
                  >
                    <Key aria-hidden style={{ display: "block" }} />
                  </Button>
                ) : (
                  <Tooltip label={getPasswordResetTooltip(data)}>
                    <Box>
                      <Button
                        disabled
                        variant="secondary"
                        size="S"
                        type="button"
                        tabIndex={-1}
                        style={{
                          display: "inline-flex",
                          justifyContent: "center",
                          alignItems: "center",
                          padding: "0.25rem 0.75rem",
                          minWidth: "5.5rem",
                          opacity: 0.5,
                          cursor: "not-allowed",
                        }}
                      >
                        <Key aria-hidden style={{ display: "block" }} />
                      </Button>
                    </Box>
                  </Tooltip>
                )}
                <Button
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    // Critical: Prevent all default behaviors and event propagation
                    e.preventDefault();
                    e.stopPropagation();

                    // Prevent focus from triggering scroll-into-view
                    e.currentTarget.blur();

                    onDeleteAccountClick(data);
                  }}
                  variant="danger-light"
                  size="S"
                  type="button"
                  tabIndex={-1}
                  style={{
                    display: "inline-flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "0.25rem 0.75rem",
                    minWidth: "5.5rem",
                  }}
                >
                  <Trash aria-hidden style={{ display: "block" }} />
                </Button>
              </Flex>
            </ActionCell>
          </Tr>
        );
      })}
    </Tbody>
  );
};
