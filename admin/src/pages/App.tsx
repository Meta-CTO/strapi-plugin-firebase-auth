import { Page } from "@strapi/strapi/admin";
import { Routes, Route } from "react-router-dom";

import { HomePage } from "./HomePage";
import { EditView } from "./EditView";
import { CreateView } from "./CreateView";

const App = () => {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="users/create" element={<CreateView />} />
      <Route path=":id" element={<EditView />} />
      <Route path="*" element={<Page.Error />} />
    </Routes>
  );
};

export { App };
export default App;
