export interface Note {
  id: string;
  title: string;
  content: string;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  font_size: number;
  is_visible: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}
