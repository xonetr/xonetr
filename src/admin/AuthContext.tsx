import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {authProvider,type AuthSession} from "../auth";

type AuthContextValue={session:AuthSession|null;loading:boolean;login:(email:string,password:string)=>Promise<void>;logout:()=>Promise<void>};
const AuthContext=createContext<AuthContextValue|null>(null);
const authEnabled=import.meta.env.VITE_ADMIN_AUTH==="true";
const temporarySession=():AuthSession=>({email:"acceso-temporal@xonetr.local",name:"Administrador",signedInAt:new Date().toISOString()});

export function AdminAuthProvider({children}:{children:ReactNode}){
  const [session,setSession]=useState<AuthSession|null>(null);const [loading,setLoading]=useState(true);
  useEffect(()=>{if(!authEnabled){setSession(temporarySession());setLoading(false);return}void authProvider.getSession().then(setSession).finally(()=>setLoading(false))},[]);
  const value=useMemo<AuthContextValue>(()=>({session,loading,async login(email,password){setSession(authEnabled?await authProvider.login(email,password):temporarySession())},async logout(){if(authEnabled){await authProvider.logout();setSession(null)}else setSession(temporarySession())}}),[session,loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth(){const value=useContext(AuthContext);if(!value)throw new Error("useAdminAuth debe usarse dentro de AdminAuthProvider.");return value}

