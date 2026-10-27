import type {AuthProvider} from "./AuthProvider";
import {MockAuthProvider} from "./MockAuthProvider";

// TODO(PRODUCCIÓN): reemplazar por un proveedor que hable con un servidor y use una sesión segura.
export const authProvider:AuthProvider=new MockAuthProvider();
export type {AuthProvider,AuthSession} from "./AuthProvider";

