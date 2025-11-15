import React, { useState, useCallback, useEffect } from "react";
import { Box, Typography, Flex, Link, Divider } from "@strapi/design-system";
import { useNotification, Page, Layouts } from "@strapi/strapi/admin";
import { Pencil } from "@strapi/icons";
import { format } from "date-fns";
import styled from "styled-components";
import { useNavigate, useLocation } from "react-router-dom";
import { User, ProviderItem } from "../../../../../model/User";
import { Header } from "../../common/Header/Header";
import { UserFormFields } from "../shared/UserFormFields/UserFormFields";
import { UserFormLayout } from "../shared/UserFormLayout/UserFormLayout";
import { updateUser, resetUserPassword, sendResetEmail, getFirebaseConfig } from "../../../pages/utils/api";
import { useUserForm } from "../../../hooks/useUserForm";
import { PasswordResetButton } from "../../PasswordResetButton";
import { ResetPassword } from "../../user-management";

const MetaWrapper = styled(Box)`
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  font-size: 18px;
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
  strapiDocumentId?: string;
}

const EditUserForm = ({ data }: EditFormProps) => {
  const [originalUserData] = useState(data);
  const [isLoading, setIsLoading] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState({
    isOpen: false,
    email: "",
    id: "",
  });
  const [passwordConfig, setPasswordConfig] = useState({
    passwordRequirementsRegex: "^.{6,}$",
    passwordRequirementsMessage: "Password must be at least 6 characters long",
  });

  const { toggleNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as LocationState) || {};

  const { userData, setUserData, emailError, phoneError, handlers, isSubmitDisabled } = useUserForm(data);

  const updateUserHandler = useCallback(async () => {
    setIsLoading(true);
    try {
      const updatedUser = await updateUser(userData.uid as string, userData as User);

      // Handle Promise.allSettled response format with proper type narrowing
      const result = updatedUser[0];
      if (result?.status === "rejected") {
        const errorReason = result.reason;
        const errorMessage =
          errorReason?.message ||
          (errorReason?.code ? `Firebase error: ${errorReason.code}` : null) ||
          "Error updating user";
        throw new Error(errorMessage);
      }

      setUserData(result.value);
      setIsLoading(false);
      toggleNotification({
        type: "success",
        message: "User updated successfully",
      });
    } catch (error) {
      console.error("Error updating user:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred while updating the user";
      toggleNotification({
        type: "danger",
        message: errorMessage,
      });
      setIsLoading(false);
      setUserData(data);
    }
  }, [userData, toggleNotification, data, setUserData]);

  // Fetch Firebase password config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await getFirebaseConfig();
        setPasswordConfig({
          passwordRequirementsRegex: config.passwordRequirementsRegex,
          passwordRequirementsMessage: config.passwordRequirementsMessage,
        });
      } catch (error) {
        console.error("Failed to fetch Firebase config:", error);
      }
    };
    fetchConfig();
  }, []);

  const handleCloseResetDialog = useCallback(() => {
    setShowResetPasswordDialog({ isOpen: false, email: "", id: "" });
  }, []);

  const handleResetPassword = useCallback(
    async (newPassword: string) => {
      try {
        await resetUserPassword(userData.uid as string, { password: newPassword });
        toggleNotification({
          type: "success",
          message: "Password reset successfully",
        });
        handleCloseResetDialog();
      } catch (error) {
        console.error("Error resetting password:", error);
        toggleNotification({
          type: "danger",
          message: "Failed to reset password",
        });
      }
    },
    [userData.uid, toggleNotification, handleCloseResetDialog]
  );

  const handleSendResetEmail = useCallback(async () => {
    try {
      await sendResetEmail(userData.uid as string);
      toggleNotification({
        type: "success",
        message: "Password reset email sent successfully",
      });
    } catch (error) {
      console.error("Error sending reset email:", error);
      toggleNotification({
        type: "danger",
        message: "Failed to send reset email",
      });
    }
  }, [userData.uid, toggleNotification]);

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
                {/* Fields shown once */}
                <Flex paddingTop={2} paddingBottom={2} direction="column" alignItems="flex-start" gap={2}>
                  {/* Firebase User ID */}
                  <Flex gap={1}>
                    <Typography variant="sigma" textColor="neutral600">
                      Firebase User ID:
                    </Typography>
                    <Typography variant="sigma" textColor="neutral600">
                      {userData.firebaseUserID || userData.uid}
                    </Typography>
                  </Flex>

                  {/* Strapi ID */}
                  {locationState?.strapiId && (
                    <Flex gap={1}>
                      <Typography variant="sigma" textColor="neutral600">
                        Strapi ID:
                      </Typography>
                      <Typography
                        variant="sigma"
                        textColor="primary600"
                        component="a"
                        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                          e.preventDefault();
                          navigate(
                            `/content-manager/collection-types/plugin::users-permissions.user/${
                              userData.strapiDocumentId ||
                              userData.documentId ||
                              locationState.strapiDocumentId
                            }`
                          );
                        }}
                        style={{
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        {locationState.strapiId}
                      </Typography>
                    </Flex>
                  )}
                </Flex>

                <Divider />

                {/* Provider-specific fields (repeated per provider) */}
                {userData.providerData?.map((provider: ProviderItem, index: number) => (
                  <React.Fragment key={index}>
                    {index > 0 && <Divider />}
                    <Flex paddingTop={2} paddingBottom={2} direction="column" alignItems="flex-start" gap={2}>
                      {/* Provider */}
                      <Flex gap={1}>
                        <Typography variant="sigma" textColor="neutral600">
                          Provider:
                        </Typography>
                        <Typography variant="sigma" textColor="neutral600">
                          {provider.providerId}
                        </Typography>
                      </Flex>

                      {/* Identifier */}
                      <Flex gap={1}>
                        <Typography variant="sigma" textColor="neutral600">
                          Identifier:
                        </Typography>
                        <Typography variant="sigma" textColor="neutral600">
                          {provider.uid}
                        </Typography>
                      </Flex>
                    </Flex>
                  </React.Fragment>
                ))}
                <Divider />
                <Flex paddingTop={2} paddingBottom={2} direction="column" alignItems="flex-start" gap={3}>
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

              {/* Password Reset Button */}
              <Box
                as="aside"
                background="neutral0"
                borderColor="neutral150"
                hasRadius
                paddingBottom={4}
                paddingLeft={4}
                paddingRight={4}
                paddingTop={4}
                shadow="tableShadow"
              >
                <Typography variant="sigma" textColor="neutral600" marginBottom={2}>
                  Account Actions
                </Typography>
                <PasswordResetButton
                  user={userData as User}
                  fullWidth
                  onClick={() => {
                    setShowResetPasswordDialog({
                      isOpen: true,
                      email: userData.email || "",
                      id: userData.uid || "",
                    });
                  }}
                />
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

      {/* Reset Password Modal */}
      <ResetPassword
        isOpen={showResetPasswordDialog.isOpen}
        onClose={handleCloseResetDialog}
        onDirectReset={handleResetPassword}
        email={showResetPasswordDialog.email}
        userId={showResetPasswordDialog.id}
        passwordRegex={passwordConfig.passwordRequirementsRegex}
        passwordMessage={passwordConfig.passwordRequirementsMessage}
        onSendResetEmail={handleSendResetEmail}
      />
    </Page.Main>
  );
};

export default EditUserForm;
