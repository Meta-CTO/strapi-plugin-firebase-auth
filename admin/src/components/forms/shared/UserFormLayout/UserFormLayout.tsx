import React from "react";
import { Box, Flex } from "@strapi/design-system";

interface UserFormLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

export const UserFormLayout = ({ children, sidebar }: UserFormLayoutProps) => {
  return (
    <Flex direction="row" alignItems="stretch" gap={4} width="100%">
      <Box
        background="neutral0"
        borderColor="neutral150"
        hasRadius
        padding={8}
        shadow="tableShadow"
        style={{ flex: "9 1 0px", minWidth: 0 }}
      >
        <Flex direction="column" gap={4} alignItems="stretch">
          {children}
        </Flex>
      </Box>

      {sidebar && (
        <Flex
          direction="column"
          gap={4}
          style={{ flex: "3 1 0px", minWidth: "280px", maxWidth: "380px", alignItems: "stretch" }}
        >
          {sidebar}
        </Flex>
      )}
    </Flex>
  );
};
