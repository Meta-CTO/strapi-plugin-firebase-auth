import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Flex,
  Badge,
  Loader,
  SingleSelect,
  SingleSelectOption,
  TextInput,
  Button,
  IconButton,
} from "@strapi/design-system";
import { ChevronDown, ChevronRight } from "@strapi/icons";
import { format } from "date-fns";
import styled from "styled-components";
import { fetchActivityLogs } from "../../pages/utils/api";

const LogItem = styled(Box)`
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral200};
  padding: 12px 0;

  &:last-child {
    border-bottom: none;
  }
`;

const FilterRow = styled(Flex)`
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
`;

const ScrollContainer = styled(Box)`
  max-height: calc(100vh - 500px);
  min-height: 200px;
  overflow-y: auto;
  padding-right: 12px;
`;

const PaginationRow = styled(Flex)`
  margin-top: 16px;
  justify-content: center;
  gap: 8px;
`;

const ExpandableDetails = styled(Box)`
  margin-top: 8px;
  padding: 12px;
  background: ${({ theme }) => theme.colors.neutral100};
  border-radius: 4px;
  text-align: left;
  width: 100%;
`;

const ResponseBodyContainer = styled(Box)`
  margin-top: 8px;
  padding: 8px;
  background: ${({ theme }) => theme.colors.neutral0};
  border-radius: 4px;
  max-height: 300px;
  overflow: auto;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
`;

interface ActivityLogProps {
  firebaseUserId: string;
}

interface ActivityLogEntry {
  documentId: string;
  firebaseUserId: string;
  strapiUserId?: string;
  activityType: string;
  action: string;
  endpoint?: string;
  method?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  performedBy?: string;
  performedByType?: string;
  createdAt: string;
}

interface ActivityLogResponse {
  data: ActivityLogEntry[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
}

const ACTIVITY_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "authentication", label: "Authentication" },
  { value: "tokenValidation", label: "Token Validation" },
  { value: "fieldUpdate", label: "Field Update" },
  { value: "passwordReset", label: "Password Reset" },
  { value: "emailVerification", label: "Email Verification" },
  { value: "accountCreation", label: "Account Creation" },
  { value: "accountDeletion", label: "Account Deletion" },
  { value: "adminAction", label: "Admin Action" },
];

const getActivityTypeBadgeColor = (activityType: string): string => {
  switch (activityType) {
    case "authentication":
      return "primary600";
    case "tokenValidation":
      return "secondary600";
    case "fieldUpdate":
      return "warning600";
    case "passwordReset":
      return "danger600";
    case "emailVerification":
      return "success600";
    case "adminAction":
      return "alternative600";
    case "accountCreation":
      return "success600";
    case "accountDeletion":
      return "danger600";
    default:
      return "neutral600";
  }
};

const formatActivityType = (type: string): string => {
  return type.replace(/([A-Z])/g, " $1").trim();
};

