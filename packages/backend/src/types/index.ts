export interface IAddress {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface IOperatingHours {
  open: string;  // e.g. "08:00"
  close: string; // e.g. "22:00"
}
