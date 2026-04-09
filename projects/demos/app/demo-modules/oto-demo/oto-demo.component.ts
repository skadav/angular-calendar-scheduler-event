import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  TemplateRef,
  inject,
  OnInit,
} from '@angular/core';
import {
  addDays,
  formatDate,
  getWeek,
  getYear,
  isSameDay,
  isSameMonth,
} from 'date-fns';
import { Subject } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  provideCalendar,
  CalendarEvent,
  CalendarEventTimesChangedEvent,
  CalendarView,
  CalendarPreviousViewDirective,
  CalendarTodayDirective,
  CalendarNextViewDirective,
  CalendarMonthViewComponent,
  CalendarDayViewComponent,
  CalendarDatePipe,
  DateAdapter,
} from 'angular-calendar';
import { EventColor, WeekDay } from 'calendar-utils';
import { FormsModule } from '@angular/forms';
import {
  FlatpickrDirective,
  provideFlatpickrDefaults,
} from 'angularx-flatpickr';
import { JsonPipe } from '@angular/common';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { OtoCalendarDayViewComponent } from 'projects/angular-calendar/src/modules/day/calendar-day-view/oto-calendar-day-view.component';
import {
  OperationDealerHour,
  OtoCalendarEvent,
} from 'projects/angular-calendar/src/modules/common/util/definition';
import { OtoCalendarWeekViewComponent } from 'projects/angular-calendar/src/modules/week/oto-calendar-week-view/oto-calendar-week-view.component';

