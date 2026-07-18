export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      bill_categories: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      bill_line_items: {
        Row: {
          amount: number;
          bill_participant_id: string;
          category_id: string;
          created_at: string;
          id: string;
        };
        Insert: {
          amount: number;
          bill_participant_id: string;
          category_id: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          amount?: number;
          bill_participant_id?: string;
          category_id?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [];
      };
      bill_participants: {
        Row: {
          bill_id: string;
          created_at: string;
          id: string;
          owed_amount: number;
          participant_id: string;
          split_method: "automatic" | "breakdown" | "explicit";
          updated_at: string;
        };
        Insert: {
          bill_id: string;
          created_at?: string;
          id?: string;
          owed_amount: number;
          participant_id: string;
          split_method: "automatic" | "breakdown" | "explicit";
          updated_at?: string;
        };
        Update: {
          bill_id?: string;
          created_at?: string;
          id?: string;
          owed_amount?: number;
          participant_id?: string;
          split_method?: "automatic" | "breakdown" | "explicit";
          updated_at?: string;
        };
        Relationships: [];
      };
      bills: {
        Row: {
          biller_id: string;
          category_id: string;
          created_at: string;
          description: string;
          id: string;
          incurred_on: string;
          status: "open" | "settled";
          total_amount: number;
          updated_at: string;
        };
        Insert: {
          biller_id: string;
          category_id: string;
          created_at?: string;
          description: string;
          id?: string;
          incurred_on: string;
          status?: "open" | "settled";
          total_amount: number;
          updated_at?: string;
        };
        Update: {
          biller_id?: string;
          category_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          incurred_on?: string;
          status?: "open" | "settled";
          total_amount?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          full_name: string;
          id: string;
          is_admin: boolean;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          full_name: string;
          id: string;
          is_admin?: boolean;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          full_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      can_read_bill: {
        Args: { target_bill_id: string };
        Returns: boolean;
      };
      create_bill: {
        Args: {
          p_category_id: string | null;
          p_custom_category: string | null;
          p_description: string;
          p_incurred_on: string;
          p_participants: Json;
          p_total_amount: number;
        };
        Returns: string;
      };
      is_bill_biller: {
        Args: { target_bill_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
