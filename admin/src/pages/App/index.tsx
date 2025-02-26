import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { HomePage } from '../HomePage';
import { PLUGIN_ID } from '../../pluginId';

export const App = () => {
  return (
    <Routes>
      <Route path={`/plugins/${PLUGIN_ID}`} element={<HomePage />} />
    </Routes>
  );
}; 