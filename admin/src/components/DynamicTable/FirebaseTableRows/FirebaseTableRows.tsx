import React, { useEffect, useState } from "react";
import { Box } from "@strapi/design-system";

import { Tbody, Td, Tr } from "@strapi/design-system";
import { Flex } from "@strapi/design-system";
import { useNavigate, useLocation } from "react-router-dom";
import { useIntl } from "react-intl";
import { Checkbox } from "@strapi/design-system";
import { SimpleMenu, MenuItem } from "@strapi/design-system";
import { ArrowDown } from "@strapi/icons";
import { RxCross2, RxCheck } from "react-icons/rx";
import { Typography } from "@strapi/design-system";
import styled from "styled-components";
import { MapProviderToIcon } from "../../../utils/provider";
import { User } from "../../../../../model/User";
import { Thead } from "@strapi/design-system";
import { Th } from "@strapi/design-system";
import { tableHeaders } from "../TableHeaders";
import { Key, Trash } from "@strapi/icons";
import { Button } from "@strapi/design-system";
import { IconButton, IconButtonGroup } from "@strapi/design-system";

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
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setRowsData(rows);
  }, [rows]);

  return (
    <>
      <Thead>
        <Tr>
          <Th></Th>
          {tableHeaders.map((header) => (
            <Th key={header.name}>{header.name}</Th>
          ))}
          <Th>Actions</Th>
        </Tr>
      </Thead>

      <Tbody>
        {rowsData.map((data: User) => {
          const isChecked = entriesToDelete && entriesToDelete.findIndex((id) => id === data.id) !== -1;

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
                    onChange={(e: any) => {
                      onSelectRow && onSelectRow({ name: data.id, value: e.target.checked });
                    }}
                  />
                </Flex>
              </Td>
              <Td key={data.email} style={{ padding: 16 }}>
                <TypographyMaxWidth ellipsis textColor="neutral800">
                  {data.email}
                </TypographyMaxWidth>
              </Td>
              <CellLink
                key={data.uid}
                onClick={() => {
                  navigate(`${location.pathname}/${data.uid}`, {
                    state: { from: location.pathname, strapiId: data.strapiId },
                  });
                }}
              >
                <TypographyMaxWidth ellipsis textColor="neutral800">
                  {data.uid}
                </TypographyMaxWidth>
              </CellLink>
              <Td>
                <MapProviderToIcon providerData={data.providerData}></MapProviderToIcon>
              </Td>
              <Td>
                <TypographyMaxWidth ellipsis textColor="neutral800">
                  {data.displayName}
                </TypographyMaxWidth>
              </Td>
              <Td>{data.emailVerified ? <RxCheck size={24} /> : <RxCross2 size={24} />}</Td>
              <Td key={data.disabled}>{data.disabled ? <RxCheck size={24} /> : <RxCross2 size={24} />}</Td>
              <CellLink key={data.strapiId}>
                <TypographyMaxWidth ellipsis textColor="neutral800">
                  <Box
                    onClick={() => {
                      navigate(
                        `/content-manager/collectionType/plugin::users-permissions.user/${data.strapiId}`,
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
                <Flex gap={2}>
                  <Button
                    onClick={() => onResetPasswordClick(data)}
                    startIcon={<Key aria-hidden />}
                    variant="secondary"
                    size="S"
                  ></Button>
                  <Button
                    onClick={() => onDeleteAccountClick(data)}
                    startIcon={<Trash aria-hidden />}
                    variant="danger-light"
                    size="S"
                  ></Button>
                </Flex>
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </>
  );
};