const ActivityLog: React.FC<ActivityLogProps> = ({ firebaseUserId }) => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    activityType: "all",
    startDate: "",
    endDate: "",
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const pageSize = 10;

  const toggleExpand = useCallback((documentId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }
      return next;
    });
  }, []);

  const hasExpandableContent = useCallback((log: ActivityLogEntry) => {
    return log.metadata?.responseBody || log.endpoint || log.userAgent;
  }, []);

  const loadLogs = useCallback(async () => {
    if (!firebaseUserId) return;

    setIsLoading(true);
    try {
      const response: ActivityLogResponse = await fetchActivityLogs(firebaseUserId, {
        page,
        pageSize,
        filters: {
          activityType: filters.activityType !== "all" ? filters.activityType : undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        },
      });

      setLogs(response.data || []);
      setTotalPages(Math.ceil((response.meta?.total || 0) / pageSize));
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [firebaseUserId, page, pageSize, filters]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleFilterChange = useCallback((field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1); // Reset to first page when filters change
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      activityType: "all",
      startDate: "",
      endDate: "",
    });
    setPage(1);
  }, []);

  const renderChanges = (changes: Record<string, { old: any; new: any }>) => {
    return Object.entries(changes).map(([field, { old: oldVal, new: newVal }]) => (
      <Flex key={field} gap={2} marginTop={1} alignItems="center" wrap="nowrap">
        <Typography variant="pi" textColor="neutral600" style={{ minWidth: "100px" }}>
          {field}:
        </Typography>
        <Typography variant="pi" textColor="danger600" style={{ textDecoration: "line-through" }}>
          {String(oldVal ?? "none")}
        </Typography>
        <Typography variant="pi" textColor="neutral600">
          →
        </Typography>
        <Typography variant="pi" textColor="success600">
          {String(newVal ?? "none")}
        </Typography>
      </Flex>
    ));
  };

  return (
    <Box>
      <Typography variant="sigma" textColor="neutral600" marginBottom={3}>
        Activity History
      </Typography>

      {/* Filters */}
      <FilterRow>
        <Box style={{ minWidth: "150px" }}>
          <SingleSelect
            label="Activity Type"
            value={filters.activityType}
            onChange={(value: string) => handleFilterChange("activityType", value)}
            size="S"
          >
            {ACTIVITY_TYPE_OPTIONS.map((option) => (
              <SingleSelectOption key={option.value} value={option.value}>
                {option.label}
              </SingleSelectOption>
            ))}
          </SingleSelect>
        </Box>
        <Box style={{ minWidth: "140px" }}>
          <TextInput
            label="Start Date"
            type="date"
            value={filters.startDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleFilterChange("startDate", e.target.value)
            }
            size="S"
          />
        </Box>
        <Box style={{ minWidth: "140px" }}>
          <TextInput
            label="End Date"
            type="date"
            value={filters.endDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleFilterChange("endDate", e.target.value)
            }
            size="S"
          />
        </Box>
        <Box style={{ alignSelf: "flex-end" }}>
          <Button variant="tertiary" size="S" onClick={handleClearFilters}>
            Clear
          </Button>
        </Box>
      </FilterRow>

      {/* Loading State */}
      {isLoading ? (
        <Flex justifyContent="center" padding={4}>
          <Loader small>Loading activity logs...</Loader>
        </Flex>
      ) : logs.length === 0 ? (
        <Typography variant="pi" textColor="neutral600">
          No activity logs found.
        </Typography>
      ) : (
        <>
          {/* Log List */}
          <ScrollContainer>
            {logs.map((log) => (
              <LogItem key={log.documentId}>
                <Flex justifyContent="space-between" alignItems="flex-start">
                  <Flex direction="column" gap={1} alignItems="flex-start" style={{ flex: 1 }}>
                    <Flex gap={2} alignItems="center" wrap="wrap">
                      <Badge textColor={getActivityTypeBadgeColor(log.activityType)} size="S">
                        {formatActivityType(log.activityType)}
                      </Badge>
                      {/* Only show action for non-fieldUpdate types */}
                      {log.activityType !== "fieldUpdate" && (
                        <Typography variant="omega" fontWeight="semiBold">
                          {log.action}
                        </Typography>
                      )}
                      {/* Status code badge */}
                      {log.metadata?.statusCode && (
                        <Badge
                          textColor={log.metadata.statusCode >= 400 ? "danger600" : "success600"}
                          size="S"
                        >
                          {log.metadata.statusCode}
                        </Badge>
                      )}
                      {!log.success && (
                        <Badge textColor="danger600" size="S">
                          Failed
                        </Badge>
                      )}
                    </Flex>

                    {/* Field Changes */}
                    {log.changes && Object.keys(log.changes).length > 0 && (
                      <Box marginTop={1}>{renderChanges(log.changes)}</Box>
                    )}

                    {/* Error Message */}
                    {log.errorMessage && (
                      <Typography variant="pi" textColor="danger600" marginTop={1}>
                        Error: {log.errorMessage}
                      </Typography>
                    )}

                    {/* Expand/Collapse Button - below error message */}
                    {hasExpandableContent(log) && (
                      <Button
                        onClick={() => toggleExpand(log.documentId)}
                        variant="ghost"
                        size="S"
                        startIcon={expandedRows.has(log.documentId) ? <ChevronDown /> : <ChevronRight />}
                      >
                        {expandedRows.has(log.documentId) ? "Hide details" : "Show details"}
                      </Button>
                    )}

                    {/* Expandable Details Section */}
                    {expandedRows.has(log.documentId) && hasExpandableContent(log) && (
                      <ExpandableDetails>
                        <Flex direction="column" gap={2} alignItems="flex-start">
                          {log.endpoint && (
                            <Typography variant="pi" textColor="neutral600">
                              <strong>Endpoint:</strong> {log.method} {log.endpoint}
                            </Typography>
                          )}
                          {log.metadata?.responseTime && (
                            <Typography variant="pi" textColor="neutral600">
                              <strong>Response Time:</strong> {log.metadata.responseTime}ms
                            </Typography>
                          )}
                          {log.metadata?.statusCode && (
                            <Typography variant="pi" textColor="neutral600">
                              <strong>Status Code:</strong> {log.metadata.statusCode}
                            </Typography>
                          )}
                          {log.userAgent && (
                            <Typography variant="pi" textColor="neutral600">
                              <strong>User Agent:</strong> {log.userAgent}
                            </Typography>
                          )}
                          {log.ipAddress && (
                            <Typography variant="pi" textColor="neutral600">
                              <strong>IP Address:</strong> {log.ipAddress}
                            </Typography>
                          )}
                          {/* Response Body */}
                          {log.metadata?.responseBody && (
                            <Box marginTop={2}>
                              <Typography variant="pi" textColor="neutral600" fontWeight="semiBold">
                                Response:
                              </Typography>
                              <ResponseBodyContainer>
                                {JSON.stringify(log.metadata.responseBody, null, 2)}
                              </ResponseBodyContainer>
                            </Box>
                          )}
                        </Flex>
                      </ExpandableDetails>
                    )}
                  </Flex>

                  {/* Timestamp */}
                  <Typography variant="pi" textColor="neutral500">
                    {format(new Date(log.createdAt), "yyyy/MM/dd HH:mm")}
                  </Typography>
                </Flex>
              </LogItem>
            ))}
          </ScrollContainer>

          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationRow>
              <Button
                variant="tertiary"
                size="S"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Typography variant="pi" textColor="neutral600">
                Page {page} of {totalPages}
              </Typography>
              <Button
                variant="tertiary"
                size="S"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </PaginationRow>
          )}
        </>
      )}
    </Box>
  );
};

export default ActivityLog;
