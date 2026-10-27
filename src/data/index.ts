import type {ContentRepository} from "./ContentRepository";
import {CloudflareContentRepository} from "./CloudflareContentRepository";
import {LocalContentRepository} from "./LocalContentRepository";

// Único punto de selección del backend de contenido.
const backend=(import.meta.env.VITE_CONTENT_BACKEND||"local").toLowerCase();

export const contentRepository:ContentRepository=backend==="cloudflare"
  ?new CloudflareContentRepository()
  :new LocalContentRepository();

export type {ContentRepository,MediaInfo,VersionInfo} from "./ContentRepository";

