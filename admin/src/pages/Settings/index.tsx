import React from "react";
import { Box, Flex, Typography } from "@strapi/design-system";

function SettingsPage() {
  return (
    <Box background="neutral100" padding={8}>
      <Flex direction="column" gap={4}>
        <Typography variant="alpha">Firebase Auth</Typography>
        <Typography variant="epsilon">Configure your Firebase connection</Typography>
      </Flex>
    </Box>
  );
}

export default SettingsPage;
