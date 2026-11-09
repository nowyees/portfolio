import { createBrowserRouter, redirect } from "react-router";
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
  // The review index is local-only; public Projects keeps its original layout.
  ...(import.meta.env.DEV ? [{ path: "/drafts/editorial", lazy: async () => ({ Component: (await import("./components/EditorialDraftIndex")).default }) }] : []),
  // local-only: the Visitors page filled with made-up visits, to review its charts without signing in
  ...(import.meta.env.DEV ? [{ path: "/drafts/visitors", lazy: async () => ({ Component: (await import("./components/AdminVisitorsDemo")).default }) }] : []),
  { path: "/admin", Component: AdminPage },
  { path: "/admin/visitors", lazy: async () => ({ Component: (await import("./components/AdminVisitors")).default }) },
  { path: "/freedive", Component: FreeDive },
  // three.js only loads when this route is visited
  // Lab: the experiment index, and each live rig on its own page (three.js loads only there); /motion was its old name
  { path: "/lab", lazy: async () => ({ Component: (await import("./components/Lab")).default }) },
  { path: "/lab/:id", lazy: async () => ({ Component: (await import("./components/MotionGallery")).default }) },
  { path: "/motion/:id?", loader: ({ params }) => redirect(params.id ? "/lab/" + params.id : "/lab") },
  // Blender robot-hand car scene, real-time (three.js loads only here)
  { path: "/lab/robot", lazy: async () => ({ Component: (await import("./components/RobotLab")).default }) },
]);
