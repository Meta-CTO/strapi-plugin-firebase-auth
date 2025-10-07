import React, { useState, useCallback } from "react";
import { Box, TextInput, Flex, Toggle, Field } from "@strapi/design-system";
import { Page, useNotification, Layouts } from "@strapi/strapi/admin";
import { useNavigate } from "react-router-dom";
import { User } from "../../../model/User";
import { Header } from "../components/Header";
import { createUser } from "./utils/api";
import { PLUGIN_ID } from "../pluginId";

export const CreateView = () => {
  const [userData, setUserData] = useState<Partial<User>>({});
  const [isLoading, setIsLoading] = useState(false);

  const { toggleNotification } = useNotification();
  const navigate = useNavigate();

  const onTextInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUserData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.value,
    }));
  }, []);

  const onToggleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUserData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.checked,
    }));
  }, []);

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
      // Navigate to edit page after creation
      navigate(`/plugins/${PLUGIN_ID}/${createdUser.uid}`);
    } catch (error) {
      console.error("Error creating user:", error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred while creating the user";
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
        isSubmitButtonDisabled={
          (!userData?.email && !userData?.phoneNumber) ||
          !!(userData?.password?.length && userData?.password?.length < 6)
        }
      />
      <Layouts.Content>
        <Flex
          direction="row"
          alignItems="stretch"
          gap={4}
          width="100%"
        >
          <Box
            background="neutral0"
            borderColor="neutral150"
            hasRadius
            padding={8}
            shadow="tableShadow"
            style={{ flex: "9 1 0px", minWidth: 0 }}
          >
            <Flex direction="column" gap={4} alignItems="stretch">
                <Field.Root style={{ width: "100%" }}>
                  <Field.Label>Email</Field.Label>
                  <TextInput
                    id="email"
                    name="email"
                    autoComplete="new-password"
                    onChange={onTextInputChange}
                    value={userData.email || ""}
                  />
                  {!userData?.email && !userData?.phoneNumber && (
                    <Field.Error>Email or Phone Number is required</Field.Error>
                  )}
                </Field.Root>
                <Field.Root style={{ width: "100%" }}>
                  <Field.Label>Display Name</Field.Label>
                  <TextInput
                    id="displayName"
                    name="displayName"
                    autoComplete="new-password"
                    onChange={onTextInputChange}
                    value={userData.displayName || ""}
                  />
                </Field.Root>
                <Field.Root style={{ width: "100%" }}>
                  <Field.Label>Phone Number</Field.Label>
                  <TextInput
                    id="phoneNumber"
                    name="phoneNumber"
                    autoComplete="new-password"
                    onChange={onTextInputChange}
                    value={userData.phoneNumber || ""}
                  />
                </Field.Root>
                <Field.Root style={{ width: "100%" }}>
                  <Field.Label>Password</Field.Label>
                  <TextInput
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    onChange={onTextInputChange}
                    value={userData.password || ""}
                    required
                  />
                  {userData?.password?.length && userData?.password?.length < 6 && (
                    <Field.Error>Password must be at least 6 characters</Field.Error>
                  )}
                </Field.Root>
                <Field.Root maxWidth="320px">
                  <Field.Label>Disabled</Field.Label>
                  <Toggle
                    name="disabled"
                    onLabel="True"
                    offLabel="False"
                    checked={Boolean(userData.disabled)}
                    onChange={onToggleInputChange}
                  />
                </Field.Root>
                <Field.Root maxWidth="320px">
                  <Field.Label>Email Verified</Field.Label>
                  <Toggle
                    name="emailVerified"
                    onLabel="True"
                    offLabel="False"
                    checked={Boolean(userData.emailVerified)}
                    onChange={onToggleInputChange}
                  />
                </Field.Root>
            </Flex>
          </Box>
        </Flex>
      </Layouts.Content>
    </Page.Main>
  );
};
