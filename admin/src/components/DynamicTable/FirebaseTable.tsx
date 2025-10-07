import React from "react";
import styled from "styled-components";

import { FirebaseTableRows } from "./FirebaseTableRows/FirebaseTableRows";
import { DeleteAccount } from "../UserManagement/DeleteAccount";
import { tableHeaders } from "./TableHeaders";
import { User } from "../../../../model/User";
import { Table } from "@strapi/strapi/admin";

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

export const FirebaseTable = ({
  action,
  isLoading,
  rows,
  onConfirmDeleteAll,
  onResetPasswordClick,
  onDeleteAccountClick,
}: FirebaseTableProps) => {
  return (
    <StyledTableContainer>
      <Table.Root rows={rows} isLoading={isLoading}>
        <Table.Content>
          <Table.Head>
            <Table.HeaderCell name="" label="" sortable={false} />
            {tableHeaders.map((header) => (
              <Table.HeaderCell
                key={header.key}
                name={header.name}
                label={header.metadatas.label}
                sortable={header.metadatas.sortable}
              />
            ))}
            <Table.HeaderCell name="actions" label="Actions" sortable={false} />
          </Table.Head>
          <FirebaseTableRows
            onResetPasswordClick={onResetPasswordClick}
            onDeleteAccountClick={onDeleteAccountClick}
            rows={rows}
          />
        </Table.Content>
      </Table.Root>
    </StyledTableContainer>
  );
};
