export type AuthSession={email:string;signedInAt:string;id?:string;name?:string;role?:string};

export interface AuthProvider{
  login(email:string,password:string):Promise<AuthSession>;
  logout():Promise<void>;
  getSession():Promise<AuthSession|null>;
}

