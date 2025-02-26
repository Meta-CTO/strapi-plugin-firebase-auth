import React from "react";
import { Helmet } from "react-helmet";
import { Layout } from "@strapi/design-system";
import { useParams } from "react-router-dom";
import { fetchUserByID } from "../HomePage/utils/api";
import { useQuery } from "react-query";
import { useNotification } from '@strapi/strapi/admin';
import { Page } from '@strapi/strapi/admin';
import { EditForm } from "./EditForm";

export const EditView = () => {
  const { id } = useParams<{ id: string }>();
  const { toggleNotification } = useNotification();
  const { status, data } = useQuery(
    `firebase-auth-${id}`,
    () => fetchUserByID(id),
    {
      onError: () => {
        toggleNotification({
          type: "warning",
          message: "An error occurred"
        });
      },
    }
  );

  const isLoadingUsersData = status !== "success" && status !== "error";

  if (isLoadingUsersData) {
    return <Page.Loading />;
  }

  return (
    <Layout>
      <Helmet title="Firebase User" />
      <EditForm data={data} />
    </Layout>
  );
};
