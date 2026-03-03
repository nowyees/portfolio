import { createBrowserRouter } from "react-router";
import Home from "./components/Home";
import ProjectDetail from "./components/ProjectDetail";
import AdminPage from "./components/AdminPage";
import FreeDive from "./components/FreeDive";

export const router = createBrowserRouter([
  { path: "/", Component: Home },
  { path: "/project/:category/:id", Component: ProjectDetail },
  { path: "/admin", Component: AdminPage },
  { path: "/freedive", Component: FreeDive },
]);
