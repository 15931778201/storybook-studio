export type BookStatus = "draft" | "published";

export interface ElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: Record<string, string | number | boolean>;
}

export interface TextElement extends ElementBase {
  type: "text";
  payload: {
    text: string;
  };
}

export interface ImageElement extends ElementBase {
  type: "image";
  payload: {
    imageUrl: string;
    alt?: string;
  };
}

export type BookElement = TextElement | ImageElement;

export type HotspotActionType = "play_audio" | "jump_page";

export interface Hotspot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  trigger: "tap";
  actionType: HotspotActionType;
  actionPayload: {
    audioUrl?: string;
    targetPageNo?: number;
  };
}

export interface BookPage {
  id: string;
  pageNo: number;
  backgroundUrl?: string;
  narrationAudioUrl?: string;
  elements: BookElement[];
  hotspots: Hotspot[];
}

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  coverUrl: string;
  ageRange: string[];
  tags: string[];
  status: BookStatus;
  sourceType: "json_import";
  pageCount: number;
  pages?: BookPage[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface BookMetaInput {
  title: string;
  subtitle?: string;
  coverUrl: string;
  ageRange: string[];
  tags: string[];
}

export interface BookImportPayload {
  bookMeta: BookMetaInput;
  pages: BookPage[];
}

export type ReadingEventType =
  | "open_book"
  | "turn_page"
  | "tap_hotspot"
  | "play_audio"
  | "complete_book";

export interface ReadingEventInput {
  sessionId: string;
  bookId: string;
  pageNo?: number;
  eventType: ReadingEventType;
  eventPayload?: Record<string, unknown>;
  clientTs: string;
}

export interface ReadingEvent extends ReadingEventInput {
  id: string;
  serverTs: string;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  token: string;
  expiresIn: number;
}

export interface ApiErrorResponse {
  message: string;
  details?: unknown;
}
