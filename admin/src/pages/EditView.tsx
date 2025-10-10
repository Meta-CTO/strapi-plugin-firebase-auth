import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Page, useNotification } from "@strapi/strapi/admin";
import { EditUserForm } from "../components/forms";
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
      } catch (error) {
        console.error("Error fetching user:", error);
        const errorMessage = error instanceof Error ? error.message : "An error occurred while fetching user data";
        toggleNotification({
          type: "danger",
          message: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [id, toggleNotification]);

  if (isLoading) {
    return <Page.Loading />;
  }

  if (!userData) {
    return <Page.Error />;
  }

  return <EditUserForm data={userData} />;
};
