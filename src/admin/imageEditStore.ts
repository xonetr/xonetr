import type {SiteContent} from "../content/schema";
import type {ImageEditMetadata} from "./components/image-editor/types";

const EDITS_KEY="xonetr.image-edits";
type EditMap=Record<string,ImageEditMetadata>;

function readAll():EditMap{try{return JSON.parse(localStorage.getItem(EDITS_KEY)??"{}") as EditMap}catch{return{}}}
function writeAll(edits:EditMap){try{localStorage.setItem(EDITS_KEY,JSON.stringify(edits))}catch{/* El repositorio informa por separado los errores de cuota. */}}

export function readImageEdit(url:string){return readAll()[url]}
export function storeImageEdit(url:string,edit:ImageEditMetadata){writeAll({...readAll(),[url]:edit})}

export function seedImageEdits(content:SiteContent){
  const edits=readAll();
  const add=(url:string|undefined,edit:ImageEditMetadata|undefined)=>{if(url&&edit)edits[url]=edit};
  add(content.hero.background?.poster,content.hero.background?.posterEdit);
  content.projects.items.forEach(item=>add(item.image,item.imageEdit));
  content.team.members.forEach(member=>add(member.photo,member.photoEdit));
  add(content.settings?.ogImage,content.settings?.ogImageEdit);
  add(content.settings?.logo,content.settings?.logoEdit);
  add(content.settings?.favicon,content.settings?.faviconEdit);
  writeAll(edits);
}

export function attachImageEdits(content:SiteContent):SiteContent{
  const edits=readAll();const find=(url:string|undefined,current:ImageEditMetadata|undefined)=>current??(url?edits[url]:undefined);
  return{
    ...content,
    hero:{...content.hero,background:content.hero.background?{...content.hero.background,posterEdit:find(content.hero.background.poster,content.hero.background.posterEdit)}:undefined},
    projects:{...content.projects,items:content.projects.items.map(item=>({...item,imageEdit:find(item.image,item.imageEdit)}))},
    team:{...content.team,members:content.team.members.map(member=>({...member,photoEdit:find(member.photo,member.photoEdit)}))},
    settings:content.settings?{...content.settings,ogImageEdit:find(content.settings.ogImage,content.settings.ogImageEdit),logoEdit:find(content.settings.logo,content.settings.logoEdit),faviconEdit:find(content.settings.favicon,content.settings.faviconEdit)}:undefined,
  };
}

