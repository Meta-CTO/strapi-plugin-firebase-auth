import React from "react";
import { Layouts } from "@strapi/strapi/admin";
import { Button, Flex, Box } from "@strapi/design-system";
import { Link } from "@strapi/design-system";
import { ArrowLeft } from "@strapi/icons";
import { useNavigate } from "react-router-dom";
import isEqual from "lodash/isEqual";
import isEmpty from "lodash/isEmpty";
import { User } from "../../../../../model/User";

interface HeaderProps {
  title: string;
  onSave: () => void;
  initialData: Partial<User> | null;
  modifiedData: Partial<User> | null;
  isCreatingEntry?: boolean;
  isLoading?: boolean;
  isSubmitButtonDisabled?: boolean;
}

export const Header = ({
  title,
  onSave,
  initialData,
  modifiedData,
  isCreatingEntry = false,
  isLoading = false,
  isSubmitButtonDisabled = false,
}: HeaderProps) => {
  const navigate = useNavigate();

  const didChangeData = !isEqual(initialData, modifiedData) || (isCreatingEntry && !isEmpty(modifiedData));

  const primaryAction = (
    <Flex>
      <Box>
        <Button
          disabled={!didChangeData || isSubmitButtonDisabled}
          onClick={onSave}
          loading={isLoading}
          type="submit"
        >
          Save
        </Button>
      </Box>
    </Flex>
  );

  return (
    <Layouts.Header
      title={title}
      primaryAction={primaryAction}
      navigationAction={
        <Link
          startIcon={<ArrowLeft />}
          onClick={(e: any) => {
            e.preventDefault();
            navigate(-1);
          }}
          to="#"
        >
          Back
        </Link>
      }
    />
  );
};
