import {
  Component,
  Input,
  NgZone,
  OnChanges,
  SimpleChanges,
  TemplateRef,
  inject,
} from '@angular/core';
import { BehaviorSubject, interval, Observable } from 'rxjs';
import { startWith, map, switchMap } from 'rxjs/operators';
import { NgTemplateOutlet, AsyncPipe, DecimalPipe } from '@angular/common';
import { WeekDay } from 'calendar-utils';
import { DateAdapter } from 'projects/angular-calendar/src/date-adapters/date-adapter';
import { OperationDealerHour } from '../../common/util/definition';
import { isNull } from '../../common/util/util';

@Component({
  selector: 'mwl-oto-calendar-view-break-time-marker',
  template: `
    <ng-template
      #defaultTemplate
      let-columnDate="columnDate"
      let-marker="marker"
      let-operationHour="operationHour"
    >
      @if (
        operationHour.breakStartHour &&
        operationHour.breakEndHour &&
        operationHour.isOpen
      ) {
        <div
          class="cal-current-time-marker"
          style="background-color: #D9D9D9;text-align: center;
            font-style: italic;"
          [style.height.px]="marker.height"
          [style.top.px]="marker.top"
        >
          <div [style.margin-top.px]="marker.height / 2 - 10">
            <span
              class="cal-break-time-marker"
              style="color: darkgrey; opacity:0.9"
            >
              {{ operationHour.breakStartHour | number: '2.0-0' }}:{{
                operationHour.breakStartMinute | number: '2.0-0'
              }}
              Break Time</span
            >
          </div>
        </div>
      }
      @if (!operationHour.isOpen) {
        <div
          class="cal-current-time-marker"
          style="background-color: #D9D9D9;text-align: center;
            font-style: italic;"
          [style.height.px]="marker.height"
          [style.top.px]="marker.top"
        >
          <div [style.margin-top.px]="marker.height / 2 - 10">
            <span
              class="cal-break-time-marker"
              style="color: darkgrey; opacity:0.9"
              >Dealer Closed</span
            >
          </div>
        </div>
      }
    </ng-template>
    <ng-template
      [ngTemplateOutlet]="customTemplate || defaultTemplate"
      [ngTemplateOutletContext]="{
        columnDate: columnDate,
        marker: marker$ | async,
        operationHour,
      }"
    />
  `,
  styles: `
    .cal-break-time-marker {
      font-size: 14px;
      white-space: nowrap;
    }
  `,
  imports: [NgTemplateOutlet, AsyncPipe, DecimalPipe],
})
export class OtoCalendarViewBreakTimeMarkerComponent implements OnChanges {
  @Input() columnDate: Date;

  @Input() hourDuration: number;

  @Input() hourSegmentHeight: number;

  @Input() customTemplate: TemplateRef<any>;

  @Input() operationHour: OperationDealerHour;

  columnDate$ = new BehaviorSubject<Date>(undefined);

  private dateAdapter = inject(DateAdapter);

  private zone = inject(NgZone);

  marker$: Observable<{
    height: number;
    top: number;
  }> = this.zone.onStable.pipe(
    switchMap(() => interval(60 * 1000)),
    startWith(0),
    switchMap(() => this.columnDate$),
    map((columnDate) => {
      if (
        isNull(this.operationHour.breakStartHour) ||
        isNull(this.operationHour.breakEndHour)
      ) {
        return { top: 0, height: 0 };
      }
      if (
        this.operationHour.breakStartHour > this.operationHour.breakStartHour
      ) {
        console.log('erorr', 'startHour cannot greather than endHour');
        return { top: 0, height: 0 };
      }

      const startOfDay = this.dateAdapter.setMinutes(
        this.dateAdapter.setHours(columnDate, this.operationHour.startHour),
        this.operationHour.startMinute,
      );
      const endOfDay = this.dateAdapter.setMinutes(
        this.dateAdapter.setHours(columnDate, this.operationHour.endHour),
        this.operationHour.endMinute,
      );
      const hourHeightModifier =
        (this.operationHour.hourSegments * this.hourSegmentHeight) /
        (this.hourDuration || 60);
      const start = new Date(
        columnDate.getFullYear(),
        columnDate.getMonth(),
        columnDate.getDate(),
        this.operationHour.breakStartHour,
        this.operationHour.breakStartMinute,
      );
      const end = new Date(
        columnDate.getFullYear(),
        columnDate.getMonth(),
        columnDate.getDate(),
        this.operationHour.breakEndHour,
        this.operationHour.breakEndMinute,
      );
      const top =
        this.dateAdapter.differenceInMinutes(start, startOfDay) *
        hourHeightModifier;
      const bottom =
        this.dateAdapter.differenceInMinutes(end, startOfDay) *
        hourHeightModifier;
      const height = bottom - top;

      if (!this.operationHour.isOpen) {
        return {
          top: 0,
          height:
            this.dateAdapter.differenceInMinutes(endOfDay, startOfDay) *
            hourHeightModifier,
        };
      }

      return { top, height };
    }),
  );

  ngOnChanges(changes: SimpleChanges) {
    if (changes.columnDate) {
      this.columnDate$.next(changes.columnDate.currentValue);
    }
  }
}
