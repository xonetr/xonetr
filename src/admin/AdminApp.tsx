import {BrowserRouter,Navigate,Outlet,Route,Routes,useLocation} from "react-router-dom";
import {AdminAuthProvider,useAdminAuth} from "./AuthContext";
import {AdminContentProvider} from "./AdminContentContext";
import {AdminLayout} from "./AdminLayout";
import {DashboardPage} from "./pages/DashboardPage";
import {PreviewPage} from "./pages/PreviewPage";
import {SectionEditorPage} from "./pages/SectionEditorPage";
import {LoginPage} from "./pages/LoginPage";
import {MediaPage} from "./pages/MediaPage";
import {HistoryPage} from "./pages/HistoryPage";
import {SettingsPage} from "./pages/SettingsPage";
import "./admin.css";

function ProtectedRoute(){const {session,loading}=useAdminAuth();const location=useLocation();if(loading)return <div className="admin-boot">Comprobando sesión…</div>;if(!session)return <Navigate to="/admin/login" replace state={{from:location.pathname}}/>;return <AdminContentProvider><Outlet/></AdminContentProvider>}

export default function AdminApp(){return <BrowserRouter><AdminAuthProvider><Routes><Route path="/admin/preview" element={<PreviewPage/>}/><Route path="/admin/login" element={<LoginPage/>}/><Route element={<ProtectedRoute/>}><Route path="/admin" element={<AdminLayout/>}><Route index element={<DashboardPage/>}/><Route path="editar/:section" element={<SectionEditorPage/>}/><Route path="medios" element={<MediaPage/>}/><Route path="historial" element={<HistoryPage/>}/><Route path="ajustes" element={<SettingsPage/>}/></Route></Route><Route path="*" element={<Navigate to="/admin" replace/>}/></Routes></AdminAuthProvider></BrowserRouter>}

