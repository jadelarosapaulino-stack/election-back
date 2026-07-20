export interface BreachConfig {
  dpoEmail: string;
  supervisoryAuthorityEmail: string;
  supervisoryAuthorityName: string;
  notificationDeadlineHours: number; // 72h for Art. 33
  country: string; // For jurisdiction-specific logic
}
