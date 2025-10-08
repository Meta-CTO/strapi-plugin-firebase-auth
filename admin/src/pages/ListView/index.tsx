import React, { memo, useEffect, useState, useCallback } from "react";
import { useIntl } from "react-intl";
import get from "lodash/get";
import { Page, Layouts } from "@strapi/strapi/admin";
import { useQueryParams } from "@strapi/strapi/admin";
import { useNotification } from "@strapi/strapi/admin";

import { Button } from "@strapi/design-system";
import { Link } from "@strapi/design-system";
import { ArrowLeft } from "@strapi/icons";
import { Plus } from "@strapi/icons";
import { useNavigate } from "react-router-dom";
import { FirebaseTable } from "../../components/DynamicTable/FirebaseTable";
import { deleteUser, fetchUsers, resetUserPassword } from "../utils/api";
import { PaginationFooter } from "./PaginationFooter";
import SearchURLQuery from "../../components/SearchURLQuery/SearchURLQuery";
import { User } from "../../../../model/User";
import { ResponseMeta } from "../../../../model/Meta";
import { DeleteAccount } from "../../components/UserManagement/DeleteAccount";
import { ResetPassword } from "../../components/UserManagement/ResetPassword";

// Constants
const HEADER_TITLE = "Firebase Users";
const NOTIFICATION_MESSAGES = {
  DELETED: "Deleted",
  SAVED: "Saved",
  RESET_ERROR: "Error resetting password, please try again",
  LOAD_ERROR: "Failed to load users. Please try again.",
};

// Types
interface PageTokens {
  [page: number]: string;
}

interface ListViewProps {
  data: User[];
  meta: ResponseMeta;
}

// Helper function to map user data
const mapUserData = (users: any[]): User[] =>
  users.map((item) => ({
    id: item.uid,
    ...item,
  }));

