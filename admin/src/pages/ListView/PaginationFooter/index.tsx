import React from "react";
import { Box, Typography } from "@strapi/design-system";
import { Flex } from "@strapi/design-system";
import { SingleSelect, SingleSelectOption } from "@strapi/design-system";

import { Pagination, useQueryParams } from "@strapi/strapi/admin";

interface PaginationFooter {
  pageCount?: number;
}

export const PaginationFooter = ({ pageCount = 0 }: PaginationFooter) => {
  const [{ query }, setQuery] = useQueryParams();
  const pageSize = (query as any)?.pageSize || '10';

  const handlePageSizeChange = (value: string) => {
    setQuery({ pageSize: value, page: 1 });
  };

  return (
    <Box paddingTop={4}>
      <Flex alignItems="center" justifyContent="space-between">
        <Flex alignItems="center" gap={2}>
          <Typography variant="pi" textColor="neutral600">
            Entries per page:
          </Typography>
          <SingleSelect
            size="S"
            value={pageSize}
            onChange={handlePageSizeChange}
            aria-label="Entries per page"
          >
            <SingleSelectOption value="10">10</SingleSelectOption>
            <SingleSelectOption value="25">25</SingleSelectOption>
            <SingleSelectOption value="50">50</SingleSelectOption>
            <SingleSelectOption value="100">100</SingleSelectOption>
          </SingleSelect>
        </Flex>
        <Pagination.Root pageCount={pageCount}>
          <Pagination.Links />
        </Pagination.Root>
      </Flex>
    </Box>
  );
};
