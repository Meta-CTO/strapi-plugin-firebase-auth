import React, { useState, useEffect } from "react";
import { JSONInput, Flex, Box, Button, Typography, TextInput } from "@strapi/design-system";

import { Page } from "@strapi/strapi/admin";
import { useNotification } from "@strapi/strapi/admin";
import { delFirebaseConfig, getFirebaseConfig, restartServer, saveFirebaseConfig } from "./api";
import { Trash } from "@strapi/icons";
import { useNavigate } from "react-router-dom";

function SettingsPage() {
  const { toggleNotification } = useNotification();
  const [firebaseJsonValue, setFirebaseJsonValue] = useState<any>(null);
  const [firebaseJsonValueInput, setFirebaseJsonValueInput] = useState<any>("");
  const [firebaseWebApiKey, setFirebaseWebApiKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const handleRetrieveFirebaseJsonConfig = () => {
    setLoading(true);
    getFirebaseConfig()
      .then((data) => {
        console.log("Retrieved Firebase Config:", data);
        setLoading(false);
        if (!data || (Array.isArray(data) && data.length === 0)) {
          setFirebaseJsonValue(null);
          setFirebaseJsonValueInput("");
          return;
        }
        setFirebaseJsonValue(data);
        setFirebaseJsonValueInput(typeof data === "string" ? data : JSON.stringify(data));
        setFirebaseWebApiKey(data?.firebaseWebApiKey || "");
      })
      .catch((error) => {
        setLoading(false);
        console.error("Error retrieving Firebase config:", error);
        setFirebaseJsonValue(null);
        setFirebaseJsonValueInput("");
      });
  };

  useEffect(() => {
    handleRetrieveFirebaseJsonConfig();
  }, []);

  const handleDeleteFirebaseJsonConfig = async () => {
    try {
      setLoading(true);
      await delFirebaseConfig();
      setFirebaseJsonValue(null);
      setFirebaseJsonValueInput("");
      setFirebaseWebApiKey("");
      // restartServer();
      setLoading(false);
      toggleNotification({
        type: "success",
        message: "Firebase configuration has successfully been removed",
      });
    } catch (err) {
      setLoading(false);
      toggleNotification({
        type: "warning",
        message: "An error occurred, please try again",
      });
    }
  };

  const handleFirebaseJsonSubmit = async () => {
    console.log("Submitting Firebase JSON:", firebaseJsonValueInput);
    try {
      setLoading(true);
      const jsonToSubmit =
        typeof firebaseJsonValueInput === "string"
          ? firebaseJsonValueInput
          : JSON.stringify(firebaseJsonValueInput);

      const data = await saveFirebaseConfig(jsonToSubmit, firebaseWebApiKey);
      console.log("Firebase JSON submission response:", data);

      if (!data || !data.firebase_config_json) {
        throw new Error("Invalid response from server");
      }

      setFirebaseJsonValue(data);
      setLoading(false);
      toggleNotification({
        type: "success",
        message: "Data submitted successfully",
      });
      // restartServer();
    } catch (error) {
      console.error("Error submitting Firebase JSON:", error);
      toggleNotification({
        type: "warning",
        message: "Something went wrong",
      });
      setLoading(false);
    }
  };

  if (loading) {
    return <Page.Loading />;
  }

  const isJsonString = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  };

  return (
    <>
      <Flex style={{ padding: 32 }} direction="column" alignItems="flex-start" gap={4}>
        <Box style={{ width: "100%" }}>
          {(() => {
            console.log("Current firebaseJsonValue:", firebaseJsonValue);
            return !firebaseJsonValue || !firebaseJsonValue.firebaseConfigJson ? (
              <>
                <JSONInput
                  label="Firebase Service Account JSON"
                  value={firebaseJsonValueInput}
                  height={400}
                  style={{ height: 400 }}
                  onChange={setFirebaseJsonValueInput}
                  error={
                    firebaseJsonValueInput && !isJsonString(firebaseJsonValueInput)
                      ? "Please enter a valid JSON string"
                      : ""
                  }
                />
                <TextInput
                  label="Firebase Web API Key"
                  name="firebaseWebApiKey"
                  value={firebaseWebApiKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirebaseWebApiKey(e.target.value)}
                  placeholder="Enter your Firebase Web API Key"
                  hint="Found in Firebase Console > Project Settings > General > Web API Key"
                  style={{ marginTop: 16 }}
                />
                <Flex
                  style={{
                    marginTop: 32,
                    width: "100%",
                    padding: 16,
                  }}
                  justifyContent="flex-end"
                >
                  <Button
                    size="L"
                    onClick={handleFirebaseJsonSubmit}
                    disabled={!isJsonString(firebaseJsonValueInput)}
                  >
                    Submit
                  </Button>
                </Flex>
              </>
            ) : (
              <>
                <Flex gap={4}>
                  🚀 You have successfully submitted your json configuration for project:{" "}
                  <span style={{ fontWeight: 700 }}>
                    {firebaseJsonValue?.firebaseConfigJson &&
                      (() => {
                        try {
                          const config = JSON.parse(firebaseJsonValue.firebaseConfigJson);
                          return config.project_id || config.projectId || "Unknown Project";
                        } catch (e) {
                          return "Invalid Config";
                        }
                      })()}
                  </span>
                  <Button
                    variant="danger-light"
                    onClick={handleDeleteFirebaseJsonConfig}
                    startIcon={<Trash />}
                  >
                    Delete
                  </Button>
                </Flex>
                <Button onClick={() => navigate("/plugins/firebase-authentication")} marginTop={4}>
                  Back to firebase plugin
                </Button>
              </>
            );
          })()}
          {!firebaseJsonValue ? (
            <Flex direction="column" alignItems="flex-start" marginTop={10}>
              <Typography variant="beta">How to setup Firebase Service Account JSON:</Typography>
              <Box
                marginTop={2}
                padding={3}
                background="warning100"
                borderRadius="4px"
                style={{ width: "100%" }}
              >
                <Typography variant="omega" fontWeight="bold" textColor="warning700">
                  ⚠️ Security Warning
                </Typography>
                <Typography variant="omega" textColor="warning700" marginTop={1}>
                  The Service Account JSON contains sensitive credentials with full admin access to your Firebase project. Never commit this file to version control or share it publicly.
                </Typography>
              </Box>
              <Box marginTop={4} marginLeft={6}>
                <ol style={{ listStyle: "auto" }}>
                  <li style={{ marginTop: 24 }}>
                    <Typography>
                      Go to the{" "}
                      <a
                        href="https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Service Accounts tab
                      </a>{" "}
                      in your Firebase Console (Project Settings → Service Accounts)
                    </Typography>
                  </li>
                  <li style={{ marginTop: 24 }}>
                    <Typography>Click the <strong>"Generate New Private Key"</strong> button</Typography>
                  </li>
                  <li style={{ marginTop: 24 }}>
                    <Typography>
                      Confirm by clicking <strong>"Generate Key"</strong> in the confirmation dialog
                    </Typography>
                  </li>
                  <li style={{ marginTop: 24 }}>
                    <Typography>
                      A JSON file will be downloaded (e.g., <code>your-project-firebase-adminsdk-xxxxx.json</code>)
                    </Typography>
                  </li>
                  <li style={{ marginTop: 24 }}>
                    <Typography>
                      Open the downloaded JSON file, copy its <strong>entire contents</strong>, and paste it in the "Firebase Service Account JSON" field above
                    </Typography>
                  </li>
                  <li style={{ marginTop: 24 }}>
                    <Typography>
                      Enter your <strong>Firebase Web API Key</strong> (found in Project Settings → General → Web API Key)
                    </Typography>
                  </li>
                  <li style={{ marginTop: 24 }}>
                    <Typography>Click <strong>Submit</strong> to save your configuration</Typography>
                  </li>
                </ol>
              </Box>
              <Box
                marginTop={4}
                padding={3}
                background="neutral100"
                borderRadius="4px"
                style={{ width: "100%" }}
              >
                <Typography variant="omega" fontWeight="bold">
                  📝 Note: Service Account JSON vs Web App Config
                </Typography>
                <Typography variant="omega" marginTop={2}>
                  <strong>Service Account JSON</strong> (what you need here): Contains <code>private_key</code>, <code>client_email</code>, etc. Used for server-side Firebase Admin SDK operations. Download from <strong>Service Accounts tab</strong>.
                </Typography>
                <Typography variant="omega" marginTop={2}>
                  <strong>Web App Config</strong> (NOT what you need): Contains <code>apiKey</code>, <code>authDomain</code>, etc. Used for client-side web apps. Found in SDK snippet - this is the wrong file!
                </Typography>
              </Box>
            </Flex>
          ) : null}
        </Box>
      </Flex>
    </>
  );
}

export default SettingsPage;
