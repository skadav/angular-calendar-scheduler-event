import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  CalendarEvent,
  CalendarDayViewComponent,
  provideCalendar,
  DateAdapter,
} from 'angular-calendar';
import { colors } from '../demo-utils/colors';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';

@Component({
  selector: 'mwl-demo-component',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'template.html',
  imports: [CalendarDayViewComponent],
  providers: [
    provideCalendar({ provide: DateAdapter, useFactory: adapterFactory }),
  ],
})
export class DemoComponent {
  viewDate: Date = new Date();

  events: CalendarEvent[] = [];
}
