import React, { useState, useEffect } from "react";
import { Page } from "@strapi/strapi/admin";
import { useNotification } from "@strapi/strapi/admin";
import { Box, Typography, Button, Flex } from "@strapi/design-system";
import ListView from "./ListView";
import { WarningCircle } from "@strapi/icons";
import { useNavigate } from "react-router-dom";
import { getFirebaseConfig } from "../pages/Settings/api";
import styled from "styled-components";

const StyledPageMain = styled(Page.Main)`
  overflow-x: hidden;
  max-width: 100vw;
`;

const ContentContainer = styled.div`
  padding-right: 70px;
  width: 100%;
`;

export const HomePage = () => {
  const { toggleNotification } = useNotification();
  const [isNotConfigured, setIsNotConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const config = await getFirebaseConfig();

        // Check if Firebase is actually configured (not just returning null/undefined)
        if (!config || !config.firebaseConfigJson) {
          setIsNotConfigured(true);
          setIsLoading(false);
          return;
        }

        setIsNotConfigured(false);
        // Don't fetch users here - let ListView handle it
        // const result = await fetchUsers();
        // setUsersData(result);
      } catch (err) {
        setIsNotConfigured(true);
        toggleNotification({
          type: "warning",
          message: "An error occurred",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [toggleNotification]);

  if (isLoading) {
    return <Page.Loading />;
  }

  return (
    <StyledPageMain>
      <Page.Title>Firebase Users</Page.Title>
      {!isNotConfigured ? (
        <ContentContainer>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <ListView />
          </Flex>
        </ContentContainer>
      ) : (
        <Flex direction="column" marginTop={10}>
          <WarningCircle />
          <Box marginTop={1}>
            <Typography>Firebase is not configured, please configure Firebase</Typography>
          </Box>
          <Button
            marginTop={3}
            onClick={() => {
              navigate("/settings/firebase-authentication");
            }}
          >
            Configure firebase
          </Button>
        </Flex>
      )}
    </StyledPageMain>
  );
};
