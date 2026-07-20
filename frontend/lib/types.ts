export interface Business {
  id: string;
  wallet_address: string;
  name: string;
  created_at: string;
}

export type RecipientStatus = "pending" | "active" | "suspended";

export interface Recipient {
  id: string;
  business_id: string;
  email: string;
  full_name: string | null;
  auth_user_id: string | null;
  circle_user_id: string | null;
  wallet_address: string | null;
  verification_tier: 0 | 1 | 2 | 3;
  status: RecipientStatus;
  invite_token: string;
  invited_at: string;
  onboarded_at: string | null;
  created_at: string;
}
