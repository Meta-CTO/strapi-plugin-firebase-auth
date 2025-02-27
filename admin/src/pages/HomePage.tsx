import React, { useState, useEffect } from "react";
import { Page, Layouts } from '@strapi/strapi/admin';
import { useNotification } from '@strapi/strapi/admin';
import { Box, Typography, Button, Flex } from "@strapi/design-system";
import { fetchUsers } from "./utils/api";
import ListView from "./ListView";
import { User } from "../../../model/User";
import { ResponseMeta } from "../../../model/Meta";
import { WarningCircle } from "@strapi/icons";
import { useNavigate } from "react-router-dom";
import { getFirebaseConfig } from "../pages/Settings/api";

const INITIAL_USERS_DATA = {
  data: [],
  meta: { pagination: { page: 0, pageCount: 0, pageSize: 0, total: 0 } },
};

export const HomePage = () => {
  const { toggleNotification } = useNotification();
  const [usersData, setUsersData] = useState<{
    data: User[];
    meta: ResponseMeta;
  }>(INITIAL_USERS_DATA);
  const [isNotConfigured, setIsNotConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        await getFirebaseConfig();
        setIsNotConfigured(false);
        const result = await fetchUsers();
        setUsersData(result);
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
  }, []);

  if (isLoading) {
    return <Page.Loading />;
  }

  return (
    <Page.Main>
      <Page.Title>Firebase Users</Page.Title>
      <Layouts.Header
        id="title"
        title="Firebase Users"
        
      />
      <Box padding={10}>
        {!isNotConfigured ? (
          <Flex direction="column" alignItems="stretch" gap={4}>
            <ListView data={usersData.data} meta={usersData.meta} />
          </Flex>
        ) : (
          <Flex direction="column" marginTop={10}>
            <WarningCircle />
            <Box marginTop={1}>
              <Typography>
                Firebase is not configured, please configure Firebase
              </Typography>
            </Box>
            <Button
              marginTop={3}
              onClick={() => {
                navigate("/settings/firebase-auth");
              }}
            >
              Configure firebase
            </Button>
          </Flex>
        )}
      </Box>
    </Page.Main>
  );
};
