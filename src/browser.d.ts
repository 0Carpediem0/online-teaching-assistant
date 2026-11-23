declare const chrome: {
 runtime: {onMessage: {addListener(cb:(m:{type?:string;command?:string;value?:boolean;request?:unknown},sender:unknown,reply:(value:unknown)=>void)=>void|boolean):void};sendMessage(message:unknown):Promise<any>};
 storage: {local: {get(keys:string[]):Promise<Record<string,unknown>>;set(items:Record<string,unknown>):Promise<void>}};
 permissions: {request(options:{origins:string[]}):Promise<boolean>};
 tabs: {
  query(options:{active:boolean;currentWindow:boolean}):Promise<Array<{id?:number}>>;
  sendMessage(id:number,message:{type:string;command:string;value?:boolean},options:{frameId:number}):Promise<unknown>;
 };
};
