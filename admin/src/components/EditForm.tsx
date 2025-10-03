import React, { useState } from "react";
import {
  Box,
  TextInput,
  Typography,
  Flex,
  Link,
  Toggle,
  Divider,
  Field,
  Main,
} from "@strapi/design-system";
import { useNotification, Page, Layouts } from "@strapi/strapi/admin";
import { Pencil } from "@strapi/icons";
import { format } from "date-fns";
import styled from "styled-components";
import { useNavigate, useLocation } from "react-router-dom";
import { User, ProviderItem } from "../../../model/User";
import { Header } from "./Header";
import { updateUser } from "../pages/utils/api";

const MetaWrapper = styled(Box)`
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  font-size: 18px;
  padding: 5px;
`;

const ContentWrapper = styled(Box)`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 18px;
  padding: 5px;
`;

const DetailsButtonWrapper = styled(Box)`
  width: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 5px;
`;

interface EditFormProps {
  data: User;
}

export const EditForm = ({ data }: EditFormProps) => {
  const [userData, setUserData] = useState<User>(data);
  const [originalUserData] = useState(data);
  const [isLoading, setIsLoading] = useState(false);

  const { toggleNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as any;

  const onTextInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.value,
    }));
  };

  const onToggleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.checked,
    }));
  };

  const updateUserHandler = async () => {
    setIsLoading(true);
    try {
      const updatedUser = await updateUser(userData.uid, userData);
      if (updatedUser[0]?.status === "rejected") {
        throw new Error("Error updating user");
      }
      setUserData(updatedUser[0].value);
      setIsLoading(false);
      toggleNotification({
        type: "success",
        message: "User updated successfully",
      });
    } catch (error) {
      toggleNotification({
        type: "danger",
        message: "An error occurred while updating the user",
      });
      setIsLoading(false);
      setUserData(data);
    }
  };

  if (isLoading) {
    return <Page.Loading />;
  }

  return (
    <Main>
      <Header
        title="Edit User"
        onSave={updateUserHandler}
        initialData={originalUserData}
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
          style={{ alignItems: "stretch" }}
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
                  />
                  {userData?.password?.length && userData?.password?.length < 6 && (
                    <Field.Error>Password must be at least 6 characters</Field.Error>
                  )}
                  <Field.Hint>Leave empty to keep current password</Field.Hint>
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

          <Flex
            direction="column"
            gap={4}
            style={{ flex: "3 1 0px", minWidth: "280px", maxWidth: "380px", alignItems: "stretch" }}
          >
            <Box
              as="aside"
              background="neutral0"
              borderColor="neutral150"
              hasRadius
              paddingBottom={2}
              paddingLeft={4}
              paddingRight={4}
              paddingTop={2}
              shadow="tableShadow"
            >
              {userData.providerData?.map((provider: ProviderItem, index: number) => (
                <Flex
                  key={index}
                  paddingTop={2}
                  paddingBottom={2}
                  direction="column"
                  alignItems="flex-start"
                  gap={2}
                >
                  <Flex gap={1}>
                    <Typography variant="sigma" textColor="neutral600">
                      Provider Id:
                    </Typography>
                    <Typography variant="sigma" textColor="neutral600">
                      {provider.providerId}
                    </Typography>
                  </Flex>
                  <Flex gap={1}>
                    <Typography variant="sigma" textColor="neutral600">
                      UID:
                    </Typography>
                    <Typography variant="sigma" textColor="neutral600">
                      {provider.uid}
                    </Typography>
                  </Flex>
                  {locationState?.strapiId && (
                    <Flex gap={1}>
                      <Typography variant="sigma" textColor="neutral600">
                        Strapi ID:
                      </Typography>
                      <Link
                        onClick={() => {
                          navigate(
                            `/content-manager/collectionType/plugin::users-permissions.user/${locationState.strapiId}`
                          );
                        }}
                        style={{ cursor: "pointer", color: "blue", textDecoration: "underline" }}
                      >
                        <Typography variant="sigma">
                          {locationState.strapiId}
                        </Typography>
                      </Link>
                    </Flex>
                  )}
                </Flex>
              ))}
              <Divider />
              <Flex paddingTop={2} paddingBottom={2} direction="column" alignItems="flex-start">
                {userData.metadata?.lastSignInTime && (
                  <MetaWrapper>
                    <Typography variant="sigma" textColor="neutral600">
                      Last Sign In Time
                    </Typography>
                    <Typography variant="sigma" textColor="neutral600">
                      {format(new Date(userData.metadata.lastSignInTime), "yyyy/MM/dd kk:mm")}
                    </Typography>
                  </MetaWrapper>
                )}
                {(userData.metadata?.creationTime || userData.createdAt) && (
                  <MetaWrapper>
                    <Typography variant="sigma" textColor="neutral600">
                      Creation Time
                    </Typography>
                    <Typography variant="sigma" textColor="neutral600">
                      {userData.metadata?.creationTime
                        ? format(new Date(userData.metadata.creationTime), "yyyy/MM/dd kk:mm")
                        : userData.createdAt
                        ? format(new Date(userData.createdAt), "yyyy/MM/dd kk:mm")
                        : "-"}
                    </Typography>
                  </MetaWrapper>
                )}
              </Flex>
            </Box>

            <Box marginTop={5} marginBottom={5} />
            {userData.localUser && (
              <Box
                as="aside"
                background="neutral0"
                borderColor="neutral150"
                hasRadius
                paddingBottom={1}
                paddingLeft={2}
                paddingRight={2}
                paddingTop={1}
                shadow="tableShadow"
              >
                <Box paddingTop={2} paddingBottom={2}>
                  <DetailsButtonWrapper>
                    <Link
                      startIcon={<Pencil />}
                      onClick={() =>
                        navigate(
                          `/content-manager/collectionType/plugin::users-permissions.user/${userData.localUser?.id}`
                        )
                      }
                      style={{ cursor: "pointer" }}
                    >
                      Details
                    </Link>
                  </DetailsButtonWrapper>
                  <ContentWrapper>
                    <Typography variant="sigma" textColor="neutral600">
                      local user:
                    </Typography>
                    <Typography variant="sigma" textColor="neutral600">
                      {userData.localUser.username}
                    </Typography>
                  </ContentWrapper>
                </Box>
              </Box>
            )}
          </Flex>
        </Flex>
      </Layouts.Content>
    </Main>
  );
};
