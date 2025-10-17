import React, { useState, useEffect } from "react";
import { JSONInput, Flex, Box, Button, Typography, TextInput, Textarea } from "@strapi/design-system";

import { Page } from "@strapi/strapi/admin";
import { useNotification } from "@strapi/strapi/admin";
import { delFirebaseConfig, getFirebaseConfig, restartServer, saveFirebaseConfig, savePasswordSettings } from "./api";
import { Trash } from "@strapi/icons";
import { useNavigate } from "react-router-dom";

function SettingsPage() {
  const { toggleNotification } = useNotification();
  const [firebaseJsonValue, setFirebaseJsonValue] = useState<any>(null);
  const [firebaseJsonValueInput, setFirebaseJsonValueInput] = useState<any>("");
  const [firebaseWebApiKey, setFirebaseWebApiKey] = useState<string>("");
  const [showOptionalSettings, setShowOptionalSettings] = useState<boolean>(false);
  // Password reset configuration fields
  const [passwordRequirementsRegex, setPasswordRequirementsRegex] = useState<string>("^.{6,}$");
  const [passwordRequirementsMessage, setPasswordRequirementsMessage] = useState<string>("Password must be at least 6 characters long");
  const [passwordResetUrl, setPasswordResetUrl] = useState<string>("http://localhost:3000/reset-password");
  const [passwordResetEmailSubject, setPasswordResetEmailSubject] = useState<string>("Reset Your Password");
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
        // Load password reset configuration fields
        setPasswordRequirementsRegex(data?.passwordRequirementsRegex || "^.{6,}$");
        setPasswordRequirementsMessage(data?.passwordRequirementsMessage || "Password must be at least 6 characters long");
        setPasswordResetUrl(data?.passwordResetUrl || "http://localhost:3000/reset-password");
        setPasswordResetEmailSubject(data?.passwordResetEmailSubject || "Reset Your Password");
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
      // Reset password configuration fields to defaults
      setPasswordRequirementsRegex("^.{6,}$");
      setPasswordRequirementsMessage("Password must be at least 6 characters long");
      setPasswordResetUrl("http://localhost:3000/reset-password");
      setPasswordResetEmailSubject("Reset Your Password");
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

      const data = await saveFirebaseConfig(jsonToSubmit, firebaseWebApiKey, {
        passwordRequirementsRegex,
        passwordRequirementsMessage,
        passwordResetUrl,
        passwordResetEmailSubject,
      });
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

  const handleSavePasswordSettings = async () => {
    try {
      setLoading(true);

      // If Firebase is configured, we can update everything
      // If not, we'll save just the password settings
      const data = await savePasswordSettings({
        passwordRequirementsRegex,
        passwordRequirementsMessage,
        passwordResetUrl,
        passwordResetEmailSubject,
      });

      console.log("Password settings saved:", data);

      // Update local state with returned values
      if (data) {
        setPasswordRequirementsRegex(data.passwordRequirementsRegex || passwordRequirementsRegex);
        setPasswordRequirementsMessage(data.passwordRequirementsMessage || passwordRequirementsMessage);
        setPasswordResetUrl(data.passwordResetUrl || passwordResetUrl);
        setPasswordResetEmailSubject(data.passwordResetEmailSubject || passwordResetEmailSubject);
      }

      setLoading(false);
      toggleNotification({
        type: "success",
        message: "Password settings saved successfully",
      });
    } catch (error) {
      console.error("Error saving password settings:", error);
      toggleNotification({
        type: "warning",
        message: "Failed to save password settings",
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
          {/* Section 1: Firebase Authentication Configuration */}
          <Box marginBottom={6} padding={4} background="neutral0" borderRadius="4px" shadow="filterShadow">
            <Typography variant="alpha" as="h2" style={{ display: 'block', marginBottom: '8px' }}>
              🔐 Firebase Authentication
            </Typography>
            <Typography variant="omega" textColor="neutral600" style={{ display: 'block', marginBottom: '24px' }}>
              Configure your Firebase service account (API key optional)
            </Typography>

            {(() => {
              console.log("Current firebaseJsonValue:", firebaseJsonValue);
              return !firebaseJsonValue || !firebaseJsonValue.firebaseConfigJson ? (
                <>
                  <Box>
                    <Typography variant="omega" fontWeight="bold" style={{ display: 'block', marginBottom: '8px' }}>
                      Firebase Service Account JSON *
                    </Typography>
                    <JSONInput
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
                  </Box>

                  {/* Optional Settings Section */}
                  <Box marginTop={4}>
                    <Button
                      variant="tertiary"
                      onClick={() => setShowOptionalSettings(!showOptionalSettings)}
                      style={{ marginBottom: 16 }}
                    >
                      {showOptionalSettings ? "▼" : "▶"} Optional: Email/Password Authentication
                    </Button>

                    {showOptionalSettings && (
                      <Box padding={3} background="neutral100" borderRadius="4px">
                        <Typography variant="omega" marginBottom={3}>
                          The Web API Key is only needed if you want to use the emailLogin endpoint.
                          Most users should authenticate with Firebase Client SDK instead.
                        </Typography>

                        <Box marginTop={3}>
                          <Typography variant="omega" fontWeight="bold" style={{ display: 'block', marginBottom: '8px' }}>
                            Firebase Web API Key (Optional)
                          </Typography>
                          <TextInput
                            name="firebaseWebApiKey"
                            value={firebaseWebApiKey}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirebaseWebApiKey(e.target.value)}
                            placeholder="AIzaSy... (your Web API Key)"
                            hint="Only required for email/password login endpoint"
                          />
                        </Box>

                        <Box marginTop={3} padding={2} background="primary100" borderRadius="4px">
                          <Typography variant="omega" fontWeight="bold">
                            📍 Where to find your Web API Key:
                          </Typography>
                          <ol style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>
                              <Typography variant="omega">
                                Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">Firebase Console</a>
                              </Typography>
                            </li>
                            <li>
                              <Typography variant="omega">
                                Select your project
                              </Typography>
                            </li>
                            <li>
                              <Typography variant="omega">
                                Click the gear icon ⚙️ → <strong>Project Settings</strong>
                              </Typography>
                            </li>
                            <li>
                              <Typography variant="omega">
                                In the <strong>General</strong> tab, scroll down to <strong>Your apps</strong>
                              </Typography>
                            </li>
                            <li>
                              <Typography variant="omega">
                                Find <strong>Web API Key</strong> (looks like: AIzaSyB3Xd...)
                              </Typography>
                            </li>
                          </ol>
                        </Box>

                        <Box marginTop={3} padding={2} background="warning100" borderRadius="4px">
                          <Typography variant="omega" textColor="warning700">
                            ⚠️ <strong>Recommendation:</strong> Instead of using emailLogin endpoint, authenticate users
                            on the client side using Firebase SDK and exchange the ID token. This is more secure and doesn't
                            require the Web API Key configuration.
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>

                  <Flex
                    style={{
                      marginTop: 24,
                      width: "100%",
                    }}
                    justifyContent="flex-end"
                  >
                    <Button
                      size="L"
                      onClick={handleFirebaseJsonSubmit}
                      disabled={!isJsonString(firebaseJsonValueInput)}
                    >
                      Submit Firebase Config
                    </Button>
                  </Flex>

                  {/* Setup Instructions - Inside the Firebase section */}
                  <Box marginTop={6} paddingTop={4} style={{ borderTop: "1px solid #eaeaef" }}>
                    <Typography variant="beta" marginBottom={3}>How to setup Firebase Service Account JSON:</Typography>
                    <Box
                      padding={3}
                      background="warning100"
                      borderRadius="4px"
                      marginBottom={4}
                    >
                      <Typography variant="omega" fontWeight="bold" textColor="warning700">
                        ⚠️ Security Warning
                      </Typography>
                      <Typography variant="omega" textColor="warning700" marginTop={1}>
                        The Service Account JSON contains sensitive credentials with full admin access to your Firebase project. Never commit this file to version control or share it publicly.
                      </Typography>
                    </Box>
                    <Box marginLeft={4}>
                      <ol style={{ listStyle: "decimal", paddingLeft: "20px" }}>
                        <li style={{ marginTop: 16 }}>
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
                        <li style={{ marginTop: 16 }}>
                          <Typography>Click the <strong>"Generate New Private Key"</strong> button</Typography>
                        </li>
                        <li style={{ marginTop: 16 }}>
                          <Typography>
                            Confirm by clicking <strong>"Generate Key"</strong> in the confirmation dialog
                          </Typography>
                        </li>
                        <li style={{ marginTop: 16 }}>
                          <Typography>
                            A JSON file will be downloaded (e.g., <code>your-project-firebase-adminsdk-xxxxx.json</code>)
                          </Typography>
                        </li>
                        <li style={{ marginTop: 16 }}>
                          <Typography>
                            Open the downloaded JSON file, copy its <strong>entire contents</strong>, and paste it in the "Firebase Service Account JSON" field above
                          </Typography>
                        </li>
                        <li style={{ marginTop: 16 }}>
                          <Typography>Click <strong>Submit</strong> to save your configuration</Typography>
                        </li>
                        <li style={{ marginTop: 16 }}>
                          <Typography>
                            <em>(Optional)</em> If you need email/password authentication, expand "Optional: Email/Password Authentication" and add your Web API Key
                          </Typography>
                        </li>
                      </ol>
                    </Box>
                    <Box
                      marginTop={4}
                      padding={3}
                      background="neutral100"
                      borderRadius="4px"
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
                  </Box>
                </>
              ) : (
                <>
                  <Box padding={3} background="success100" borderRadius="4px">
                    <Flex gap={2} alignItems="center">
                      <Typography variant="omega" fontWeight="bold" textColor="success700">
                        ✅ Firebase Configured
                      </Typography>
                      <Typography variant="omega" textColor="success700">
                        Project: <strong>
                          {firebaseJsonValue?.firebaseConfigJson &&
                            (() => {
                              try {
                                const config = JSON.parse(firebaseJsonValue.firebaseConfigJson);
                                return config.project_id || config.projectId || "Unknown Project";
                              } catch (e) {
                                return "Invalid Config";
                              }
                            })()}
                        </strong>
                      </Typography>
                    </Flex>
                    {firebaseWebApiKey && (
                      <Typography variant="omega" textColor="success700" marginTop={1}>
                        API Key: {firebaseWebApiKey.substring(0, 10)}...
                      </Typography>
                    )}
                  </Box>
                  <Flex gap={2} marginTop={3}>
                    <Button
                      variant="danger-light"
                      onClick={handleDeleteFirebaseJsonConfig}
                      startIcon={<Trash />}
                    >
                      Delete Configuration
                    </Button>
                    <Button onClick={() => navigate("/plugins/firebase-authentication")} variant="secondary">
                      Back to Firebase Plugin
                    </Button>
                  </Flex>
                </>
              );
            })()}
          </Box>

          {/* Section 2: Password Reset Configuration - Always Visible */}
          <Box padding={4} background="neutral0" borderRadius="4px" shadow="filterShadow" marginBottom={6}>
            <Typography variant="alpha" as="h2" style={{ display: 'block', marginBottom: '8px' }}>
              🔑 Password Reset Settings
            </Typography>
            <Typography variant="omega" textColor="neutral600" style={{ display: 'block', marginBottom: '24px' }}>
              Configure password requirements and email settings for password reset functionality
            </Typography>

            <Box marginBottom={3}>
              <Typography variant="omega" fontWeight="bold" style={{ display: 'block', marginBottom: '8px' }}>
                Password Requirements (Regex)
              </Typography>
              <TextInput
                name="passwordRequirementsRegex"
                value={passwordRequirementsRegex}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordRequirementsRegex(e.target.value)}
                placeholder="^.{6,}$"
                hint="Regular expression to validate password strength. Default: ^.{6,}$ (min 6 characters)"
              />
            </Box>

            <Box marginBottom={3}>
              <Typography variant="omega" fontWeight="bold" style={{ display: 'block', marginBottom: '8px' }}>
                Password Requirements Message
              </Typography>
              <Textarea
                name="passwordRequirementsMessage"
                value={passwordRequirementsMessage}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPasswordRequirementsMessage(e.target.value)}
                placeholder="Password must be at least 6 characters long"
                hint="Error message shown when password doesn't meet requirements"
              />
            </Box>

            <Box marginBottom={3}>
              <Typography variant="omega" fontWeight="bold" style={{ display: 'block', marginBottom: '8px' }}>
                Password Reset URL *
              </Typography>
              <TextInput
                name="passwordResetUrl"
                value={passwordResetUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordResetUrl(e.target.value)}
                placeholder="https://yourapp.com/reset-password"
                hint="URL where users will reset their password (your frontend application)"
                required
              />
            </Box>

            <Box marginBottom={3}>
              <Typography variant="omega" fontWeight="bold" style={{ display: 'block', marginBottom: '8px' }}>
                Reset Email Subject
              </Typography>
              <TextInput
                name="passwordResetEmailSubject"
                value={passwordResetEmailSubject}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordResetEmailSubject(e.target.value)}
                placeholder="Reset Your Password"
                hint="Subject line for password reset emails"
              />
            </Box>

            {/* Helper Section for Common Patterns */}
            <Box marginTop={4} padding={3} background="neutral100" borderRadius="4px">
              <Typography variant="omega" fontWeight="bold" style={{ display: 'block', marginBottom: '12px' }}>
                Common Password Patterns:
              </Typography>
              <Box marginLeft={2}>
                <Typography variant="omega" style={{ display: 'block', marginBottom: '8px' }}>
                  • <code>{'^.{6,}$'}</code> - Minimum 6 characters (simple)
                </Typography>
                <Typography variant="omega" style={{ display: 'block', marginBottom: '8px' }}>
                  • <code>{'^.{8,}$'}</code> - Minimum 8 characters
                </Typography>
                <Typography variant="omega" style={{ display: 'block', marginBottom: '8px' }}>
                  • <code>{'^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{8,}$'}</code> - At least 8 chars with letters and numbers
                </Typography>
                <Typography variant="omega" style={{ display: 'block' }}>
                  • <code>{'^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'}</code> - Complex (upper, lower, number, special)
                </Typography>
              </Box>
            </Box>

            <Flex
              style={{
                marginTop: 24,
                width: "100%",
              }}
              justifyContent="flex-end"
            >
              <Button
                size="L"
                variant="secondary"
                onClick={handleSavePasswordSettings}
              >
                Save Password Settings
              </Button>
            </Flex>
          </Box>
        </Box>
      </Flex>
    </>
  );
}

export default SettingsPage;
