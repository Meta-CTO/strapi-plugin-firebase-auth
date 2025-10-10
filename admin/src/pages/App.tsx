import { Page } from "@strapi/strapi/admin";
import { Routes, Route } from "react-router-dom";
import { Provider as TooltipProvider } from "@radix-ui/react-tooltip";

import { HomePage } from "./HomePage";
import { EditView } from "./EditView";
import { CreateView } from "./CreateView";

const App = () => {
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={100}>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="users/create" element={<CreateView />} />
        <Route path=":id" element={<EditView />} />
        <Route path="*" element={<Page.Error />} />
      </Routes>
    </TooltipProvider>
  );
};

export { App };
export default App;
