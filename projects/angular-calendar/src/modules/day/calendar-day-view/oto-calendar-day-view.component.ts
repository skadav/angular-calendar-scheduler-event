import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectorRef,
  OnChanges,
  OnInit,
  OnDestroy,
  LOCALE_ID,
  TemplateRef,
  ElementRef,
  AfterViewInit,
  inject,
} from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import {
  WeekDay,
  CalendarEvent,
  WeekViewAllDayEvent,
  WeekView,
  WeekViewTimeEvent,
} from 'calendar-utils';
import {
  ResizeEvent,
  ResizableDirective,
  ResizeHandleDirective,
} from 'angular-resizable-element';
import { ResizeCursors } from 'angular-resizable-element';
import { CalendarDragHelper } from '../../common/calendar-drag-helper/calendar-drag-helper.provider';
import { CalendarResizeHelper } from '../../common/calendar-resize-helper/calendar-resize-helper.provider';
import {
  CalendarEventTimesChangedEvent,
  CalendarEventTimesChangedEventType,
} from '../../common/calendar-event-times-changed-event/calendar-event-times-changed-event.interface';
import { CalendarUtils } from '../../common/calendar-utils/calendar-utils.provider';
import {
  validateEvents,
  roundToNearest,
  getMinutesMoved,
  getDefaultEventEnd,
  addDaysWithExclusions,
  isDraggedWithinPeriod,
  getWeekViewPeriod,
} from '../../common/util/util';
import { DateAdapter } from '../../../date-adapters/date-adapter';
import {
  DragEndEvent,
  DragMoveEvent,
  ValidateDrag,
  DroppableDirective,
  DraggableDirective,
} from 'angular-draggable-droppable';
import { PlacementArray } from 'positioning';
import { NgTemplateOutlet, NgClass } from '@angular/common';
import { ClickDirective } from '../../common/click/click.directive';
import { CalendarWeekViewEventComponent } from '../../week/calendar-week-view/calendar-week-view-event/calendar-week-view-event.component';
import { CalendarWeekViewHourSegmentComponent } from '../../week/calendar-week-view/calendar-week-view-hour-segment/calendar-week-view-hour-segment.component';
import { OtoCalendarWeekViewHeaderComponent } from '../oto-calendar-day-view-header/oto-calendar-day-view-header.component';
import {
  OperationDealerHour,
  OtoCalendarEvent,
} from '../../common/util/definition';
import { OtoCalendarViewBreakTimeMarkerComponent } from '../oto-calendar-view-break-time-marker/oto-calendar-view-break-time-marker.component';

interface WeekViewAllDayEventResize {
  originalOffset: number;
  originalSpan: number;
  edge: string;
}

