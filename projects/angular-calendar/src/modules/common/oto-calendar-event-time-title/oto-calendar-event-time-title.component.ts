import { Component, Input, OnInit, TemplateRef } from '@angular/core';
import { CalendarEvent } from 'calendar-utils';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { CalendarA11yPipe } from '../calendar-a11y/calendar-a11y.pipe';
@Component({
  selector: 'mwl-oto-calendar-event-time-title',
  template: `
    <ng-template #defaultTemplate let-event="event" let-view="view">
      <span
        class="cal-event-title"
        style="font-weight: bold; color: black"
        [innerHTML]="hour"
      >
      </span>
    </ng-template>
    <ng-template
      [ngTemplateOutlet]="customTemplate || defaultTemplate"
      [ngTemplateOutletContext]="{
        event: event,
        view: view,
      }"
    />
  `,
  imports: [NgClass, NgTemplateOutlet, CalendarA11yPipe],
})
export class OtoCalendarEventTimeTitleComponent implements OnInit {
  @Input() event: CalendarEvent;

  @Input() customTemplate: TemplateRef<any>;

  @Input() view: string;

  hour: string;

  ngOnInit(): void {
    this.hour = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(this.event.start));
  }
}
