import React, { useState, useCallback } from "react";
import {
  Box,
  Typography,
  Flex,
  Link,
  Divider,
} from "@strapi/design-system";
import { useNotification, Page, Layouts } from "@strapi/strapi/admin";
import { Pencil } from "@strapi/icons";
import { format } from "date-fns";
import styled from "styled-components";
import { useNavigate, useLocation } from "react-router-dom";
import { User, ProviderItem } from "../../../../../model/User";
import { Header } from "../../common/Header/Header";
import { UserFormFields } from "../shared/UserFormFields/UserFormFields";
import { UserFormLayout } from "../shared/UserFormLayout/UserFormLayout";
import { updateUser } from "../../../pages/utils/api";
import { useUserForm } from "../../../hooks/useUserForm";

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

interface LocationState {
  strapiId?: string | number;
}

const EditUserForm = ({ data }: EditFormProps) => {
  const [originalUserData] = useState(data);
  const [isLoading, setIsLoading] = useState(false);

  const { toggleNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as LocationState) || {};

  const {
    userData,
    setUserData,
    emailError,
    phoneError,
    handlers,
    isSubmitDisabled
  } = useUserForm(data);

  const updateUserHandler = useCallback(async () => {
    setIsLoading(true);
    try {
      const updatedUser = await updateUser(userData.uid as string, userData as User);
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
      console.error("Error updating user:", error);
      toggleNotification({
        type: "danger",
        message: "An error occurred while updating the user",
      });
      setIsLoading(false);
      setUserData(data);
    }
  }, [userData, toggleNotification, data]);

  if (isLoading) {
    return <Page.Loading />;
  }

  return (
    <Page.Main>
      <Header
        title="Edit User"
        onSave={updateUserHandler}
        initialData={originalUserData}
        modifiedData={userData}
        isLoading={isLoading}
        isSubmitButtonDisabled={isSubmitDisabled}
      />
      <Layouts.Content>
        <UserFormLayout
          sidebar={
            <>
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
                            `/content-manager/collection-types/plugin::users-permissions.user/${locationState.strapiId}`
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
                      {format(new Date(userData.metadata.lastSignInTime), "yyyy/MM/dd HH:mm z")}
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
                        ? format(new Date(userData.metadata.creationTime), "yyyy/MM/dd HH:mm z")
                        : userData.createdAt
                        ? format(new Date(userData.createdAt), "yyyy/MM/dd HH:mm z")
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
                          `/content-manager/collection-types/plugin::users-permissions.user/${userData.localUser?.id}`
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
            </>
          }
        >
          <UserFormFields
            userData={userData}
            onTextInputChange={handlers.onTextInputChange}
            onPhoneChange={handlers.onPhoneChange}
            onToggleInputChange={handlers.onToggleInputChange}
            onEmailBlur={handlers.onEmailBlur}
            emailError={emailError}
            phoneError={phoneError}
            showPasswordHint={true}
            hasBeenTouched={true}
          />
        </UserFormLayout>
      </Layouts.Content>
    </Page.Main>
  );
};

export default EditUserForm;
