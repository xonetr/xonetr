import type {AuthProvider,AuthSession} from "./AuthProvider";

const SESSION_KEY="xonetr.admin.mock-session";

/**
 * ATENCIÓN: ESTA AUTENTICACIÓN ES SOLO UNA SIMULACIÓN DE INTERFAZ Y NO PROTEGE NADA.
 * Antes de publicar el sitio debe reemplazarse por autenticación real validada en el servidor,
 * con cookies seguras, expiración, permisos y protección de todas las operaciones de contenido.
 */
export class MockAuthProvider implements AuthProvider{
  async login(email:string,password:string){
    await new Promise(resolve=>window.setTimeout(resolve,450));
    const expectedEmail=import.meta.env.VITE_ADMIN_EMAIL as string|undefined;
    const expectedPassword=import.meta.env.VITE_ADMIN_PASSWORD as string|undefined;
    if(!expectedEmail||!expectedPassword)throw new Error("Configura las credenciales de demostración en .env.local.");
    if(email!==expectedEmail||password!==expectedPassword)throw new Error("El correo o la contraseña no son correctos.");
    const session:AuthSession={email,signedInAt:new Date().toISOString()};
    sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
    return session;
  }
  async logout(){sessionStorage.removeItem(SESSION_KEY)}
  async getSession(){
    try{const raw=sessionStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw) as AuthSession:null}catch{return null}
  }
}

