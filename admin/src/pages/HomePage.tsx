import React from "react";
import { Box } from "@strapi/design-system";

const HomePage = () => {
  const dummyInterface = `interface User {
  id: string;
  name: string;
  email: string;
}`;

  return (
    <Box padding={4}>
      <div style={{ position: "relative" }}>
        <pre
          style={{
            backgroundColor: "#f5f5f5",
            padding: "1rem",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "14px",
            overflow: "auto"
          }}
        >
          {dummyInterface}
        </pre>
      </div>
    </Box>
  );
};

export { HomePage };
