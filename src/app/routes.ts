import { createBrowserRouter } from "react-router";
import Home from "./components/Home";
import PortfolioDetail from "./components/PortfolioDetail";
import AdminPage from "./components/AdminPage";
import FreeDive from "./components/FreeDive";

export const router = createBrowserRouter([
  { path: "/", Component: Home },
  { path: "/portfolio/:category", Component: PortfolioDetail },
  { path: "/admin", Component: AdminPage },
  { path: "/freedive", Component: FreeDive },
]);
