import React, { useState } from "react";
import styled from "styled-components";
import { useQueryParams } from "@strapi/strapi/admin";

import { FirebaseTableRows } from "../FirebaseTableRows/FirebaseTableRows";
import { tableHeaders } from "./TableHeaders";
import { User } from "../../../../../model/User";
import { Table, Thead, Tr, Th, Typography, Box, Flex, Button, Checkbox } from "@strapi/design-system";
import { Trash, CaretDown, CaretUp } from "@strapi/icons";
import { useBulkSelection } from "../../../hooks/useBulkSelection";
import { DeleteAccount } from "../../user-management/DeleteAccount/DeleteAccount";

const StyledTableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  border-radius: ${({ theme }) => theme.borderRadius};

  table {
    width: 100%;
    min-width: max-content; /* Allow table to expand naturally */

    /* Prevent layout shifts during interaction */
    contain: layout style;
  }

  /* Prevent browser scroll-into-view behavior on button clicks */
  td {
    scroll-margin: 0;
    scroll-snap-margin: 0;
  }

  /* Ensure buttons are always clickable */
  button {
    scroll-margin: 0;
    scroll-snap-margin: 0;
    touch-action: manipulation;
  }

  /* Sortable header hover styles */
  th button {
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  /* Icon button in sorted column */
  th button[aria-label*="Sort"] {
    cursor: pointer;
  }
`;

const BulkActionsBar = styled(Box)`
  margin-bottom: 16px;
  padding: 12px 0;
`;

const SortButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-align: left;
  width: 100%;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
`;

interface FirebaseTableProps {
  action: React.ReactNode;
  createAction?: React.ReactNode;
  isLoading: boolean;
  rows: User[];
  onConfirmDeleteAll: (idsToDelete: Array<string | number>, destination: string | null) => Promise<void>;
  onResetPasswordClick: (data: User) => void;
  onDeleteAccountClick: (data: User) => void;
}

export const FirebaseTable = ({
  action,
  createAction,
  rows,
  onConfirmDeleteAll,
  onResetPasswordClick,
  onDeleteAccountClick,
}: FirebaseTableProps) => {
  // Removed debug logging - handlers are now stable with useCallback in parent

  const {
    toggleSelectAll,
    toggleSelectItem,
    clearSelection,
    isAllSelected,
    isIndeterminate,
    hasSelection,
    selectedCount,
    selectedArray,
  } = useBulkSelection(rows);

  const [{ query }, setQuery] = useQueryParams<{ sort?: string }>();
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Parse sort from query params
  const sort = query?.sort ?? "";
  const [sortBy, sortOrder] = sort.split(":");

  const handleBulkDelete = async (isStrapiIncluded: boolean, isFirebaseIncluded: boolean) => {
    // Determine destination based on checkbox selections
    let destination: string | null = null;

    if (isStrapiIncluded && isFirebaseIncluded) {
      destination = null; // Delete from both Firebase and Strapi
    } else if (isStrapiIncluded) {
      destination = "strapi"; // Delete from Strapi only
    } else if (isFirebaseIncluded) {
      destination = "firebase"; // Delete from Firebase only
    }

    await onConfirmDeleteAll(selectedArray, destination);
    clearSelection();
    setShowBulkDeleteDialog(false);
  };

  const handleSelectRow = ({ name, value }: { name: string; value: boolean }) => {
    toggleSelectItem(name);
  };

  const handleSort = (headerName: string) => {
    const isSorted = sortBy === headerName;
    const isAsc = sortOrder === "ASC";
    setQuery({
      sort: `${headerName}:${isSorted && isAsc ? "DESC" : "ASC"}`,
    });
  };

  return (
    <>
      {/* Search and Bulk Actions Bar */}
      <BulkActionsBar paddingLeft={0} paddingRight={0}>
        <Flex direction="row" alignItems="center" justifyContent="space-between" wrap="nowrap">
          <Flex direction="row" alignItems="center" gap={2} wrap="nowrap">
            {action}
            {hasSelection && (
              <>
                <Typography variant="omega" fontWeight="semiBold" style={{ whiteSpace: "nowrap" }}>
                  {selectedCount} {selectedCount === 1 ? "entry" : "entries"} selected
                </Typography>
                <Button
                  variant="danger"
                  startIcon={<Trash />}
                  onClick={() => setShowBulkDeleteDialog(true)}
                  size="S"
                  style={{ whiteSpace: "nowrap" }}
                >
                  Delete
                </Button>
                <Button
                  variant="secondary"
                  onClick={clearSelection}
                  size="S"
                  style={{ whiteSpace: "nowrap" }}
                >
                  Deselect all
                </Button>
              </>
            )}
          </Flex>
          {createAction}
        </Flex>
      </BulkActionsBar>

      <StyledTableContainer>
        <Table colCount={tableHeaders.length + 2} rowCount={rows.length + 1}>
          <Thead>
            <Tr>
              <Th>
                <Checkbox
                  aria-label="Select all entries"
                  checked={isAllSelected}
                  indeterminate={isIndeterminate ? true : undefined}
                  onCheckedChange={toggleSelectAll}
                />
              </Th>
              {tableHeaders.map((header) => {
                const isSorted = sortBy === header.name;
                const isAsc = sortOrder === "ASC";
                const isSortable = header.metadatas.sortable;

                return (
                  <Th key={header.key}>
                    {isSortable ? (
                      <SortButton
                        onClick={() => handleSort(header.name)}
                        aria-label={`Sort by ${header.metadatas.label}`}
                      >
                        <Typography variant="sigma" textColor="neutral600">
                          {header.metadatas.label}
                        </Typography>
                        {isSorted && (
                          <>
                            {isAsc ? (
                              <CaretUp width="10px" height="10px" />
                            ) : (
                              <CaretDown width="10px" height="10px" />
                            )}
                          </>
                        )}
                      </SortButton>
                    ) : (
                      <Typography variant="sigma" textColor="neutral600">
                        {header.metadatas.label}
                      </Typography>
                    )}
                  </Th>
                );
              })}
              <Th>
                <Typography variant="sigma" textColor="neutral600">
                  Actions
                </Typography>
              </Th>
            </Tr>
          </Thead>
          <FirebaseTableRows
            onResetPasswordClick={onResetPasswordClick}
            onDeleteAccountClick={onDeleteAccountClick}
            rows={rows}
            entriesToDelete={selectedArray}
            onSelectRow={handleSelectRow}
          />
        </Table>
      </StyledTableContainer>

      {/* Bulk Delete Confirmation Dialog */}
      <DeleteAccount
        isOpen={showBulkDeleteDialog}
        onToggleDialog={() => setShowBulkDeleteDialog(false)}
        onConfirm={handleBulkDelete}
        email="" // Not needed for bulk delete
        isSingleRecord={false}
      />
    </>
  );
};
