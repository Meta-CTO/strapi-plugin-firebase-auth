import React from "react";
import styled from "styled-components";

import { FirebaseTableRows } from "./FirebaseTableRows/FirebaseTableRows";
import { tableHeaders } from "./TableHeaders";
import { User } from "../../../../model/User";
import { Table, Thead, Tr, Th, Typography } from "@strapi/design-system";

const StyledTableContainer = styled.div`
  width: 100%;

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

interface FirebaseTableProps {
  action: React.ReactNode;
  isLoading: boolean;
  rows: User[];
  onConfirmDeleteAll: (idsToDelete: Array<string | number>) => Promise<void>;
  onResetPasswordClick: (data: User) => void;
  onDeleteAccountClick: (data: User) => void;
}

export const FirebaseTable = ({ rows, onResetPasswordClick, onDeleteAccountClick }: FirebaseTableProps) => {
  return (
    <StyledTableContainer>
      <Table colCount={tableHeaders.length + 2} rowCount={rows.length + 1}>
        <Thead>
          <Tr>
            <Th>
              <Typography variant="sigma" textColor="neutral600"></Typography>
            </Th>
            {tableHeaders.map((header) => (
              <Th key={header.key}>
                <Typography variant="sigma" textColor="neutral600">
                  {header.metadatas.label}
                </Typography>
              </Th>
            ))}
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
        />
      </Table>
    </StyledTableContainer>
  );
};
