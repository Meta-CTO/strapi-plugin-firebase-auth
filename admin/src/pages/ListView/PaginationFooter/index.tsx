import React from "react";
import { Box } from "@strapi/design-system";
import { Flex } from "@strapi/design-system";

import { Pagination } from '@strapi/strapi/admin';

interface PaginationFooter {
  pageCount?: number;
}

export const PaginationFooter = ({ pageCount = 0 }: PaginationFooter) => {
  return (
    <Box paddingTop={4}>
      <Flex alignItems="flex-end" justifyContent="space-between">
        
      <Pagination.Root pageCount={2}>
          <Pagination.Links />
        </Pagination.Root>
      </Flex>
    </Box>
  );
};
