import React, { useState } from "react";
import styled from "styled-components";
import { useQueryParams } from "@strapi/strapi/admin";

import { FirebaseTableRows } from "./FirebaseTableRows/FirebaseTableRows";
import { tableHeaders } from "./TableHeaders";
import { User } from "../../../../model/User";
import { Table, Thead, Tr, Th, Typography, Box, Flex, Button, Checkbox } from "@strapi/design-system";
import { Trash, CaretDown, CaretUp } from "@strapi/icons";
import { useBulkSelection } from "../../hooks/useBulkSelection";
import { DeleteAccount } from "../UserManagement/DeleteAccount";

const StyledTableContainer = styled.div`
  width: 100%;
  overflow-x: auto;

  table {
    width: 100%;
  }

  /* Sortable header hover styles */
  th button {
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
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

  &:hover {
    color: ${({ theme }) => theme.colors.primary600};
  }
`;

interface FirebaseTableProps {
  action: React.ReactNode;
  createAction?: React.ReactNode;
  isLoading: boolean;
  rows: User[];
  onConfirmDeleteAll: (idsToDelete: Array<string | number>) => Promise<void>;
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
  const sort = query?.sort ?? '';
  const [sortBy, sortOrder] = sort.split(':');

  const handleBulkDelete = async (isStrapiIncluded: boolean, isFirebaseIncluded: boolean) => {
    // For bulk delete, we use onConfirmDeleteAll which handles both strapi and firebase deletion
    // Note: The existing handleDeleteAll in ListView doesn't support destination parameter,
    // so we ignore isStrapiIncluded and isFirebaseIncluded for now
    await onConfirmDeleteAll(selectedArray);
    clearSelection();
    setShowBulkDeleteDialog(false);
  };

  const handleSelectRow = ({ name, value }: { name: string; value: boolean }) => {
    toggleSelectItem(name);
  };

  const handleSort = (headerName: string) => {
    const isSorted = sortBy === headerName;
    const isAsc = sortOrder === 'ASC';
    setQuery({
      sort: `${headerName}:${isSorted && isAsc ? 'DESC' : 'ASC'}`,
    });
  };

  return (
    <>
      {/* Search and Bulk Actions Bar */}
      <BulkActionsBar paddingLeft={0} paddingRight={0}>
        <Flex direction="row" alignItems="center" justifyContent="space-between">
          <Flex direction="row" alignItems="center" gap={4}>
            {action}
            {hasSelection && (
              <>
                <Typography variant="omega" fontWeight="semiBold">
                  {selectedCount} {selectedCount === 1 ? "entry" : "entries"} selected
                </Typography>
                <Button
                  variant="danger"
                  startIcon={<Trash />}
                  onClick={() => setShowBulkDeleteDialog(true)}
                  size="S"
                >
                  Delete
                </Button>
                <Button variant="secondary" onClick={clearSelection} size="S">
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
                  indeterminate={isIndeterminate}
                  onCheckedChange={toggleSelectAll}
                />
              </Th>
              {tableHeaders.map((header) => {
                const isSorted = sortBy === header.name;
                const isAsc = sortOrder === 'ASC';
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
