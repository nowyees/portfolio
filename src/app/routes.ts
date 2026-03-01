import { createBrowserRouter } from "react-router";
import Home from "./components/Home";
import PortfolioDetail from "./components/PortfolioDetail";
import AdminPage from "./components/AdminPage";

export const router = createBrowserRouter([
  { path: "/", Component: Home },
  { path: "/portfolio/:category", Component: PortfolioDetail },
  { path: "/admin", Component: AdminPage },
]);
