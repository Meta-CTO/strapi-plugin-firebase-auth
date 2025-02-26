import React from "react";
import { Flex } from "@strapi/design-system";
import { Tooltip } from "@strapi/design-system";

const providerIconMapping: { [key: string]: string } = {
  password: "Password",
  "google.com": "Google",
  "apple.com": "Apple",
  "facebook.com": "Facebook",
  "twitter.com": "Twitter",
  "github.com": "GitHub",
  "yahoo.com": "Yahoo",
  "hotmail.com": "Hotmail",
  phone: "Phone",
  anonymous: "Anonymous",
};

export const MapProviderToIcon = ({ providerData }: any) => {
  return (
    <Flex gap={2}>
      {providerData?.map(({ providerId }: any) => (
        <Tooltip description={providerId} key={providerId}>
          <div>{providerIconMapping[providerId] || providerId}</div>
        </Tooltip>
      ))}
    </Flex>
  );
};
