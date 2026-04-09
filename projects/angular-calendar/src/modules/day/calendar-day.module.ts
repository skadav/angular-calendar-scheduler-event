import { NgModule } from '@angular/core';
import { CalendarDayViewComponent } from './calendar-day-view/calendar-day-view.component';
import { OtoCalendarDayViewComponent } from './calendar-day-view/oto-calendar-day-view.component';

export { CalendarDayViewComponent } from './calendar-day-view/calendar-day-view.component';

export { OtoCalendarDayViewComponent } from './calendar-day-view/oto-calendar-day-view.component';

/**
 * @deprecated import the standalone component `CalendarDayViewComponent` instead
 */
@NgModule({
  imports: [CalendarDayViewComponent, OtoCalendarDayViewComponent],
  exports: [CalendarDayViewComponent, OtoCalendarDayViewComponent],
})
export class CalendarDayModule {}
