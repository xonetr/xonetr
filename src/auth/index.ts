import type {AuthProvider} from "./AuthProvider";
import {MockAuthProvider} from "./MockAuthProvider";
import {ApiAuthProvider} from "./ApiAuthProvider";

// TODO(PRODUCCIÓN): reemplazar por un proveedor que hable con un servidor y use una sesión segura.
export const authProvider:AuthProvider=(import.meta.env.VITE_ADMIN_AUTH_BACKEND||"mock")==="api"
  ?new ApiAuthProvider()
  :new MockAuthProvider();
export type {AuthProvider,AuthSession} from "./AuthProvider";
