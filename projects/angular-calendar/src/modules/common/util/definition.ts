import { CalendarEvent } from 'calendar-utils';

export interface OtoCalendarEvent extends CalendarEvent {
  column?: number;
  data?: {
    id: string;
  };
}

export interface OperationDealerHour {
  isOpen: boolean;
  hourSegments: number;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  breakStartHour: number;
  breakStartMinute: number;
  breakEndHour: number;
  breakEndMinute: number;
}
