export interface IAddress {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  complement?: string;
  referencePoint?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface ISavedAddress extends IAddress {
  nickname: string;
}

export interface IOperatingHours {
  open: string;  // e.g. "08:00"
  close: string; // e.g. "22:00"
}