@Component({
  selector: 'mwl-oto-demo',

  templateUrl: './oto-demo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      h3 {
        margin: 0 0 10px;
      }

      pre {
        background-color: #f5f5f5;
        padding: 15px;
      }
    `,
  ],
  imports: [
    CalendarPreviousViewDirective,
    CalendarTodayDirective,
    CalendarNextViewDirective,
    CalendarMonthViewComponent,
    OtoCalendarWeekViewComponent,
    CalendarDayViewComponent,
    OtoCalendarDayViewComponent,
    FormsModule,
    JsonPipe,
    CalendarDatePipe,
    FlatpickrDirective,
  ],
  providers: [
    provideFlatpickrDefaults(),
    provideCalendar({ provide: DateAdapter, useFactory: adapterFactory }),
  ],
})
export class OtoDemoComponent implements OnInit {
  @ViewChild('modalContent', { static: true }) modalContent: TemplateRef<any>;

  view: CalendarView = CalendarView.Day;

  CalendarView = CalendarView;

  viewDate: Date = new Date();

  modalData: {
    action: string;
    event: OtoCalendarEvent;
  };

  columns = [
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
  ];

  colorTypeEvent: Record<string, EventColor> = {
    booked: {
      primary: '#A5C8FF',
      secondary: '#A5C8FF',
      secondaryText: 'Booked',
    },
    approved: {
      primary: '#9BE28E',
      secondary: '#9BE28E',
      secondaryText: 'Approved',
    },
    rescheduled: {
      primary: '#FFCD7E',
      secondary: '#FFCD7E',
      secondaryText: 'Rescheduled',
    },
    confirmed: {
      primary: '#38DA5E',
      secondary: '#38DA5E',
      secondaryText: 'Confirmed',
    },
    completed: {
      primary: '#C0DE6F',
      secondary: '#C0DE6F',
      secondaryText: 'Completed',
    },
    breakTime: {
      primary: '#D9D9D9',
      secondary: '#D9D9D9',
      secondaryText: 'Dealer Break Time',
    },
    committeToCome: {
      primary: '#C8BFFD',
      secondary: '#C8BFFD',
      secondaryText: 'Committed to Come',
    },
  };

  actions = {
    approve: {
      label: '<i class="fas fa-fw fa-check"></i>',
      a11yLabel: 'Approved',
      onClick: ({ event }: { event: CalendarEvent }): void => {
        this.handleEvent('Approved', event);
      },
    },
    reject: {
      label: '<i class="fas fa-fw fa-close"></i>',
      a11yLabel: 'Reject',
      onClick: ({ event }: { event: CalendarEvent }): void => {
        this.handleEvent('Reject', event);
      },
    },
    complete: {
      label: '<i class="fas fa-fw fa-check"></i>',
      a11yLabel: 'Complete',
      onClick: ({ event }: { event: CalendarEvent }): void => {
        this.handleEvent('Complete', event);
      },
    },
    showMap: {
      label: '<i class="fas fa-fw fa-map-marker"></i>',
      a11yLabel: 'Complete',
      onClick: ({ event }: { event: CalendarEvent }): void => {
        this.handleEvent('Show Map', event);
      },
    },
  };

  legends = [
    this.colorTypeEvent.booked,
    this.colorTypeEvent.rescheduled,
    this.colorTypeEvent.approved,
    this.colorTypeEvent.confirmed,
    this.colorTypeEvent.committeToCome,
    this.colorTypeEvent.completed,
    this.colorTypeEvent.breakTime,
  ];

  refresh = new Subject<void>();
  events: OtoCalendarEvent[] = [];
  originalEvent: OtoCalendarEvent[] = [
    {
      start: new Date(2026, 3, 8, 10, 0),
      end: new Date(2026, 3, 8, 16, 0),
      title: 'Completed',
      color: this.colorTypeEvent.completed,
      column: 0,
      data: {
        id: 'oto0',
      },
    },
    {
      start: new Date(2026, 3, 8, 13, 0),
      end: new Date(2026, 3, 8, 15, 0),
      title: 'Confirmed',
      color: this.colorTypeEvent.confirmed,
      actions: [this.actions.complete],
      draggable: true,
      column: 1,
      data: {
        id: 'oto1',
      },
    },
    {
      start: new Date(2026, 3, 8, 14, 0),
      end: new Date(2026, 3, 8, 16, 0),
      title: 'Approved',
      color: this.colorTypeEvent.approved,
      actions: [this.actions.complete],
      draggable: true,
      column: 1,
      data: {
        id: 'oto2',
      },
    },
    {
      start: new Date(2026, 3, 8, 14, 0),
      end: new Date(2026, 3, 8, 15, 0),
      title: 'rescheduled',
      color: this.colorTypeEvent.rescheduled,
      actions: [this.actions.approve, this.actions.reject],
      draggable: true,
      column: 1,
      data: {
        id: 'oto3',
      },
    },
    {
      start: new Date(2026, 3, 8, 14, 0),
      end: new Date(2026, 3, 8, 16, 0),
      title: 'Booked',
      color: this.colorTypeEvent.booked,
      actions: [this.actions.approve, this.actions.reject],
      draggable: true,
      column: 4,
      data: {
        id: 'oto4',
      },
    },
    {
      start: new Date(2026, 3, 8, 14, 0),
      end: new Date(2026, 3, 8, 16, 0),
      title: 'CommittedToCome',
      color: this.colorTypeEvent.committeToCome,
      actions: [this.actions.complete],
      draggable: true,
      column: 5,
      data: {
        id: 'oto5',
      },
    },
  ];

  dayDealerClosedDate: Date = addDays(new Date(), -3);
  weekDealerClosedDate: Array<Date> = [addDays(new Date(), -3)];

  dayOperationHour: OperationDealerHour = {
    isOpen: true,
    hourSegments: 2,
    startHour: 8,
    startMinute: 0,
    endHour: 16,
    endMinute: 0,
    breakStartHour: 12,
    breakStartMinute: 0,
    breakEndHour: 13,
    breakEndMinute: 0,
  };

  weekOperationHour: Array<OperationDealerHour> = [
    {
      isOpen: false,
      hourSegments: 2,
      startHour: 8,
      startMinute: 0,
      endHour: 16,
      endMinute: 0,
      breakStartHour: 12,
      breakEndMinute: 0,
      breakStartMinute: 13,
      breakEndHour: 0,
    },
    {
      isOpen: true,
      hourSegments: 2,
      startHour: 8,
      startMinute: 0,
      endHour: 16,
      endMinute: 0,
      breakStartHour: 12,
      breakStartMinute: 0,
      breakEndHour: 13,
      breakEndMinute: 0,
    },
    {
      isOpen: true,
      hourSegments: 2,
      startHour: 8,
      startMinute: 0,
      endHour: 16,
      endMinute: 0,
      breakStartHour: 12,
      breakStartMinute: 0,
      breakEndHour: 13,
      breakEndMinute: 0,
    },
    {
      isOpen: true,
      hourSegments: 2,
      startHour: 8,
      startMinute: 0,
      endHour: 16,
      endMinute: 0,
      breakStartHour: 12,
      breakStartMinute: 0,
      breakEndHour: 13,
      breakEndMinute: 0,
    },
    {
      isOpen: true,
      hourSegments: 2,
      startHour: 8,
      startMinute: 0,
      endHour: 16,
      endMinute: 0,
      breakStartHour: 12,
      breakStartMinute: 0,
      breakEndHour: 13,
      breakEndMinute: 0,
    },
    {
      isOpen: true,
      hourSegments: 2,
      startHour: 8,
      startMinute: 0,
      endHour: 16,
      endMinute: 0,
      breakStartHour: 12,
      breakStartMinute: 0,
      breakEndHour: 13,
      breakEndMinute: 0,
    },
    {
      isOpen: true,
      hourSegments: 2,
      startHour: 8,
      startMinute: 0,
      endHour: 16,
      endMinute: 0,
      breakStartHour: 12,
      breakStartMinute: 0,
      breakEndHour: 13,
      breakEndMinute: 0,
    },
  ];

  activeDayIsOpen: boolean = true;

  private modal = inject(NgbModal);
  ngOnInit(): void {
    this.events = this.originalEvent.map((item) => ({ ...item }));
  }
  prevToggle() {}

  nextToggle() {}
  formatDateTitle() {
    if (this.view === CalendarView.Day) {
      return new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(this.viewDate);
    } else if (this.view === CalendarView.Week) {
      const week = getWeek(this.viewDate);
      const year = getYear(this.viewDate);
      return `Week ${week} in ${year}`;
    } else if (this.view === CalendarView.Month) {
      return `${formatDate(this.viewDate, 'MMM yyyy')}`;
    }

    return `${this.viewDate.toISOString()}`;
  }
  dayClicked({ date, events }: { date: Date; events: CalendarEvent[] }): void {
    if (isSameMonth(date, this.viewDate)) {
      if (
        (isSameDay(this.viewDate, date) && this.activeDayIsOpen === true) ||
        events.length === 0
      ) {
        this.activeDayIsOpen = false;
      } else {
        this.activeDayIsOpen = true;
      }
      this.viewDate = date;
    }
  }

  dayHeaderClicked(event: { day: WeekDay; sourceEvent: MouseEvent }) {
    this.viewDate = event.day.date;
    this.view = CalendarView.Day;
  }
  eventTimesChanged({
    event,
    newStart,
    newEnd,
  }: CalendarEventTimesChangedEvent): void {
    console.log('yuga event', event, 'new Date', newStart, newEnd);
    this.events = this.events.map((iEvent) => {
      if (iEvent === event) {
        return {
          ...event,
          start: newStart,
          end: newEnd,
        };
      }
      return iEvent;
    });
    this.handleEvent('rescheduled', event);
  }

  handleEvent(action: string, event: OtoCalendarEvent): void {
    this.modalData = { event, action };
    this.modal.open(this.modalContent, { size: 'lg' });
  }

  setView(view: CalendarView) {
    this.events = this.originalEvent.map((item) => ({ ...item }));
    this.view = view;
  }

  closeOpenMonthViewDay() {
    this.activeDayIsOpen = false;
  }
}
