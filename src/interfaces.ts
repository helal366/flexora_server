export interface CharityUpdateBody {
  contact_number?: string;
  organization_name?: string;
  organization_email?: string;
  organization_contact?: string;
  organization_address?: string;
  organization_tagline?: string;
  mission?: string;
  organization_logo?: string;
  photoURL?: string;
}

export interface DonationQuery {
  restaurant_representative_email?: string;
  status?: string;
}

export interface DonationUpdateDoc {
  donation_title?: string;
  food_type?: string;
  quantity?: number | string;
  unit?: string;
  pickup_time_window?: string;
  location?: string;
  image?: string;
  status?: string;
  donation_status?: string;
  request_status?: string;
  updated_at?: Date | string;
  [key: string]: any; // Index signature to allow loop-based dynamic assignment
}

export interface RequestsQuery {
  charity_representative_email?: string;
  request_status?: string;
  picking_status?: string;
}

export interface ReviewBody {
  reviewer_email: string;
  rating: number;
  comment: string;
  restaurant_id?: string;
  donation_id?: string;
  created_at?: Date;
}

export interface RoleCounts {
  admin: number;
  restaurant: number;
  charity: number;
  user: number;
  [key: string]: number; // Index signature to allow dynamic loop mapping safely
}