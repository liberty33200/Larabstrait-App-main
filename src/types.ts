export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  instagram?: string;
  source: 'Forms' | 'Manual';
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  time: string;
  duration: string;
  style: string;
  price: number;
  deposit: number;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
  notes?: string;
}

export interface AccountingEntry {
  id: string;
  date: string;
  appointmentId: string;
  clientName: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  paymentMethod: 'Espèces' | 'CB' | 'Virement';
  status: 'Payé' | 'Partiel' | 'En attente';
}
