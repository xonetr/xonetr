import {z} from "zod";

export function isSafeContentLink(value:string){if(value.startsWith("#")||value.startsWith("/"))return true;try{const url=new URL(value);return ["https:","http:","mailto:","tel:"].includes(url.protocol)&&(url.protocol!=="https:"||url.hostname!=="wa.me"||/^\/\d+$/.test(url.pathname))}catch{return false}}
const linkSchema=z.string().min(1).refine(isSafeContentLink,"El enlace no usa un protocolo permitido.");
const optionalLinkSchema=z.string().refine(value=>!value||isSafeContentLink(value),"El enlace no usa un protocolo permitido.");
const optionalAssetSchema=z.string().optional();
const imageEditSchema=z.object({
  original:z.string(),
  crop:z.object({crop:z.object({x:z.number(),y:z.number()}),zoom:z.number(),rotation:z.number(),flipH:z.boolean(),flipV:z.boolean(),aspect:z.number().nullable(),area:z.object({x:z.number(),y:z.number(),width:z.number(),height:z.number()}).optional()}),
  width:z.number().int().positive(),height:z.number().int().positive(),size:z.number().int().nonnegative(),mime:z.string(),
}).optional();

export const siteContentSchema=z.object({
  brand:z.object({name:z.string().min(1),legalName:z.string().min(1)}),
  navigation:z.array(z.object({label:z.string().min(1),href:linkSchema})),
  hero:z.object({
    eyebrow:z.string(),
    title:z.object({lead:z.string(),emphasis:z.string(),tail:z.string()}),
    description:z.string(),
    primaryCta:z.object({label:z.string(),href:linkSchema}),
    secondaryCta:z.object({label:z.string(),href:linkSchema}),
    background:z.object({video:optionalAssetSchema,poster:optionalAssetSchema,alt:z.string(),posterEdit:imageEditSchema}).optional(),
  }),
  whatWeDo:z.object({
    eyebrow:z.string(),title:z.string(),description:z.string(),
    codeSamples:z.array(z.object({language:z.string(),status:z.string(),filename:z.string(),code:z.string(),support:z.object({label:z.string(),description:z.string()})})).length(2),
  }),
  services:z.object({
    eyebrow:z.string(),title:z.string(),intro:z.string(),
    items:z.array(z.object({number:z.string(),title:z.string(),description:z.string(),features:z.array(z.string()),cta:z.object({label:z.string(),href:linkSchema}).optional()})),
  }),
  process:z.object({
    eyebrow:z.string(),title:z.string(),description:z.string(),cta:z.object({label:z.string(),href:linkSchema}).optional(),
    steps:z.array(z.object({number:z.string(),title:z.string(),duration:z.string(),description:z.string()})),
  }),
  projects:z.object({
    eyebrow:z.string(),title:z.string(),filters:z.array(z.string()),
    items:z.array(z.object({title:z.string(),category:z.string(),description:z.string(),accent:z.enum(["violet","indigo","blue","lavender"]),image:optionalAssetSchema,imageAlt:z.string().optional(),imageEdit:imageEditSchema,url:optionalLinkSchema.optional(),visible:z.boolean().optional()})),
  }),
  pricing:z.object({
    enabled:z.boolean(),eyebrow:z.string(),title:z.string(),intro:z.string(),
    plans:z.array(z.object({name:z.string(),priceFrom:z.string(),features:z.array(z.string()),buttonLabel:z.string(),buttonHref:linkSchema,featured:z.boolean()})),
  }).optional(),
  team:z.object({
    eyebrow:z.string(),title:z.string(),
    members:z.array(z.object({name:z.string(),initials:z.string(),role:z.string(),bio:z.string(),photo:optionalAssetSchema,photoAlt:z.string().optional(),photoEdit:imageEditSchema,links:z.array(z.object({label:z.string(),href:optionalLinkSchema})).optional()})),
  }),
  purpose:z.object({eyebrow:z.string(),title:z.string(),description:z.string(),principles:z.array(z.object({number:z.string(),label:z.string(),description:z.string()}))}),
  faq:z.object({eyebrow:z.string(),title:z.string(),prompt:z.string(),cta:z.object({label:z.string(),href:linkSchema}),items:z.array(z.object({question:z.string(),answer:z.string()}))}),
  contact:z.object({
    eyebrow:z.string(),title:z.string(),description:z.string(),email:z.string().email(),whatsappLabel:z.string(),whatsappHref:linkSchema,
    phone:z.string().optional(),submitLabel:z.string().optional(),successMessage:z.string().optional(),
  }),
  footer:z.object({description:z.string(),socials:z.array(z.object({label:z.string(),href:optionalLinkSchema})),columns:z.array(z.object({title:z.string(),links:z.array(z.object({label:z.string(),href:linkSchema}))})).optional()}),
  legal:z.object({
    privacy:z.object({title:z.string(),date:z.string(),paragraphs:z.array(z.string())}),
    terms:z.object({title:z.string(),date:z.string(),paragraphs:z.array(z.string())}),
  }),
  settings:z.object({
    siteTitle:z.string(),metaDescription:z.string(),ogImage:optionalAssetSchema,ogImageEdit:imageEditSchema,logo:optionalAssetSchema,logoEdit:imageEditSchema,favicon:optionalAssetSchema,faviconEdit:imageEditSchema,
    menuAction:z.object({label:z.string(),href:linkSchema}),
  }).optional(),
});

export type SiteContent=z.infer<typeof siteContentSchema>;