interface CalendarWeekViewBeforeRenderEvent extends WeekView {
  header: WeekDay[];
}
@Component({
  selector: 'mwl-oto-calendar-day-view',
  template: `
    <div style="position: relative; top:30px; left:30px">
      <i class="fas fa-fw fa-clock"></i>
    </div>
    <div class="cal-week-view" role="grid">
      <mwl-oto-calendar-day-view-header
        [columns]="columns"
        [locale]="locale"
        [customTemplate]="headerTemplate"
      />
      <div class="cal-time-events" mwlDroppable>
        @if (view.hourColumns.length > 0 && daysInWeek !== 1) {
          <div class="cal-time-label-column">
            @for (
              hour of view.hourColumns[0].hours;
              track hour.segments[0].date.toISOString();
              let odd = $odd
            ) {
              <div class="cal-hour" [class.cal-hour-odd]="odd">
                @for (
                  segment of hour.segments;
                  track segment.date.toISOString()
                ) {
                  <mwl-calendar-week-view-hour-segment
                    [style.height.px]="hourSegmentHeight"
                    [segment]="segment"
                    [segmentHeight]="hourSegmentHeight"
                    [locale]="locale"
                    [customTemplate]="hourSegmentTemplate"
                    [isTimeLabel]="true"
                    [daysInWeek]="daysInWeek"
                  />
                }
              </div>
            }
          </div>
        }
        <div
          class="cal-day-columns"
          [class.cal-resize-active]="timeEventResizes.size > 0"
          #dayColumns
        >
          @for (
            column of view.hourColumns;
            track column.hours[0]
              ? column.hours[0].segments[0].date.toISOString()
              : column
          ) {
            <div class="cal-day-column">
              <mwl-oto-calendar-view-break-time-marker
                [columnDate]="column.date"
                [hourDuration]="hourDuration"
                [operationHour]="operationHour"
                [hourSegmentHeight]="hourSegmentHeight"
                [customTemplate]="currentTimeMarkerTemplate"
              />
              <div class="cal-events-container">
                @for (
                  timeEvent of column.events;
                  track timeEvent.event.id ?? timeEvent.event
                ) {
                  <div
                    #event
                    class="cal-event-container"
                    [class.cal-draggable]="
                      timeEvent.event.draggable && timeEventResizes.size === 0
                    "
                    [class.cal-starts-within-day]="!timeEvent.startsBeforeDay"
                    [class.cal-ends-within-day]="!timeEvent.endsAfterDay"
                    [ngClass]="timeEvent.event.cssClass"
                    [hidden]="timeEvent.height === 0 && timeEvent.width === 0"
                    [style.top.px]="timeEvent.top"
                    [style.height.px]="timeEvent.height"
                    [style.left.%]="timeEvent.left"
                    [style.width.%]="timeEvent.width"
                    mwlResizable
                    [resizeCursors]="resizeCursors"
                    [resizeSnapGrid]="{
                      left: dayColumnWidth,
                      right: dayColumnWidth,
                      top: eventSnapSize || hourSegmentHeight,
                      bottom: eventSnapSize || hourSegmentHeight,
                    }"
                    mwlDraggable
                    dragActiveClass="cal-drag-active"
                    [dropData]="{
                      event: timeEvent.event,
                      calendarId: calendarId,
                    }"
                    [dragAxis]="{
                      x:
                        timeEvent.event.draggable &&
                        timeEventResizes.size === 0,
                      y:
                        timeEvent.event.draggable &&
                        timeEventResizes.size === 0,
                    }"
                    [dragSnapGrid]="
                      snapDraggedEvents
                        ? {
                            x: dayColumnWidth,
                            y: eventSnapSize || hourSegmentHeight,
                          }
                        : {}
                    "
                    [touchStartLongPress]="{ delay: 300, delta: 30 }"
                    [ghostDragEnabled]="!snapDraggedEvents"
                    [ghostElementTemplate]="weekEventTemplate"
                    [validateDrag]="validateDrag"
                    (dragStart)="
                      dragStarted(dayColumns, event, timeEvent, true)
                    "
                    (dragging)="dragMove(timeEvent, $event)"
                    (dragEnd)="
                      dragEnded(timeEvent, $event, dayColumnWidth, true)
                    "
                  >
                    @if (
                      timeEvent.event?.resizable?.beforeStart &&
                      !timeEvent.startsBeforeDay
                    ) {
                      <div
                        class="cal-resize-handle cal-resize-handle-before-start"
                        mwlResizeHandle
                        [resizeEdges]="{
                          left: true,
                          top: true,
                        }"
                      ></div>
                    }
                    <ng-template [ngTemplateOutlet]="weekEventTemplate" />
                    <ng-template #weekEventTemplate>
                      <mwl-calendar-week-view-event
                        [locale]="locale"
                        [weekEvent]="timeEvent"
                        [tooltipPlacement]="tooltipPlacement"
                        [tooltipDisabled]="
                          dragActive || timeEventResizes.size > 0
                        "
                        [customTemplate]="eventTemplate"
                        [eventTitleTemplate]="eventTitleTemplate"
                        [eventActionsTemplate]="eventActionsTemplate"
                        [column]="column"
                        [daysInWeek]="daysInWeek"
                        (eventClicked)="
                          eventClicked.emit({
                            event: timeEvent.event,
                            sourceEvent: $event.sourceEvent,
                          })
                        "
                      />
                    </ng-template>
                    @if (
                      timeEvent.event?.resizable?.afterEnd &&
                      !timeEvent.endsAfterDay
                    ) {
                      <div
                        class="cal-resize-handle cal-resize-handle-after-end"
                        mwlResizeHandle
                        [resizeEdges]="{
                          right: true,
                          bottom: true,
                        }"
                      ></div>
                    }
                  </div>
                }
              </div>
              @for (
                hour of column.hours;
                track hour.segments[0].date.toISOString();
                let odd = $odd
              ) {
                <div class="cal-hour" [class.cal-hour-odd]="odd">
                  @for (
                    segment of hour.segments;
                    track segment.date.toISOString()
                  ) {
                    <mwl-calendar-week-view-hour-segment
                      [style.height.px]="hourSegmentHeight"
                      [segment]="segment"
                      [segmentHeight]="hourSegmentHeight"
                      [locale]="locale"
                      [customTemplate]="hourSegmentTemplate"
                      [daysInWeek]="daysInWeek"
                      (mwlClick)="
                        hourSegmentClicked.emit({
                          date: segment.date,
                          sourceEvent: $event,
                        })
                      "
                      [clickListenerDisabled]="!hourSegmentClicked.observed"
                      mwlDroppable
                      [dragOverClass]="
                        !dragActive || !snapDraggedEvents
                          ? 'cal-drag-over'
                          : null
                      "
                      dragActiveClass="cal-drag-active"
                      [isTimeLabel]="daysInWeek === 1"
                    />
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  imports: [
    DroppableDirective,
    NgTemplateOutlet,
    ResizableDirective,
    DraggableDirective,
    NgClass,
    ResizeHandleDirective,
    CalendarWeekViewEventComponent,
    CalendarWeekViewHourSegmentComponent,
    OtoCalendarViewBreakTimeMarkerComponent,
    OtoCalendarWeekViewHeaderComponent,
    ClickDirective,
  ],
})
export class OtoCalendarDayViewComponent
  implements OnChanges, OnInit, OnDestroy, AfterViewInit
{
  @Input() columns: Array<any> = [];
  @Input() viewDate: Date;
  @Input() operationHour: OperationDealerHour;
  @Input() events: OtoCalendarEvent[] = [];
  @Input() excludeDays: number[] = [];

  @Input() refresh: Subject<any>;

  @Input() locale: string = inject(LOCALE_ID);

  @Input() tooltipPlacement: PlacementArray = 'auto';

  @Input() weekStartsOn: number;

  @Input() headerTemplate: TemplateRef<any>;

  @Input() eventTemplate: TemplateRef<any>;

  @Input() eventTitleTemplate: TemplateRef<any>;

  @Input() eventActionsTemplate: TemplateRef<any>;

  @Input() precision: 'days' | 'minutes' = 'days';

  @Input() weekendDays: number[];

  @Input() snapDraggedEvents: boolean = true;

  @Input() hourDuration: number;

  @Input() hourSegmentHeight: number = 30;

  @Input() minimumEventHeight: number = 30;

  @Input() hourSegmentTemplate: TemplateRef<any>;

  @Input() eventSnapSize: number;

  @Input() allDayEventsLabelTemplate: TemplateRef<any>;

  @Input() daysInWeek: number;

  @Input() currentTimeMarkerTemplate: TemplateRef<any>;

  @Input() validateEventTimesChanged: (
    event: CalendarEventTimesChangedEvent,
  ) => boolean;

  @Input() resizeCursors: Partial<
    Pick<ResizeCursors, 'leftOrRight' | 'topOrBottom'>
  >;

  @Output() dayHeaderClicked = new EventEmitter<{
    day: WeekDay;
    sourceEvent: MouseEvent;
  }>();

  @Output() eventClicked = new EventEmitter<{
    event: CalendarEvent;
    sourceEvent: MouseEvent | KeyboardEvent;
  }>();

  @Output() eventTimesChanged =
    new EventEmitter<CalendarEventTimesChangedEvent>();

  @Output() beforeViewRender =
    new EventEmitter<CalendarWeekViewBeforeRenderEvent>();

  @Output() hourSegmentClicked = new EventEmitter<{
    date: Date;
    sourceEvent: MouseEvent;
  }>();

  // events: OtoCalendarEvent[] = []
  originalEvents: OtoCalendarEvent[] = [];
  days: WeekDay[];
  view: WeekView;
  refreshSubscription: Subscription;
  allDayEventResizes: Map<WeekViewAllDayEvent, WeekViewAllDayEventResize> =
    new Map();
  timeEventResizes: Map<CalendarEvent, ResizeEvent> = new Map();
  eventDragEnterByType = {
    allDay: 0,
    time: 0,
  };
  dragActive = false;
  dragAlreadyMoved = false;
  validateDrag: ValidateDrag;
  validateResize: (args: any) => boolean;
  dayColumnWidth: number;
  calendarId = Symbol('angular calendar week view id');
  lastDraggedEvent: CalendarEvent;
  rtl = false;
  protected cdr = inject(ChangeDetectorRef);
  protected utils = inject(CalendarUtils);
  protected dateAdapter = inject(DateAdapter);
  protected element = inject<ElementRef<HTMLElement>>(ElementRef);
  ngOnInit(): void {
    if (this.refresh) {
      this.refreshSubscription = this.refresh.subscribe(() => {
        this.refreshAll();
        this.cdr.markForCheck();
      });
    }
  }

  ngOnChanges(changes: any): void {
    const refreshHeader =
      changes.viewDate ||
      changes.excludeDays ||
      changes.weekendDays ||
      changes.daysInWeek ||
      changes.weekStartsOn;

    const refreshBody =
      changes.viewDate ||
      changes.hourDuration ||
      changes.weekStartsOn ||
      changes.weekendDays ||
      changes.excludeDays ||
      changes.hourSegmentHeight ||
      changes.events ||
      changes.daysInWeek ||
      changes.minimumEventHeight;

    if (refreshHeader) {
      this.originalEvents = this.events.map((item) => ({ ...item }));
      this.refreshHeader();
    }

    if (changes.events) {
      validateEvents(this.events);
    }

    if (refreshBody) {
      this.refreshBody();
    }

    if (refreshHeader || refreshBody) {
      this.emitBeforeViewRender();
    }
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  ngAfterViewInit() {
    this.rtl =
      typeof window !== 'undefined' &&
      getComputedStyle(this.element.nativeElement).direction === 'rtl';
    this.cdr.detectChanges();
  }

  getDayColumnWidth(eventRowContainer: HTMLElement): number {
    return Math.floor(eventRowContainer.offsetWidth / this.days.length);
  }

  dragStarted(
    eventsContainerElement: HTMLElement,
    eventElement: HTMLElement,
    event: WeekViewTimeEvent | WeekViewAllDayEvent,
    useY: boolean,
  ): void {
    this.dayColumnWidth = this.getDayColumnWidth(eventsContainerElement);
    const dragHelper: CalendarDragHelper = new CalendarDragHelper(
      eventsContainerElement,
      eventElement,
    );
    this.validateDrag = ({ x, y, transform }) => {
      const isAllowed =
        this.allDayEventResizes.size === 0 &&
        this.timeEventResizes.size === 0 &&
        dragHelper.validateDrag({
          x,
          y,
          snapDraggedEvents: this.snapDraggedEvents,
          dragAlreadyMoved: this.dragAlreadyMoved,
          transform,
        });
      if (isAllowed && this.validateEventTimesChanged) {
        const newEventTimes = this.getDragMovedEventTimes(
          event,
          { x, y },
          this.dayColumnWidth,
          useY,
        );
        return this.validateEventTimesChanged({
          type: CalendarEventTimesChangedEventType.Drag,
          event: event.event,
          newStart: newEventTimes.start,
          newEnd: newEventTimes.end,
        });
      }

      return isAllowed;
    };
    this.dragActive = true;
    this.dragAlreadyMoved = false;
    this.lastDraggedEvent = null;
    this.eventDragEnterByType = {
      allDay: 0,
      time: 0,
    };
    if (!this.snapDraggedEvents && useY) {
      this.view.hourColumns.forEach((column) => {
        const linkedEvent = column.events.find(
          (columnEvent) =>
            columnEvent.event === event.event && columnEvent !== event,
        );
        if (linkedEvent) {
          linkedEvent.width = 0;
          linkedEvent.height = 0;
        }
      });
    }
    this.cdr.markForCheck();
  }

  dragMove(dayEvent: WeekViewTimeEvent, dragEvent: DragMoveEvent) {
    const newEventTimes = this.getDragMovedEventTimes(
      dayEvent,
      dragEvent,
      this.dayColumnWidth,
      true,
    );
    const originalEvent = dayEvent.event;
    const adjustedEvent = { ...originalEvent, ...newEventTimes };
    const tempEvents = this.events.map((event) => {
      if (event === originalEvent) {
        return adjustedEvent;
      }
      return event;
    });
    this.restoreOriginalEvents(
      tempEvents,
      new Map([[adjustedEvent, originalEvent]]),
      this.snapDraggedEvents,
    );
    this.dragAlreadyMoved = true;
  }

  dragEnded(
    weekEvent: WeekViewAllDayEvent | WeekViewTimeEvent,
    dragEndEvent: DragEndEvent,
    dayWidth: number,
    useY = false,
  ): void {
    this.view = this.getWeekView(this.events);
    this.dragActive = false;
    this.validateDrag = null;
    const { start, end } = this.getDragMovedEventTimes(
      weekEvent,
      dragEndEvent,
      dayWidth,
      useY,
    );
    if (
      (this.snapDraggedEvents ||
        this.eventDragEnterByType[useY ? 'time' : 'allDay'] > 0) &&
      isDraggedWithinPeriod(start, end, this.view.period)
    ) {
      this.lastDraggedEvent = weekEvent.event;
      const newEvent: OtoCalendarEvent = weekEvent.event;
      const originalEvent = this.originalEvents.find(
        (x) => x.data?.id === newEvent.data?.id,
      );
      const newStart = new Date(
        originalEvent?.start.getFullYear(),
        originalEvent?.start.getMonth(),
        originalEvent?.start.getDate(),
        start.getHours(),
        start.getMinutes(),
      );
      const newEnd = new Date(
        originalEvent?.end.getFullYear(),
        originalEvent?.end.getMonth(),
        originalEvent?.end.getDate(),
        end.getHours(),
        end.getMinutes(),
      );
      this.eventTimesChanged.emit({
        newStart: newStart,
        newEnd: newEnd,
        event: weekEvent.event,
        type: CalendarEventTimesChangedEventType.Drag,
        allDay: !useY,
      });
    }
  }

  protected refreshHeader(): void {
    this.days = this.utils.getWeekViewHeader({
      viewDate: this.viewDate,
      weekStartsOn: this.weekStartsOn,
      excluded: this.excludeDays,
      weekendDays: this.weekendDays,
      ...getWeekViewPeriod(
        this.dateAdapter,
        this.viewDate,
        this.weekStartsOn,
        this.excludeDays,
        this.daysInWeek,
      ),
    });
  }

  protected getIndexColumn(column: number, date: Date): Date {
    const day = this.days[column];
    const hour = date.getHours();
    const minute = date.getMinutes();
    const proposedDate = new Date(
      day.date.getFullYear(),
      day.date.getMonth(),
      day.date.getDate(),
      hour,
      minute,
    );
    return proposedDate;
  }

  protected modifyEvent() {
    this.events.forEach((event) => {
      event.start = this.getIndexColumn(event.column, event.start);
      event.end = this.getIndexColumn(event.column, event.end);
    });
  }

  protected refreshBody(): void {
    this.modifyEvent();
    this.view = this.getWeekView(this.events);
  }

  protected refreshAll(): void {
    this.refreshHeader();
    this.refreshBody();
    this.emitBeforeViewRender();
  }

  protected emitBeforeViewRender(): void {
    if (this.days && this.view) {
      this.beforeViewRender.emit({
        header: this.days,
        ...this.view,
      });
    }
  }

  protected getWeekView(events: CalendarEvent[]) {
    return this.utils.getWeekView({
      events,
      viewDate: this.viewDate,
      weekStartsOn: this.weekStartsOn,
      excluded: this.excludeDays,
      precision: this.precision,
      absolutePositionedEvents: true,
      hourSegments: this.operationHour.hourSegments,
      hourDuration: this.hourDuration,
      dayStart: {
        hour: this.operationHour.startHour,
        minute: this.operationHour.startMinute,
      },
      dayEnd: {
        hour: this.operationHour.endHour,
        minute: this.operationHour.endMinute,
      },
      segmentHeight: this.hourSegmentHeight,
      weekendDays: this.weekendDays,
      minimumEventHeight: this.minimumEventHeight,
      ...getWeekViewPeriod(
        this.dateAdapter,
        this.viewDate,
        this.weekStartsOn,
        this.excludeDays,
        this.daysInWeek,
      ),
    });
  }

  protected getDragMovedEventTimes(
    weekEvent: WeekViewAllDayEvent | WeekViewTimeEvent,
    dragEndEvent: DragEndEvent | DragMoveEvent,
    dayWidth: number,
    useY: boolean,
  ) {
    const daysDragged =
      (roundToNearest(dragEndEvent.x, dayWidth) / dayWidth) *
      (this.rtl ? -1 : 1);
    const minutesMoved = useY
      ? getMinutesMoved(
          dragEndEvent.y,
          this.operationHour.hourSegments,
          this.hourSegmentHeight,
          this.eventSnapSize,
          this.hourDuration,
        )
      : 0;

    const start = this.dateAdapter.addMinutes(
      addDaysWithExclusions(
        this.dateAdapter,
        weekEvent.event.start,
        daysDragged,
        this.excludeDays,
      ),
      minutesMoved,
    );
    let end: Date;
    if (weekEvent.event.end) {
      end = this.dateAdapter.addMinutes(
        addDaysWithExclusions(
          this.dateAdapter,
          weekEvent.event.end,
          daysDragged,
          this.excludeDays,
        ),
        minutesMoved,
      );
    }

    return { start, end };
  }

  protected restoreOriginalEvents(
    tempEvents: CalendarEvent[],
    adjustedEvents: Map<CalendarEvent, CalendarEvent>,
    snapDraggedEvents = true,
  ) {
    const previousView = this.view;
    if (snapDraggedEvents) {
      this.view = this.getWeekView(tempEvents);
    }

    const adjustedEventsArray = tempEvents.filter((event) =>
      adjustedEvents.has(event),
    );
    this.view.hourColumns.forEach((column, columnIndex) => {
      previousView.hourColumns[columnIndex].hours.forEach((hour, hourIndex) => {
        hour.segments.forEach((segment, segmentIndex) => {
          column.hours[hourIndex].segments[segmentIndex].cssClass =
            segment.cssClass;
        });
      });

      adjustedEventsArray.forEach((adjustedEvent) => {
        const originalEvent = adjustedEvents.get(adjustedEvent);
        const existingColumnEvent = column.events.find(
          (columnEvent) =>
            columnEvent.event ===
            (snapDraggedEvents ? adjustedEvent : originalEvent),
        );
        if (existingColumnEvent) {
          // restore the original event so trackBy kicks in and the dom isn't changed
          existingColumnEvent.event = originalEvent;
          existingColumnEvent['tempEvent'] = adjustedEvent;
          if (!snapDraggedEvents) {
            existingColumnEvent.height = 0;
            existingColumnEvent.width = 0;
          }
        } else {
          // add a dummy event to the drop so if the event was removed from the original column the drag doesn't end early
          const event = {
            event: originalEvent,
            left: 0,
            top: 0,
            height: 0,
            width: 0,
            startsBeforeDay: false,
            endsAfterDay: false,
            tempEvent: adjustedEvent,
          };
          column.events.push(event);
        }
      });
    });
    adjustedEvents.clear();
  }

  protected getTimeEventResizedDates(
    calendarEvent: CalendarEvent,
    resizeEvent: ResizeEvent,
  ) {
    const newEventDates = {
      start: calendarEvent.start,
      end: getDefaultEventEnd(
        this.dateAdapter,
        calendarEvent,
        this.minimumEventHeight,
      ),
    };
    const { end, ...eventWithoutEnd } = calendarEvent;
    const smallestResizes = {
      start: this.dateAdapter.addMinutes(
        newEventDates.end,
        this.minimumEventHeight * -1,
      ),
      end: getDefaultEventEnd(
        this.dateAdapter,
        eventWithoutEnd,
        this.minimumEventHeight,
      ),
    };

    const modifier = this.rtl ? -1 : 1;

    if (typeof resizeEvent.edges.left !== 'undefined') {
      const daysDiff =
        Math.round(+resizeEvent.edges.left / this.dayColumnWidth) * modifier;
      const newStart = addDaysWithExclusions(
        this.dateAdapter,
        newEventDates.start,
        daysDiff,
        this.excludeDays,
      );
      if (newStart < smallestResizes.start) {
        newEventDates.start = newStart;
      } else {
        newEventDates.start = smallestResizes.start;
      }
    } else if (typeof resizeEvent.edges.right !== 'undefined') {
      const daysDiff =
        Math.round(+resizeEvent.edges.right / this.dayColumnWidth) * modifier;
      const newEnd = addDaysWithExclusions(
        this.dateAdapter,
        newEventDates.end,
        daysDiff,
        this.excludeDays,
      );
      if (newEnd > smallestResizes.end) {
        newEventDates.end = newEnd;
      } else {
        newEventDates.end = smallestResizes.end;
      }
    }

    if (typeof resizeEvent.edges.top !== 'undefined') {
      const minutesMoved = getMinutesMoved(
        resizeEvent.edges.top as number,
        this.operationHour.hourSegments,
        this.hourSegmentHeight,
        this.eventSnapSize,
        this.hourDuration,
      );
      const newStart = this.dateAdapter.addMinutes(
        newEventDates.start,
        minutesMoved,
      );
      if (newStart < smallestResizes.start) {
        newEventDates.start = newStart;
      } else {
        newEventDates.start = smallestResizes.start;
      }
    } else if (typeof resizeEvent.edges.bottom !== 'undefined') {
      const minutesMoved = getMinutesMoved(
        resizeEvent.edges.bottom as number,
        this.operationHour.hourSegments,
        this.hourSegmentHeight,
        this.eventSnapSize,
        this.hourDuration,
      );
      const newEnd = this.dateAdapter.addMinutes(
        newEventDates.end,
        minutesMoved,
      );
      if (newEnd > smallestResizes.end) {
        newEventDates.end = newEnd;
      } else {
        newEventDates.end = smallestResizes.end;
      }
    }

    return newEventDates;
  }

  protected resizeStarted(
    eventsContainer: HTMLElement,
    event: WeekViewTimeEvent | WeekViewAllDayEvent,
    dayWidth?: number,
  ) {
    this.dayColumnWidth = this.getDayColumnWidth(eventsContainer);
    const resizeHelper = new CalendarResizeHelper(
      eventsContainer,
      dayWidth,
      this.rtl,
    );
    this.validateResize = ({ rectangle, edges }) => {
      const isWithinBoundary = resizeHelper.validateResize({
        rectangle: { ...rectangle },
        edges,
      });

      if (isWithinBoundary && this.validateEventTimesChanged) {
        let newEventDates;
        if (!dayWidth) {
          newEventDates = this.getTimeEventResizedDates(event.event, {
            rectangle,
            edges,
          });
        } else {
          const modifier = this.rtl ? -1 : 1;
          if (typeof edges.left !== 'undefined') {
            const diff = Math.round(+edges.left / dayWidth) * modifier;
            newEventDates = this.getAllDayEventResizedDates(
              event.event,
              diff,
              !this.rtl,
            );
          } else {
            const diff = Math.round(+edges.right / dayWidth) * modifier;
            newEventDates = this.getAllDayEventResizedDates(
              event.event,
              diff,
              this.rtl,
            );
          }
        }
        return this.validateEventTimesChanged({
          type: CalendarEventTimesChangedEventType.Resize,
          event: event.event,
          newStart: newEventDates.start,
          newEnd: newEventDates.end,
        });
      }

      return isWithinBoundary;
    };
    this.cdr.markForCheck();
  }

  /**
   * @hidden
   */
  protected getAllDayEventResizedDates(
    event: CalendarEvent,
    daysDiff: number,
    beforeStart: boolean,
  ) {
    let start: Date = event.start;
    let end: Date = event.end || event.start;
    if (beforeStart) {
      start = addDaysWithExclusions(
        this.dateAdapter,
        start,
        daysDiff,
        this.excludeDays,
      );
    } else {
      end = addDaysWithExclusions(
        this.dateAdapter,
        end,
        daysDiff,
        this.excludeDays,
      );
    }

    return { start, end };
  }
}
