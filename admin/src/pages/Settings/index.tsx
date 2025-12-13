import React, { useState, useEffect } from "react";
import {
  JSONInput,
  Flex,
  Box,
  Button,
  Typography,
  TextInput,
  Textarea,
  Toggle,
  NumberInput,
  Badge,
  Modal,
} from "@strapi/design-system";

import { Page } from "@strapi/strapi/admin";
import { useNotification } from "@strapi/strapi/admin";
import {
  delFirebaseConfig,
  getFirebaseConfig,
  restartServer,
  saveFirebaseConfig,
  savePasswordSettings,
} from "./api";
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
  const [passwordRequirementsMessage, setPasswordRequirementsMessage] = useState<string>(
    "Password must be at least 6 characters long"
  );
  const [passwordResetUrl, setPasswordResetUrl] = useState<string>("http://localhost:3000/reset-password");
  const [passwordResetEmailSubject, setPasswordResetEmailSubject] = useState<string>("Reset Your Password");
  // Magic link configuration fields
  const [enableMagicLink, setEnableMagicLink] = useState<boolean>(false);
  const [magicLinkUrl, setMagicLinkUrl] = useState<string>("http://localhost:1338/verify-magic-link.html");
  const [magicLinkEmailSubject, setMagicLinkEmailSubject] = useState<string>("Sign in to Your Application");
  const [magicLinkExpiryHours, setMagicLinkExpiryHours] = useState<number>(1);
  // Email verification configuration fields
  const [emailVerificationUrl, setEmailVerificationUrl] = useState<string>(
    "http://localhost:3000/verify-email"
  );
  const [emailVerificationEmailSubject, setEmailVerificationEmailSubject] =
    useState<string>("Verify Your Email");
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editWebApiKey, setEditWebApiKey] = useState<string>("");
  const navigate = useNavigate();

  const handleRetrieveFirebaseJsonConfig = () => {
    setLoading(true);
    getFirebaseConfig()
      .then((data) => {
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
        setPasswordRequirementsMessage(
          data?.passwordRequirementsMessage || "Password must be at least 6 characters long"
        );
        setPasswordResetUrl(data?.passwordResetUrl || "http://localhost:3000/reset-password");
        setPasswordResetEmailSubject(data?.passwordResetEmailSubject || "Reset Your Password");
        // Load magic link configuration fields
        setEnableMagicLink(data?.enableMagicLink || false);
        setMagicLinkUrl(data?.magicLinkUrl || "http://localhost:1338/verify-magic-link.html");
        setMagicLinkEmailSubject(data?.magicLinkEmailSubject || "Sign in to Your Application");
        setMagicLinkExpiryHours(data?.magicLinkExpiryHours || 1);
        // Load email verification configuration
        setEmailVerificationUrl(data?.emailVerificationUrl || "http://localhost:3000/verify-email");
        setEmailVerificationEmailSubject(data?.emailVerificationEmailSubject || "Verify Your Email");
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
      // Reset magic link configuration fields to defaults
      setEnableMagicLink(false);
      setMagicLinkUrl("http://localhost:1338/verify-magic-link.html");
      setMagicLinkEmailSubject("Sign in to Your Application");
      setMagicLinkExpiryHours(1);
      // Reset email verification configuration to default
      setEmailVerificationUrl("http://localhost:3000/verify-email");
      setEmailVerificationEmailSubject("Verify Your Email");
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
        enableMagicLink,
        magicLinkUrl,
        magicLinkEmailSubject,
        magicLinkExpiryHours,
        emailVerificationUrl,
        emailVerificationEmailSubject,
      });

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
        enableMagicLink,
        magicLinkUrl,
        magicLinkEmailSubject,
        magicLinkExpiryHours,
        emailVerificationUrl,
        emailVerificationEmailSubject,
      });

      // Update local state with returned values
      if (data) {
        setPasswordRequirementsRegex(data.passwordRequirementsRegex || passwordRequirementsRegex);
        setPasswordRequirementsMessage(data.passwordRequirementsMessage || passwordRequirementsMessage);
        setPasswordResetUrl(data.passwordResetUrl || passwordResetUrl);
        setPasswordResetEmailSubject(data.passwordResetEmailSubject || passwordResetEmailSubject);
        setEnableMagicLink(data.enableMagicLink || enableMagicLink);
        setMagicLinkUrl(data.magicLinkUrl || magicLinkUrl);
        setMagicLinkEmailSubject(data.magicLinkEmailSubject || magicLinkEmailSubject);
        setMagicLinkExpiryHours(data.magicLinkExpiryHours || magicLinkExpiryHours);
        setEmailVerificationUrl(data.emailVerificationUrl || emailVerificationUrl);
        setEmailVerificationEmailSubject(data.emailVerificationEmailSubject || emailVerificationEmailSubject);
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

  const handleSaveMagicLinkSettings = async () => {
    try {
      setLoading(true);

      const data = await savePasswordSettings({
        passwordRequirementsRegex,
        passwordRequirementsMessage,
        passwordResetUrl,
        passwordResetEmailSubject,
        enableMagicLink,
        magicLinkUrl,
        magicLinkEmailSubject,
        magicLinkExpiryHours,
        emailVerificationUrl,
        emailVerificationEmailSubject,
      });

      // Update local state with returned values
      if (data) {
        setEnableMagicLink(data.enableMagicLink || enableMagicLink);
        setMagicLinkUrl(data.magicLinkUrl || magicLinkUrl);
        setMagicLinkEmailSubject(data.magicLinkEmailSubject || magicLinkEmailSubject);
        setMagicLinkExpiryHours(data.magicLinkExpiryHours || magicLinkExpiryHours);
        setEmailVerificationUrl(data.emailVerificationUrl || emailVerificationUrl);
        setEmailVerificationEmailSubject(data.emailVerificationEmailSubject || emailVerificationEmailSubject);
      }

      setLoading(false);
      toggleNotification({
        type: "success",
        message: "Magic link settings saved successfully",
      });
    } catch (error) {
      console.error("Error saving magic link settings:", error);
      toggleNotification({
        type: "warning",
        message: "Failed to save magic link settings",
      });
      setLoading(false);
    }
  };

  const handleSaveEmailVerificationSettings = async () => {
    try {
      setLoading(true);

      const data = await savePasswordSettings({
        passwordRequirementsRegex,
        passwordRequirementsMessage,
        passwordResetUrl,
        passwordResetEmailSubject,
        enableMagicLink,
        magicLinkUrl,
        magicLinkEmailSubject,
        magicLinkExpiryHours,
        emailVerificationUrl,
        emailVerificationEmailSubject,
      });

      // Update local state with returned values
      if (data) {
        setEmailVerificationUrl(data.emailVerificationUrl || emailVerificationUrl);
        setEmailVerificationEmailSubject(data.emailVerificationEmailSubject || emailVerificationEmailSubject);
      }

      setLoading(false);
      toggleNotification({
        type: "success",
        message: "Email verification settings saved successfully",
      });
    } catch (error) {
      console.error("Error saving email verification settings:", error);
      toggleNotification({
        type: "warning",
        message: "Failed to save email verification settings",
      });
      setLoading(false);
    }
  };

  const handleAddWebApiKey = () => {
    setEditWebApiKey("");
    setShowEditModal(true);
  };

  const handleRemoveWebApiKey = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to remove the Web API Key? The emailLogin endpoint will stop working until you add it again."
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      const jsonToSubmit = firebaseJsonValue.firebaseConfigJson;

      // Save with empty API key to remove it
      const data = await saveFirebaseConfig(jsonToSubmit, "", {
        passwordRequirementsRegex,
        passwordRequirementsMessage,
        passwordResetUrl,
        passwordResetEmailSubject,
        enableMagicLink,
        magicLinkUrl,
        magicLinkEmailSubject,
        magicLinkExpiryHours,
        emailVerificationUrl,
        emailVerificationEmailSubject,
      });

      if (!data || !data.firebase_config_json) {
        throw new Error("Invalid response from server");
      }

      setFirebaseJsonValue(data);
      setFirebaseWebApiKey("");
      setLoading(false);
      toggleNotification({
        type: "success",
        message: "Web API Key removed successfully",
      });
    } catch (error) {
      console.error("Error removing Web API Key:", error);
      toggleNotification({
        type: "warning",
        message: "Failed to remove Web API Key",
      });
      setLoading(false);
    }
  };

  const handleSaveEditConfiguration = async () => {
    try {
      setLoading(true);
      const jsonToSubmit = firebaseJsonValue.firebaseConfigJson;

      const data = await saveFirebaseConfig(jsonToSubmit, editWebApiKey, {
        passwordRequirementsRegex,
        passwordRequirementsMessage,
        passwordResetUrl,
        passwordResetEmailSubject,
        enableMagicLink,
        magicLinkUrl,
        magicLinkEmailSubject,
        magicLinkExpiryHours,
        emailVerificationUrl,
        emailVerificationEmailSubject,
      });

      if (!data || !data.firebase_config_json) {
        throw new Error("Invalid response from server");
      }

      setFirebaseJsonValue(data);
      setFirebaseWebApiKey(editWebApiKey);
      setShowEditModal(false);
      setLoading(false);
      toggleNotification({
        type: "success",
        message: "Web API Key added successfully",
      });
    } catch (error) {
      console.error("Error adding Web API Key:", error);
      toggleNotification({
        type: "warning",
        message: "Failed to add Web API Key",
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
            <Typography variant="alpha" as="h2" style={{ display: "block", marginBottom: "8px" }}>
              Firebase Authentication
            </Typography>
            <Typography
              variant="omega"
              textColor="neutral600"
              style={{ display: "block", marginBottom: "24px" }}
            >
              Configure your Firebase service account (API key optional)
            </Typography>

            {(() => {
              return !firebaseJsonValue || !firebaseJsonValue.firebaseConfigJson ? (
                <>
                  <Box>
                    <Typography
                      variant="omega"
                      fontWeight="bold"
                      style={{ display: "block", marginBottom: "8px" }}
                    >
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
                          The Web API Key is only needed if you want to use the emailLogin endpoint. Most
                          users should authenticate with Firebase Client SDK instead.
                        </Typography>

                        <Box marginTop={3}>
                          <Typography
                            variant="omega"
                            fontWeight="bold"
                            style={{ display: "block", marginBottom: "8px" }}
                          >
                            Firebase Web API Key (Optional)
                          </Typography>
                          <TextInput
                            name="firebaseWebApiKey"
                            value={firebaseWebApiKey}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setFirebaseWebApiKey(e.target.value)
                            }
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
                                Go to{" "}
                                <a
                                  href="https://console.firebase.google.com"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Firebase Console
                                </a>
                              </Typography>
                            </li>
                            <li>
                              <Typography variant="omega">Select your project</Typography>
                            </li>
                            <li>
                              <Typography variant="omega">
                                Click the gear icon → <strong>Project Settings</strong>
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
                            ⚠️ <strong>Recommendation:</strong> Instead of using emailLogin endpoint,
                            authenticate users on the client side using Firebase SDK and exchange the ID
                            token. This is more secure and doesn't require the Web API Key configuration.
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
                    <Typography variant="beta" marginBottom={3}>
                      How to setup Firebase Service Account JSON:
                    </Typography>
                    <Box padding={3} background="warning100" borderRadius="4px" marginBottom={4}>
                      <Typography variant="omega" fontWeight="bold" textColor="warning700">
                        ⚠️ Security Warning
                      </Typography>
                      <Typography variant="omega" textColor="warning700" marginTop={1}>
                        The Service Account JSON contains sensitive credentials with full admin access to your
                        Firebase project. Never commit this file to version control or share it publicly.
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
                          <Typography>
                            Click the <strong>"Generate New Private Key"</strong> button
                          </Typography>
                        </li>
                        <li style={{ marginTop: 16 }}>
                          <Typography>
                            Confirm by clicking <strong>"Generate Key"</strong> in the confirmation dialog
                          </Typography>
                        </li>
                        <li style={{ marginTop: 16 }}>
                          <Typography>
                            A JSON file will be downloaded (e.g.,{" "}
                            <code>your-project-firebase-adminsdk-xxxxx.json</code>)
                          </Typography>
                        </li>
                        <li style={{ marginTop: 16 }}>
                          <Typography>
                            Open the downloaded JSON file, copy its <strong>entire contents</strong>, and
                            paste it in the "Firebase Service Account JSON" field above
                          </Typography>
                        </li>
                        <li style={{ marginTop: 16 }}>
                          <Typography>
                            Click <strong>Submit</strong> to save your configuration
                          </Typography>
                        </li>
                        <li style={{ marginTop: 16 }}>
                          <Typography>
                            <em>(Optional)</em> If you need email/password authentication, expand "Optional:
                            Email/Password Authentication" and add your Web API Key
                          </Typography>
                        </li>
                      </ol>
                    </Box>
                    <Box marginTop={4} padding={3} background="neutral100" borderRadius="4px">
                      <Typography variant="omega" fontWeight="bold">
                        📝 Note: Service Account JSON vs Web App Config
                      </Typography>
                      <Typography variant="omega" marginTop={2}>
                        <strong>Service Account JSON</strong> (what you need here): Contains{" "}
                        <code>private_key</code>, <code>client_email</code>, etc. Used for server-side
                        Firebase Admin SDK operations. Download from <strong>Service Accounts tab</strong>.
                      </Typography>
                      <Typography variant="omega" marginTop={2}>
                        <strong>Web App Config</strong> (NOT what you need): Contains <code>apiKey</code>,{" "}
                        <code>authDomain</code>, etc. Used for client-side web apps. Found in SDK snippet -
                        this is the wrong file!
                      </Typography>
                    </Box>
                  </Box>
                </>
              ) : (
                <>
                  <Box padding={4} background="neutral0">
                    {/* Service Account Section */}
                    <Box marginBottom={4}>
                      <Typography variant="delta" fontWeight="bold" style={{ marginBottom: "8px" }}>
                        Service Account Configuration
                      </Typography>
                      <Box marginBottom={3}>
                        <Typography variant="pi" textColor="neutral600" component="span">
                          <strong>Required</strong> - Enables Firebase Admin SDK for server-side
                          authentication
                        </Typography>
                      </Box>
                      <Flex gap={2} alignItems="center" justifyContent="space-between">
                        <Flex gap={2} alignItems="center">
                          <Typography variant="omega" textColor="neutral600">
                            Project:{" "}
                            {firebaseJsonValue?.firebaseConfigJson &&
                              (() => {
                                try {
                                  const config = JSON.parse(firebaseJsonValue.firebaseConfigJson);
                                  return config.project_id || config.projectId || "Unknown Project";
                                } catch (e) {
                                  return "Invalid Config";
                                }
                              })()}
                          </Typography>
                          <Badge backgroundColor="success200" textColor="success700" size="S">
                            ✓ CONFIGURED
                          </Badge>
                        </Flex>
                        <Button variant="danger-light" size="S" onClick={handleDeleteFirebaseJsonConfig}>
                          Delete Config
                        </Button>
                      </Flex>
                    </Box>

                    {/* Web API Key Section */}
                    <Box paddingTop={4} style={{ borderTop: "1px solid #eaeaef" }}>
                      <Typography variant="delta" fontWeight="bold" style={{ marginBottom: "8px" }}>
                        Web API Key Configuration
                      </Typography>
                      <Box marginBottom={3}>
                        <Typography variant="pi" textColor="neutral600" component="span">
                          <strong>Optional</strong> - Only needed for email/password login via emailLogin
                          endpoint
                        </Typography>
                      </Box>
                      <Flex gap={2} alignItems="center" justifyContent="space-between">
                        <Flex gap={2} alignItems="center">
                          {firebaseWebApiKey?.trim() && (
                            <Typography variant="omega" textColor="neutral600">
                              {`${firebaseWebApiKey.substring(0, 10)}...`}
                            </Typography>
                          )}
                          {firebaseWebApiKey?.trim() ? (
                            <Badge backgroundColor="success200" textColor="success700" size="S">
                              ✓ CONFIGURED
                            </Badge>
                          ) : (
                            <Badge backgroundColor="neutral200" textColor="neutral700" size="S">
                              NOT SET
                            </Badge>
                          )}
                        </Flex>
                        {/* Contextual Action Button */}
                        {firebaseWebApiKey?.trim() ? (
                          <Button variant="danger-light" size="S" onClick={handleRemoveWebApiKey}>
                            Delete Config
                          </Button>
                        ) : (
                          <Button variant="secondary" size="S" onClick={handleAddWebApiKey}>
                            + Add Web API Key
                          </Button>
                        )}
                      </Flex>
                    </Box>
                  </Box>
                </>
              );
            })()}
          </Box>

          {/* Section 2: Password Reset Configuration - Always Visible */}
          <Box padding={4} background="neutral0" borderRadius="4px" shadow="filterShadow" marginBottom={6}>
            <Typography variant="alpha" as="h2" style={{ display: "block", marginBottom: "8px" }}>
              Password Reset Settings
            </Typography>
            <Typography
              variant="omega"
              textColor="neutral600"
              style={{ display: "block", marginBottom: "24px" }}
            >
              Configure password requirements and email settings for password reset functionality
            </Typography>

            <Box marginBottom={3}>
              <Typography variant="omega" fontWeight="bold" style={{ display: "block", marginBottom: "8px" }}>
                Password Requirements (Regex)
              </Typography>
              <TextInput
                name="passwordRequirementsRegex"
                value={passwordRequirementsRegex}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPasswordRequirementsRegex(e.target.value)
                }
                placeholder="^.{6,}$"
                hint="Regular expression to validate password strength. Default: ^.{6,}$ (min 6 characters)"
              />
            </Box>

            <Box marginBottom={3}>
              <Typography variant="omega" fontWeight="bold" style={{ display: "block", marginBottom: "8px" }}>
                Password Requirements Message
              </Typography>
              <Textarea
                name="passwordRequirementsMessage"
                value={passwordRequirementsMessage}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setPasswordRequirementsMessage(e.target.value)
                }
                placeholder="Password must be at least 6 characters long"
                hint="Error message shown when password doesn't meet requirements"
              />
            </Box>

            {/* Helper Section for Common Patterns - Right below password requirements */}
            <Box marginBottom={4} padding={3} background="neutral100" borderRadius="4px">
              <Typography
                variant="omega"
                fontWeight="bold"
                style={{ display: "block", marginBottom: "12px" }}
              >
                Common Password Patterns:
              </Typography>
              <Box marginLeft={2}>
                <Typography variant="omega" style={{ display: "block", marginBottom: "8px" }}>
                  • <code>{"^.{6,}$"}</code> - Minimum 6 characters (simple)
                </Typography>
                <Typography variant="omega" style={{ display: "block", marginBottom: "8px" }}>
                  • <code>{"^.{8,}$"}</code> - Minimum 8 characters
                </Typography>
                <Typography variant="omega" style={{ display: "block", marginBottom: "8px" }}>
                  • <code>{"^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{8,}$"}</code> - At least 8 chars with letters
                  and numbers
                </Typography>
                <Typography variant="omega" style={{ display: "block" }}>
                  • <code>{"^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$"}</code> -
                  Complex (upper, lower, number, special)
                </Typography>
              </Box>
            </Box>

            <Box marginBottom={3}>
              <Typography variant="omega" fontWeight="bold" style={{ display: "block", marginBottom: "8px" }}>
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
              <Typography variant="omega" fontWeight="bold" style={{ display: "block", marginBottom: "8px" }}>
                Reset Email Subject
              </Typography>
              <TextInput
                name="passwordResetEmailSubject"
                value={passwordResetEmailSubject}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPasswordResetEmailSubject(e.target.value)
                }
                placeholder="Reset Your Password"
                hint="Subject line for password reset emails"
              />
            </Box>

            <Flex
              style={{
                marginTop: 24,
                width: "100%",
              }}
              justifyContent="flex-end"
            >
              <Button size="L" variant="secondary" onClick={handleSavePasswordSettings}>
                Save Password Settings
              </Button>
            </Flex>
          </Box>

          {/* Section 3: Email Verification */}
          <Box padding={4} background="neutral0" borderRadius="4px" shadow="filterShadow" marginBottom={6}>
            <Typography variant="alpha" as="h2" style={{ display: "block", marginBottom: "8px" }}>
              Email Verification
            </Typography>
            <Typography
              variant="omega"
              textColor="neutral600"
              style={{ display: "block", marginBottom: "24px" }}
            >
              Configure email verification settings for new user registration
            </Typography>

            <Box marginBottom={3}>
              <Typography variant="omega" fontWeight="bold" style={{ display: "block", marginBottom: "8px" }}>
                Email Verification URL *
              </Typography>
              <TextInput
                name="emailVerificationUrl"
                value={emailVerificationUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmailVerificationUrl(e.target.value)}
                placeholder="https://yourapp.com/verify-email"
                hint="URL where users will verify their email address (your frontend application)"
                required
              />
            </Box>

            <Box marginBottom={3}>
              <Typography variant="omega" fontWeight="bold" style={{ display: "block", marginBottom: "8px" }}>
                Verification Email Subject
              </Typography>
              <TextInput
                name="emailVerificationEmailSubject"
                value={emailVerificationEmailSubject}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEmailVerificationEmailSubject(e.target.value)
                }
                placeholder="Verify Your Email"
                hint="Subject line for email verification emails"
              />
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
                onClick={handleSaveEmailVerificationSettings}
                disabled={loading}
              >
                Save Email Verification Settings
              </Button>
            </Flex>
          </Box>

          {/* Section 4: Magic Link Settings */}
          <Box padding={4} background="neutral0" borderRadius="4px" shadow="filterShadow" marginBottom={6}>
            <Typography variant="alpha" as="h2" style={{ display: "block", marginBottom: "8px" }}>
              Magic Link Authentication
            </Typography>
            <Typography
              variant="omega"
              textColor="neutral600"
              style={{ display: "block", marginBottom: "24px" }}
            >
              Configure passwordless authentication via email magic links
            </Typography>

            {/* Enable/Disable Toggle */}
            <Box marginBottom={3}>
              <Flex alignItems="center" gap={2}>
                <Toggle
                  name="enableMagicLink"
                  label="Enable Magic Link Authentication"
                  checked={enableMagicLink}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnableMagicLink(e.target.checked)}
                  hint="Allow users to sign in using magic links sent to their email"
                />
                <Typography
                  variant="pi"
                  fontWeight="bold"
                  textColor={enableMagicLink ? "success700" : "neutral400"}
                >
                  {enableMagicLink ? "Active" : "Inactive"}
                </Typography>
              </Flex>
            </Box>

            {/* Show configuration only when enabled */}
            {enableMagicLink && (
              <>
                <Box marginBottom={3}>
                  <Typography
                    variant="omega"
                    fontWeight="bold"
                    style={{ display: "block", marginBottom: "8px" }}
                  >
                    Verification URL *
                  </Typography>
                  <TextInput
                    name="magicLinkUrl"
                    value={magicLinkUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMagicLinkUrl(e.target.value)}
                    placeholder="https://yourapp.com/verify-magic-link"
                    hint="URL where users complete magic link authentication (must handle client-side verification)"
                    required
                  />
                </Box>

                <Box marginBottom={3}>
                  <Typography
                    variant="omega"
                    fontWeight="bold"
                    style={{ display: "block", marginBottom: "8px" }}
                  >
                    Email Subject
                  </Typography>
                  <TextInput
                    name="magicLinkEmailSubject"
                    value={magicLinkEmailSubject}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setMagicLinkEmailSubject(e.target.value)
                    }
                    placeholder="Sign in to Your Application"
                    hint="Subject line for magic link emails"
                  />
                </Box>

                <Box marginBottom={3}>
                  <Typography
                    variant="omega"
                    fontWeight="bold"
                    style={{ display: "block", marginBottom: "8px" }}
                  >
                    Link Expiry (hours)
                  </Typography>
                  <NumberInput
                    name="magicLinkExpiryHours"
                    value={magicLinkExpiryHours}
                    onValueChange={(value: number) => setMagicLinkExpiryHours(value)}
                    min={1}
                    max={72}
                    hint="How long the magic link remains valid (1-72 hours)"
                  />
                </Box>

                {/* Helper Section */}
                <Box marginTop={4} padding={3} background="primary100" borderRadius="4px">
                  <Typography
                    variant="omega"
                    fontWeight="bold"
                    style={{ display: "block", marginBottom: "12px" }}
                  >
                    Setup Requirements:
                  </Typography>
                  <Box marginLeft={2}>
                    <Typography variant="omega" style={{ display: "block", marginBottom: "8px" }}>
                      1. <strong>Firebase Console:</strong> Enable "Email link (passwordless sign-in)" in
                      Authentication → Sign-in method
                    </Typography>
                    <Typography variant="omega" style={{ display: "block", marginBottom: "8px" }}>
                      2. <strong>Authorized Domains:</strong> Add your domain to Firebase authorized domains
                      list
                    </Typography>
                    <Typography variant="omega" style={{ display: "block", marginBottom: "8px" }}>
                      3. <strong>Verification Page:</strong> Deploy the client-side verification handler at
                      the URL above
                    </Typography>
                    <Typography variant="omega" style={{ display: "block", marginBottom: "8px" }}>
                      4. <strong>Email Service:</strong> Configure Strapi Email plugin or custom email hook
                    </Typography>
                  </Box>
                </Box>

                {/* Testing Information */}
                <Box marginTop={3} padding={3} background="neutral100" borderRadius="4px">
                  <Typography
                    variant="omega"
                    fontWeight="bold"
                    style={{ display: "block", marginBottom: "8px" }}
                  >
                    🧪 Testing:
                  </Typography>
                  <Typography variant="omega" style={{ display: "block" }}>
                    Test page available at:{" "}
                    <a href="/test-magic-link.html" target="_blank" rel="noreferrer">
                      /test-magic-link.html
                    </a>
                  </Typography>
                  <Typography variant="omega" style={{ display: "block", marginTop: "4px" }}>
                    In development mode, magic links are logged to the server console.
                  </Typography>
                </Box>
              </>
            )}

            <Flex
              style={{
                marginTop: 24,
                width: "100%",
              }}
              justifyContent="flex-end"
            >
              <Button size="L" variant="secondary" onClick={handleSaveMagicLinkSettings} disabled={loading}>
                Save Magic Link Settings
              </Button>
            </Flex>
          </Box>
        </Box>
      </Flex>

      {/* Add Web API Key Modal */}
      <Modal.Root open={showEditModal} onOpenChange={(open: boolean) => !open && setShowEditModal(false)}>
        <Modal.Content>
          <Modal.Header>
            <Modal.Title>Add Firebase Web API Key</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Box padding={4}>
              <Typography variant="omega" marginBottom={2}>
                Add your Firebase Web API Key to enable the emailLogin endpoint. This is optional and only
                needed if you want to authenticate users with email/password directly through your backend.
              </Typography>

              <Box marginTop={3}>
                <Typography
                  variant="omega"
                  fontWeight="bold"
                  style={{ display: "block", marginBottom: "8px" }}
                >
                  Firebase Web API Key (Optional)
                </Typography>
                <TextInput
                  name="editWebApiKey"
                  value={editWebApiKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditWebApiKey(e.target.value)}
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
                      Go to{" "}
                      <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">
                        Firebase Console
                      </a>
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="omega">Select your project</Typography>
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
            </Box>
          </Modal.Body>
          <Modal.Footer>
            <Flex justifyContent="flex-end" gap={2}>
              <Button variant="tertiary" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button variant="default" onClick={handleSaveEditConfiguration}>
                Add API Key
              </Button>
            </Flex>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </>
  );
}

export default SettingsPage;
