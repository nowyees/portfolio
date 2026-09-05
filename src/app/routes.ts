import { createBrowserRouter } from "react-router";
import Home from "./components/Home";
import Projects from "./components/Projects";
import About from "./components/About";
import ProjectDetail from "./components/ProjectDetail";
import AdminPage from "./components/AdminPage";
import FreeDive from "./components/FreeDive";

export const router = createBrowserRouter([
  { path: "/", Component: Home },
  { path: "/projects", Component: Projects },
  { path: "/about", Component: About },
  { path: "/project/:category/:id", Component: ProjectDetail },
  { path: "/admin", Component: AdminPage },
  { path: "/freedive", Component: FreeDive },
]);
