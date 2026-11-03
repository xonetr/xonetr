import {BrowserRouter,Navigate,Outlet,Route,Routes,useLocation} from "react-router-dom";
import {AdminAuthProvider,useAdminAuth} from "./AuthContext";
import {AdminContentProvider} from "./AdminContentContext";
import {AdminLayout} from "./AdminLayout";
import {ProjectActivityPage} from "./pages/ProjectActivityPage";
import {PreviewPage} from "./pages/PreviewPage";
import {SectionEditorPage} from "./pages/SectionEditorPage";
import {LoginPage} from "./pages/LoginPage";
import {MediaPage} from "./pages/MediaPage";
import {HistoryPage} from "./pages/HistoryPage";
import {SettingsPage} from "./pages/SettingsPage";
import {UsersPage} from "./pages/UsersPage";
import {AuthorizationsPage} from "./pages/AuthorizationsPage";
import "./admin.css";
import "./admin-mobile.css";

function ProtectedRoute(){const {session,loading}=useAdminAuth();const location=useLocation();if(loading)return <div className="admin-boot">Comprobando sesión…</div>;if(!session)return <Navigate to="/admin/login" replace state={{from:location.pathname}}/>;return <AdminContentProvider><Outlet/></AdminContentProvider>}

export default function AdminApp(){return <BrowserRouter><AdminAuthProvider><Routes><Route path="/admin/preview" element={<PreviewPage/>}/><Route path="/admin/login" element={<LoginPage/>}/><Route element={<ProtectedRoute/>}><Route path="/admin" element={<AdminLayout/>}><Route index element={<ProjectActivityPage/>}/><Route path="editar/:section" element={<SectionEditorPage/>}/><Route path="operaciones" element={<Navigate to="/admin" replace/>}/><Route path="tablero" element={<Navigate to="/admin" replace/>}/><Route path="usuarios" element={<UsersPage/>}/><Route path="medios" element={<MediaPage/>}/><Route path="historial" element={<HistoryPage/>}/><Route path="autorizaciones" element={<AuthorizationsPage/>}/><Route path="ajustes" element={<SettingsPage/>}/></Route></Route><Route path="*" element={<Navigate to="/admin" replace/>}/></Routes></AdminAuthProvider></BrowserRouter>}
