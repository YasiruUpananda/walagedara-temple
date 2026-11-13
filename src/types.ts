export interface PublicAd {
  id: string;
  type: "image" | "text";
  image_url: string | null;
  heading: string | null;
  message: string | null;
  duration_seconds: number;
  display_order: number;
}
export interface Advertisement extends PublicAd {
  title: string;
  storage_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface DisplayState {
  id: 1;
  current_number: number;
  service_paused?: boolean;
  active_ads: PublicAd[];
  revision: number;
  updated_at: string;
}
