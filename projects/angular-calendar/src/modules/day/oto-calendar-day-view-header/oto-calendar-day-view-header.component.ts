import {
  Component,
  Input,
  Output,
  EventEmitter,
  TemplateRef,
  OnInit,
} from '@angular/core';
import { CalendarEvent, WeekDay } from 'calendar-utils';
import { DroppableDirective } from 'angular-draggable-droppable';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { ClickDirective } from '../../common/click/click.directive';
import { CalendarDatePipe } from '../../common/calendar-date/calendar-date.pipe';

@Component({
  selector: 'mwl-oto-calendar-day-view-header',
  template: `
    <div class="cal-day-headers" role="row">
      @for (day of columns; track day) {
        <div
          class="cal-header"
          style="background-color: grey; opacity: 0.7;"
          tabindex="0"
          role="columnheader"
        >
          <b>{{ day }}</b>
        </div>
      }
    </div>
  `,
  imports: [
    DroppableDirective,
    NgClass,
    ClickDirective,
    NgTemplateOutlet,
    CalendarDatePipe,
  ],
})
export class OtoCalendarWeekViewHeaderComponent {
  @Input() columns: WeekDay[];

  @Input() locale: string;

  @Input() customTemplate: TemplateRef<any>;

  @Output() dayHeaderClicked = new EventEmitter<{
    day: WeekDay;
    sourceEvent: MouseEvent;
  }>();

  @Output() eventDropped = new EventEmitter<{
    event: CalendarEvent;
    newStart: Date;
  }>();

  @Output() dragEnter = new EventEmitter<{ date: Date }>();
}
