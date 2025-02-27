import React from "react";
import { 
  Table,
  Thead,
  Tbody,
  Tr,
  Td,
  Th 
} from '@strapi/design-system';
import { FirebaseTableRows } from "./FirebaseTableRows/FirebaseTableRows";
import { DeleteAccount } from "../UserManagement/DeleteAccount";
import { tableHeaders } from "./TableHeaders";
import { User } from "../../../../model/User";

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
    <Table 
      colCount={tableHeaders.length}
      rowCount={rows.length}
    >
      <Thead>
        <Tr>
          {tableHeaders.map((header) => (
            <Th key={header.name}>{header.name}</Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        <FirebaseTableRows
          onResetPasswordClick={onResetPasswordClick}
          onDeleteAccountClick={onDeleteAccountClick}
          rows={rows}
        />
      </Tbody>
    </Table>
  );
};
