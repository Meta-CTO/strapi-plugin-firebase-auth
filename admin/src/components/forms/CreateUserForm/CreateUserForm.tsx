import React, { useState, useCallback } from "react";
import { Page, useNotification, Layouts } from "@strapi/strapi/admin";
import { useNavigate } from "react-router-dom";
import { User } from "../../../../../model/User";
import { Header } from "../../common/Header/Header";
import { UserFormFields } from "../shared/UserFormFields/UserFormFields";
import { UserFormLayout } from "../shared/UserFormLayout/UserFormLayout";
import { createUser } from "../../../pages/utils/api";
import { PLUGIN_ID } from "../../../pluginId";
import { useUserForm } from "../../../hooks/useUserForm";

const CreateUserForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toggleNotification } = useNotification();
  const navigate = useNavigate();

  const { userData, emailError, phoneError, hasBeenTouched, handlers, isSubmitDisabled } = useUserForm();

  const createUserHandler = useCallback(async () => {
    setIsLoading(true);
    try {
      const createdUser = await createUser(userData as User);
      if (!createdUser) {
        throw new Error("Error creating user");
      }
      setIsLoading(false);
      toggleNotification({
        type: "success",
        message: "User created successfully",
      });
      // Navigate to user list sorted by creation date (newest first)
      navigate(`/plugins/${PLUGIN_ID}?sort=createdAt:DESC`);
    } catch (error) {
      console.error("Error creating user:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred while creating the user";
      toggleNotification({
        type: "danger",
        message: errorMessage,
      });
      setIsLoading(false);
    }
  }, [userData, toggleNotification, navigate]);

  if (isLoading) {
    return <Page.Loading />;
  }

  return (
    <Page.Main>
      <Header
        title="Create User"
        onSave={createUserHandler}
        isCreatingEntry
        initialData={null}
        modifiedData={userData}
        isLoading={isLoading}
        isSubmitButtonDisabled={isSubmitDisabled}
      />
      <Layouts.Content>
        <UserFormLayout>
          <UserFormFields
            userData={userData}
            onTextInputChange={handlers.onTextInputChange}
            onPhoneChange={handlers.onPhoneChange}
            onToggleInputChange={handlers.onToggleInputChange}
            onEmailBlur={handlers.onEmailBlur}
            emailError={emailError}
            phoneError={phoneError}
            isPasswordRequired={true}
            hasBeenTouched={hasBeenTouched}
          />
        </UserFormLayout>
      </Layouts.Content>
    </Page.Main>
  );
};

export default CreateUserForm;
