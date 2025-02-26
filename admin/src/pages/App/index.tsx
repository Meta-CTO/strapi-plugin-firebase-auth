/**
 *
 * This component is the skeleton around the actual pages, and should only
 * contain code that should be seen on all pages. (e.g. navigation bar)
 *
 */

import React from "react";
import { Routes, Route } from "react-router-dom";

import { Page } from '@strapi/strapi/admin';
import pluginPermissions from "../../utils/permissions";
import pluginId from "../../pluginId";
import { HomePage } from "../HomePage/HomePage";
import { EditView } from "../EditView/EditView";
import { CreateView } from "../CreateView/CreateView";

const App = () => {
  return (
    <Page.Protect  permissions={pluginPermissions.main}>
      <Routes>
        <Route path={`/plugins/${pluginId}`} element={<HomePage />} />
        <Route path={`/plugins/${pluginId}/:id`} element={<EditView />} />
        <Route
          path={`/plugins/${pluginId}/users/create`}
          element={<CreateView />}
        />
        <Route path="*" element={<Page.Error />} />
      </Routes>
    </Page.Protect >
  );
};

export default App;
