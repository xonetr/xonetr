import {lazy,StrictMode,Suspense} from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import {ContentProvider} from "./content/ContentProvider";
import "./styles.css";
import "./hero-adjustments.css";
import "./orbit-animation.css";
import "./team-socials.css";

const isAdminRoute=window.location.pathname.startsWith("/admin");
document.documentElement.classList.add("scrollbar-custom");
const AdminApp=lazy(()=>import("./admin/AdminApp"));
if(isAdminRoute){
  const robots=document.querySelector<HTMLMetaElement>('meta[name="robots"]')??document.head.appendChild(document.createElement("meta"));
  robots.name="robots";robots.content="noindex, nofollow";
}

createRoot(document.getElementById("root")!).render(<StrictMode>{isAdminRoute?<Suspense fallback={<div className="admin-boot">Cargando panel…</div>}><AdminApp/></Suspense>:<ContentProvider><App/></ContentProvider>}</StrictMode>);
