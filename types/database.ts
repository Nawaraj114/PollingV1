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
          auth_method: "password" | "webauthn" | null;
          auth_status: "authenticated" | "disputed" | "pending";
          authenticated_at: string | null;
          bill_id: string;
          confirmed_at: string | null;
          created_at: string;
          dispute_note: string | null;
          disputed_at: string | null;
          id: string;
          owed_amount: number;
          paid_at: string | null;
          participant_id: string;
          payment_status: "confirmed_paid" | "marked_paid" | "unpaid";
          split_method: "automatic" | "breakdown" | "explicit";
          updated_at: string;
        };
        Insert: {
          auth_method?: "password" | "webauthn" | null;
          auth_status?: "authenticated" | "disputed" | "pending";
          authenticated_at?: string | null;
          bill_id: string;
          confirmed_at?: string | null;
          created_at?: string;
          dispute_note?: string | null;
          disputed_at?: string | null;
          id?: string;
          owed_amount: number;
          paid_at?: string | null;
          participant_id: string;
          payment_status?: "confirmed_paid" | "marked_paid" | "unpaid";
          split_method: "automatic" | "breakdown" | "explicit";
          updated_at?: string;
        };
        Update: {
          auth_method?: "password" | "webauthn" | null;
          auth_status?: "authenticated" | "disputed" | "pending";
          authenticated_at?: string | null;
          bill_id?: string;
          confirmed_at?: string | null;
          created_at?: string;
          dispute_note?: string | null;
          disputed_at?: string | null;
          id?: string;
          owed_amount?: number;
          paid_at?: string | null;
          participant_id?: string;
          payment_status?: "confirmed_paid" | "marked_paid" | "unpaid";
          split_method?: "automatic" | "breakdown" | "explicit";
          updated_at?: string;
        };
        Relationships: [];
      };
      bill_receipts: {
        Row: {
          bill_id: string;
          created_at: string;
          file_size: number;
          id: string;
          mime_type: "image/jpeg" | "image/png" | "image/webp";
          original_name: string;
          storage_path: string;
          uploaded_by: string;
        };
        Insert: {
          bill_id: string;
          created_at?: string;
          file_size: number;
          id?: string;
          mime_type: "image/jpeg" | "image/png" | "image/webp";
          original_name: string;
          storage_path: string;
          uploaded_by: string;
        };
        Update: {
          bill_id?: string;
          created_at?: string;
          file_size?: number;
          id?: string;
          mime_type?: "image/jpeg" | "image/png" | "image/webp";
          original_name?: string;
          storage_path?: string;
          uploaded_by?: string;
        };
        Relationships: [];
      };
      bill_status_history: {
        Row: {
          actor_id: string;
          bill_participant_id: string;
          created_at: string;
          event_data: Json;
          event_type:
            | "amount_updated"
            | "authenticated"
            | "bill_deleted"
            | "bill_settled"
            | "breakdown_updated"
            | "confirmed_paid"
            | "created"
            | "disputed"
            | "marked_paid"
            | "resubmitted";
          id: string;
        };
        Insert: {
          actor_id: string;
          bill_participant_id: string;
          created_at?: string;
          event_data?: Json;
          event_type:
            | "amount_updated"
            | "authenticated"
            | "bill_deleted"
            | "bill_settled"
            | "breakdown_updated"
            | "confirmed_paid"
            | "created"
            | "disputed"
            | "marked_paid"
            | "resubmitted";
          id?: string;
        };
        Update: {
          actor_id?: string;
          bill_participant_id?: string;
          created_at?: string;
          event_data?: Json;
          event_type?:
            | "amount_updated"
            | "authenticated"
            | "bill_deleted"
            | "bill_settled"
            | "breakdown_updated"
            | "confirmed_paid"
            | "created"
            | "disputed"
            | "marked_paid"
            | "resubmitted";
          id?: string;
        };
        Relationships: [];
      };
      bills: {
        Row: {
          biller_id: string;
          category_id: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
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
          deleted_at?: string | null;
          deleted_by?: string | null;
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
          deleted_at?: string | null;
          deleted_by?: string | null;
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
      webauthn_challenges: {
        Row: {
          action_type: "accept_allocation" | "confirm_receipt" | null;
          ceremony: "authentication" | "registration";
          challenge: string;
          created_at: string;
          expires_at: string;
          id: string;
          rp_id: string;
          target_id: string | null;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          action_type?: "accept_allocation" | "confirm_receipt" | null;
          ceremony: "authentication" | "registration";
          challenge: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          rp_id: string;
          target_id?: string | null;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          action_type?: "accept_allocation" | "confirm_receipt" | null;
          ceremony?: "authentication" | "registration";
          challenge?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          rp_id?: string;
          target_id?: string | null;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      webauthn_credentials: {
        Row: {
          backed_up: boolean;
          counter: number;
          created_at: string;
          credential_id: string;
          device_label: string;
          device_type: "multiDevice" | "singleDevice";
          id: string;
          last_used_at: string | null;
          public_key: string;
          rp_id: string;
          transports: string[];
          user_id: string;
        };
        Insert: {
          backed_up?: boolean;
          counter?: number;
          created_at?: string;
          credential_id: string;
          device_label: string;
          device_type: "multiDevice" | "singleDevice";
          id?: string;
          last_used_at?: string | null;
          public_key: string;
          rp_id: string;
          transports?: string[];
          user_id: string;
        };
        Update: {
          backed_up?: boolean;
          counter?: number;
          created_at?: string;
          credential_id?: string;
          device_label?: string;
          device_type?: "multiDevice" | "singleDevice";
          id?: string;
          last_used_at?: string | null;
          public_key?: string;
          rp_id?: string;
          transports?: string[];
          user_id?: string;
        };
        Relationships: [];
      };
      poll_options: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          poll_id: string;
          position: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label: string;
          poll_id: string;
          position: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          poll_id?: string;
          position?: number;
        };
        Relationships: [];
      };
      poll_votes: {
        Row: {
          created_at: string;
          id: string;
          poll_id: string;
          poll_option_id: string;
          voter_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          poll_id: string;
          poll_option_id: string;
          voter_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          poll_id?: string;
          poll_option_id?: string;
          voter_id?: string;
        };
        Relationships: [];
      };
      polls: {
        Row: {
          allows_multiple: boolean;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          created_by: string;
          expires_at: string | null;
          id: string;
          question: string;
          status: "closed" | "open";
          updated_at: string;
        };
        Insert: {
          allows_multiple?: boolean;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by: string;
          expires_at?: string | null;
          id?: string;
          question: string;
          status?: "closed" | "open";
          updated_at?: string;
        };
        Update: {
          allows_multiple?: boolean;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by?: string;
          expires_at?: string | null;
          id?: string;
          question?: string;
          status?: "closed" | "open";
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      poll_overview: {
        Row: {
          allows_multiple: boolean;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          created_by: string;
          expires_at: string | null;
          id: string;
          is_open: boolean;
          question: string;
          status: "closed" | "open";
          updated_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_action_notifications: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_circle_balance_snapshot: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_bill_feed: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_bill_history_export: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      authenticate_bill_participant: {
        Args: { p_participant_id: string };
        Returns: undefined;
      };
      confirm_bill_participant_paid: {
        Args: { p_participant_id: string };
        Returns: undefined;
      };
      can_read_bill: {
        Args: { target_bill_id: string };
        Returns: boolean;
      };
      can_read_bill_participant: {
        Args: { target_participant_id: string };
        Returns: boolean;
      };
      can_manage_bill_receipt: {
        Args: { target_bill_id: string };
        Returns: boolean;
      };
      can_manage_bill_receipt_path: {
        Args: { target_path: string };
        Returns: boolean;
      };
      cast_poll_vote: {
        Args: { p_option_ids: string[]; p_poll_id: string };
        Returns: undefined;
      };
      close_poll: {
        Args: { p_poll_id: string };
        Returns: undefined;
      };
      complete_webauthn_bill_action: {
        Args: {
          p_action_type: "accept_allocation" | "confirm_receipt";
          p_participant_id: string;
          p_user_id: string;
        };
        Returns: undefined;
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
      create_poll: {
        Args: {
          p_allows_multiple: boolean;
          p_expires_at: string | null;
          p_options: string[];
          p_question: string;
        };
        Returns: string;
      };
      dispute_bill_participant: {
        Args: { p_note: string; p_participant_id: string };
        Returns: undefined;
      };
      is_bill_biller: {
        Args: { target_bill_id: string };
        Returns: boolean;
      };
      mark_bill_participant_paid: {
        Args: { p_participant_id: string };
        Returns: undefined;
      };
      mark_bill_participants_paid: {
        Args: { p_participant_ids: string[] };
        Returns: number;
      };
      resubmit_bill_allocations: {
        Args: { p_allocations: Json; p_bill_id: string };
        Returns: undefined;
      };
      soft_delete_bill: {
        Args: { p_bill_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
