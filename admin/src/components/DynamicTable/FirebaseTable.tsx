import React from "react";

import { FirebaseTableRows } from "./FirebaseTableRows/FirebaseTableRows";
import { DeleteAccount } from "../UserManagement/DeleteAccount";
import { tableHeaders } from "./TableHeaders";
import { User } from "../../../../model/User";
import { Table } from "@strapi/design-system";
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
      components={{ ConfirmDialogDeleteAll: DeleteAccount }}
      
      action={action}
      
      headers={tableHeaders}
      rows={rows}
      
      
      footer={null}
    >
      
      <FirebaseTableRows
        onResetPasswordClick={onResetPasswordClick}
        onDeleteAccountClick={onDeleteAccountClick}
        rows={rows}
      />
    </Table>
  );
};