/* eslint-disable react/no-array-index-key */
function ListView({ data, meta }: ListViewProps) {
  const [showResetPasswordDialogue, setShowResetPasswordDialogue] = useState({
    isOpen: false,
    email: "",
    id: "",
  });
  const [showDeleteAccountDialogue, setShowDeleteAccountDialogue] = useState({
    isOpen: false,
    email: "",
    id: "",
  });

  const [rowsData, setRowsData] = useState<User[]>(data);
  const [rowsMeta, setRowsMeta] = useState<ResponseMeta>(meta);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [query] = useQueryParams();

  const navigate = useNavigate();
  const { toggleNotification } = useNotification();
  const { formatMessage } = useIntl();

  // Pagination token management with proper types
  const setNextPageToken = useCallback((page: string, nextPageToken: string) => {
    const formattedPage = parseInt(page, 10) || 1;
    const storeObject = sessionStorage.getItem("nextPageTokens");
    const tokens: PageTokens = storeObject ? JSON.parse(storeObject) : {};

    tokens[formattedPage + 1] = nextPageToken;
    sessionStorage.setItem("nextPageTokens", JSON.stringify(tokens));
  }, []);

  const getNextPageToken = useCallback((page: string): string | undefined => {
    const formattedPage = parseInt(page, 10);
    const storeObject = sessionStorage.getItem("nextPageTokens");

    if (!storeObject) {
      return undefined;
    }

    const tokens: PageTokens = JSON.parse(storeObject);
    return tokens[formattedPage];
  }, []);

  const fetchPaginatedUsers = useCallback(async () => {
    const page = (query?.query as any)?.page as string | undefined;
    const nextPageToken = page ? getNextPageToken(page) : undefined;

    const queryWithToken = {
      ...query.query,
      ...(nextPageToken && { nextPageToken }),
    };

    const response = await fetchUsers(queryWithToken);

    if (response.pageToken && page) {
      setNextPageToken(page, response.pageToken);
    }

    return response;
  }, [query.query, getNextPageToken, setNextPageToken]);

  useEffect(() => {
    const fetchPaginatedData = async () => {
      try {
        setIsLoading(true);

        const response = await fetchPaginatedUsers();
        const mappedData = mapUserData(response.data || []);

        setRowsData(mappedData);
        setRowsMeta(response.meta);
      } catch (err) {
        toggleNotification({
          type: "warning",
          message: NOTIFICATION_MESSAGES.LOAD_ERROR,
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchPaginatedData();
  }, [query.query, fetchPaginatedUsers, toggleNotification]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await fetchPaginatedUsers();
      const mappedData = mapUserData(response.data);

      setRowsData(mappedData);
      setRowsMeta(response.meta);

      toggleNotification({
        type: "success",
        message: NOTIFICATION_MESSAGES.DELETED,
      });

      return mappedData;
    } catch (err) {
      const errorMessage = get(err, "response.payload.message", formatMessage({ id: "error.record.delete" }));

      toggleNotification({
        type: "warning",
        message: errorMessage,
      });

      return Promise.reject([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPaginatedUsers, toggleNotification, formatMessage]);

  const handleDeleteAll = useCallback(
    async (idsToDelete: Array<string | number>) => {
      await Promise.all(idsToDelete.map((id) => deleteUser(id as string, null)));
      await fetchData();
    },
    [fetchData]
  );

  const handleDeleteRecord = useCallback(
    async (idsToDelete: string, destination: string | null) => {
      await deleteUser(idsToDelete, destination);
      const result = await fetchData();
      return result;
    },
    [fetchData]
  );

  const handleConfirmDeleteData = useCallback(
    async (idsToDelete: string, isStrapiIncluded: boolean, isFirebaseIncluded: boolean) => {
      let destination: string | null = null;

      if (isStrapiIncluded && isFirebaseIncluded) {
        destination = null;
      } else if (isStrapiIncluded) {
        destination = "strapi";
      } else if (isFirebaseIncluded) {
        destination = "firebase";
      }

      const result = await handleDeleteRecord(idsToDelete, destination);
      return result;
    },
    [handleDeleteRecord]
  );

  const handleNavigateToCreate = useCallback(() => {
    navigate("users/create");
  }, [navigate]);

  const getCreateAction = useCallback(
    () => <Button onClick={handleNavigateToCreate} startIcon={<Plus />}>Create</Button>,
    [handleNavigateToCreate]
  );

  const handleCloseResetDialogue = useCallback(() => {
    setShowResetPasswordDialogue({ isOpen: false, email: "", id: "" });
  }, []);

  const handleCloseDeleteDialogue = useCallback(() => {
    setShowDeleteAccountDialogue({ isOpen: false, email: "", id: "" });
  }, []);

  const resetPassword = useCallback(
    async (newPassword: string) => {
      try {
        await resetUserPassword(showResetPasswordDialogue.id, {
          password: newPassword,
        });
        handleCloseResetDialogue();
        toggleNotification({
          type: "success",
          message: NOTIFICATION_MESSAGES.SAVED,
        });
      } catch (err) {
        toggleNotification({
          type: "danger",
          message: NOTIFICATION_MESSAGES.RESET_ERROR,
        });
      }
    },
    [showResetPasswordDialogue.id, handleCloseResetDialogue, toggleNotification]
  );

  const deleteAccount = useCallback(
    async (isStrapiIncluded: boolean, isFirebaseIncluded: boolean) => {
      const newRowsData = await handleConfirmDeleteData(
        showDeleteAccountDialogue.id,
        isStrapiIncluded,
        isFirebaseIncluded
      );
      handleCloseDeleteDialogue();
      setRowsData(newRowsData);
    },
    [showDeleteAccountDialogue.id, handleConfirmDeleteData, handleCloseDeleteDialogue]
  );

  const handleResetPasswordClick = useCallback((data: User) => {
    setShowResetPasswordDialogue({
      isOpen: true,
      email: data.email,
      id: data.uid,
    });
  }, []);

  const handleDeleteAccountClick = useCallback((data: User) => {
    setShowDeleteAccountDialogue({
      isOpen: true,
      email: data.email,
      id: data.uid,
    });
  }, []);

  if (isLoading) {
    return <Page.Loading />;
  }

  const headSubtitle = `Showing ${rowsData?.length || 0} entries`;

  return (
    <Page.Main>
      <Layouts.Header
        subtitle={headSubtitle}
        title={HEADER_TITLE}
        navigationAction={
          <Link startIcon={<ArrowLeft />} to="/content-manager/">
            Back
          </Link>
        }
      />
      <Layouts.Content>
        <ResetPassword
          isOpen={showResetPasswordDialogue.isOpen}
          onClose={handleCloseResetDialogue}
          onConfirm={resetPassword}
          email={showResetPasswordDialogue.email}
        />
        <DeleteAccount
          isOpen={showDeleteAccountDialogue.isOpen}
          onToggleDialog={handleCloseDeleteDialogue}
          onConfirm={deleteAccount}
          email={showDeleteAccountDialogue.email}
          isSingleRecord={true}
        />
        <FirebaseTable
          action={
            <SearchURLQuery
              label={formatMessage(
                {
                  id: "app.component.search.label",
                  defaultMessage: "Search for {target}",
                },
                { target: HEADER_TITLE }
              )}
              placeholder={formatMessage({
                id: "app.component.search.placeholder",
                defaultMessage: "Search...",
              })}
            />
          }
          createAction={getCreateAction()}
          isLoading={isLoading}
          rows={rowsData}
          onConfirmDeleteAll={handleDeleteAll}
          onResetPasswordClick={handleResetPasswordClick}
          onDeleteAccountClick={handleDeleteAccountClick}
        />
        <PaginationFooter pageCount={rowsMeta?.pagination?.pageCount || 1} />
      </Layouts.Content>
    </Page.Main>
  );
}

export default memo(ListView);
