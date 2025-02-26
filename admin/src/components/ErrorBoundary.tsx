import React from 'react';
import { Box, Typography } from '@strapi/design-system';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    console.log('ErrorBoundary: Caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary Details:', {
      error,
      errorInfo,
      componentStack: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box padding={4}>
          <Typography variant="beta">Something went wrong</Typography>
          <pre>{this.state.error?.toString()}</pre>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary; 