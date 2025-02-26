import React, { useEffect, useState } from "react";
import { Box, IconButton, Tbody, Td, Tr, Flex, Checkbox, SimpleMenu, MenuItem, Typography } from "@strapi/design-system";
import { useNavigate, useLocation } from "react-router-dom";
import { useIntl } from "react-intl";
import styled from "styled-components";
import { MapProviderToIcon } from "../../../utils/provider";
import { User } from "../../../../../model/User";
import { ArrowDown, Check, Cross } from "@strapi/icons";

const TypographyMaxWidth = styled(Typography)`
  max-width: 300px;
`;

const CellLink = styled(Td)`
  text-decoration: underline;
  color: blue;
  &:hover {
    cursor: pointer;
  }
  & > span {
    color: blue;
  }
`;

interface FirebaseTableRowsProps {
  rows: User[];
  entriesToDelete?: string[];
  onSelectRow?: ({ name, value }: { name: string; value: boolean }) => void;
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
  const [rowsData, setRowsData] = useState<User[]>(rows);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { formatMessage } = useIntl();

  useEffect(() => {
    setRowsData(rows);
  }, [rows]);

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <>
      <Tbody>
        {rowsData.map((data: User) => {
          const isChecked =
            entriesToDelete &&
            entriesToDelete.findIndex((id) => id === data.id) !== -1;

          return (
            <Tr key={data.uid}>
              <Box style={{ paddingLeft: 4, paddingRight: 4 }}>
                <Checkbox
                  aria-label={formatMessage({
                    id: "app.component.table.select.one-entry",
                    defaultMessage: `Select {target}`,
                  })}
                  checked={isChecked}
                  onChange={(e: any) => {
                    onSelectRow &&
                      onSelectRow({ name: data.id, value: e.target.checked });
                  }}
                />
              </Box>
              <Td key={data.email} style={{ padding: 16 }}>
                <TypographyMaxWidth ellipsis textColor="neutral800">
                  {data.email}
                </TypographyMaxWidth>
              </Td>
              <CellLink
                key={data.uid}
                onClick={() => {
                  handleNavigate(`${pathname}/${data.uid}`);
                }}
              >
                <TypographyMaxWidth ellipsis textColor="neutral800">
                  {data.uid}
                </TypographyMaxWidth>
              </CellLink>
              <Td>
                <MapProviderToIcon
                  providerData={data.providerData}
                ></MapProviderToIcon>
              </Td>
              <Td>
                <TypographyMaxWidth ellipsis textColor="neutral800">
                  {data.displayName}
                </TypographyMaxWidth>
              </Td>
              <Td>
                {data.emailVerified ? (
                  <Check  />
                ) : (
                  <Cross />
                )}
              </Td>
              <Td>
                {data.disabled ? <Check /> : <Cross />}
              </Td>
              <CellLink key={data.strapiId}>
                <TypographyMaxWidth ellipsis textColor="neutral800">
                  <Box
                    onClick={() => {
                      handleNavigate(
                        `/content-manager/collectionType/plugin::users-permissions.user/${data.strapiId}`,
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
              <Flex alignItems="center" paddingTop={3} gap={4}>
                <Box key={data.uid}>
                  <SimpleMenu
                    label="Actions"
                    icon={<ArrowDown />}
                  >
                    <MenuItem
                      onClick={() => {
                        onResetPasswordClick(data);
                      }}
                    >
                      Reset Password
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        onDeleteAccountClick(data);
                      }}
                    >
                      Delete Account
                    </MenuItem>
                  </SimpleMenu>
                </Box>
              </Flex>
            </Tr>
          );
        })}
      </Tbody>
    </>
  );
};
