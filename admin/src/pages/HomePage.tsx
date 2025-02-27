import React, { useState, useEffect } from "react";

import { Page } from '@strapi/strapi/admin';
import { useNotification } from '@strapi/strapi/admin';


import { Layout } from "@strapi/design-system";
import { Main } from "@strapi/design-system";
import { Box } from "@strapi/design-system";
import {
  Grid,
  GridItem,
  Typography,
  Button,
  Flex,
} from "@strapi/design-system";
import { useQuery } from "react-query";
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
  const [isLoadingConfiguration, setIsLoadingConfiguration] = useState(true);

  const navigate = useNavigate();

  const handleRetrieveFirebaseJsonConfig = () => {
    getFirebaseConfig()
      .then(() => {
        setIsNotConfigured(false);
        setIsLoadingConfiguration(false);
      })
      .catch((err) => {
        setIsNotConfigured(true);
        setIsLoadingConfiguration(false);
      });
  };

  useEffect(() => {
    handleRetrieveFirebaseJsonConfig();
  }, []);

  const { isLoading } = useQuery("firebase-auth-", () => fetchUsers(), {
    onSuccess: (result) => {
      setUsersData(result);
    },

    onError: (err: any) => {
      toggleNotification({
        type: "warning",
        message: "An error occured",
      });
    },
    enabled: !isLoadingConfiguration && !isNotConfigured,
  });

  if (isLoading || isLoadingConfiguration) {
    return <Page.Loading />;
  }

  return (
    <Layout>
      
      <Main>
        <Box padding={10}>
          {!isNotConfigured ? (
            <Grid gap={4}>
              <GridItem col={12} s={12}>
                <ListView data={usersData.data} meta={usersData.meta} />
              </GridItem>
            </Grid>
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
      </Main>
    </Layout>
  );
};
