import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Page, useNotification } from "@strapi/strapi/admin";
import { EditForm } from "../components/EditForm";
import { fetchUserByID } from "./utils/api";
import { User } from "../../../model/User";

export const EditView = () => {
  const { id } = useParams<{ id: string }>();
  const { toggleNotification } = useNotification();
  const [userData, setUserData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        if (!id) {
          throw new Error("User ID is required");
        }
        const user = await fetchUserByID(id);
        if (!user) {
          throw new Error("User not found");
        }
        setUserData(user);
      } catch (error: any) {
        console.error("Error fetching user:", error);
        toggleNotification({
          type: "danger",
          message: error?.message || "An error occurred while fetching user data",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [id]);

  if (isLoading) {
    return <Page.Loading />;
  }

  if (!userData) {
    return <Page.Error />;
  }

  return <EditForm data={userData} />;
};
