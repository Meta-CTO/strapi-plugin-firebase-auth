/**
 *
 * This component is the skeleton around the actual pages, and should only
 * contain code that should be seen on all pages. (e.g. navigation bar)
 *
 */

import React from "react";
import { Routes, Route } from "react-router-dom";
import { Page } from '@strapi/strapi/admin';
import { DesignSystemProvider } from '@strapi/design-system';
import pluginPermissions from "../../utils/permissions";
import pluginId from "../../pluginId";
import { HomePage } from "../HomePage/HomePage";
import { EditView } from "../EditView/EditView";
import { CreateView } from "../CreateView/CreateView";
import ErrorBoundary from '../../components/ErrorBoundary';
import SettingsPage from "../Settings";

const App = () => {
  return (
    <DesignSystemProvider>
      <Page.Protect permissions={pluginPermissions.main}>
        <Routes>
          <Route path={`/plugins/${pluginId}`} element={<HomePage />} />
          <Route path={`/plugins/${pluginId}/:id`} element={<EditView />} />
          <Route
            path={`/plugins/${pluginId}/users/create`}
            element={<CreateView />}
          />
          <Route 
            path={`/settings/${pluginId}`} 
            element={
              <ErrorBoundary>
                <SettingsPage />
              </ErrorBoundary>
            } 
          />
          <Route path="*" element={<Page.Error />} />
        </Routes>
      </Page.Protect>
    </DesignSystemProvider>
  );
};

export default App;
