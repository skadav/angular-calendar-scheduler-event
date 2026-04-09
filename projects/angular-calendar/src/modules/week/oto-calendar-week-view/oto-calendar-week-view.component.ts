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
  shouldFireDroppedEvent,
  getWeekViewPeriod,
} from '../../common/util/util';
import { DateAdapter } from '../../../date-adapters/date-adapter';
import {
  DragEndEvent,
  DropEvent,
  DragMoveEvent,
  ValidateDrag,
  DroppableDirective,
  DraggableDirective,
} from 'angular-draggable-droppable';
import { PlacementArray } from 'positioning';
import { CalendarWeekViewHeaderComponent } from '../calendar-week-view/calendar-week-view-header/calendar-week-view-header.component';
import { NgTemplateOutlet, NgClass } from '@angular/common';
import { CalendarWeekViewEventComponent } from '../calendar-week-view/calendar-week-view-event/calendar-week-view-event.component';
import { CalendarWeekViewHourSegmentComponent } from '../calendar-week-view/calendar-week-view-hour-segment/calendar-week-view-hour-segment.component';
import { CalendarWeekViewCurrentTimeMarkerComponent } from '../calendar-week-view/calendar-week-view-current-time-marker/calendar-week-view-current-time-marker.component';
import { ClickDirective } from '../../common/click/click.directive';
import { OtoCalendarViewBreakTimeMarkerComponent } from '../../day/oto-calendar-view-break-time-marker/oto-calendar-view-break-time-marker.component';
import { OperationDealerHour } from '../../common/util/definition';

interface WeekViewAllDayEventResize {
  originalOffset: number;
  originalSpan: number;
  edge: string;
}
interface CalendarWeekViewBeforeRenderEvent extends WeekView {
  header: WeekDay[];
}

@Component({
  selector: 'mwl-oto-calendar-week-view',
  template: `
    <div class="cal-week-view" role="grid" style="margin-top: 20px;">
      <mwl-calendar-week-view-header
        [days]="days"
        [locale]="locale"
        [customTemplate]="headerTemplate"
        (dayHeaderClicked)="dayHeaderClicked.emit($event)"
        (eventDropped)="
          eventDropped({ dropData: $event }, $event.newStart, true)
        "
        (dragEnter)="dateDragEnter($event.date)"
      />
      @if (view.allDayEventRows.length > 0) {
        <div
          class="cal-all-day-events"
          #allDayEventsContainer
          mwlDroppable
          (dragEnter)="dragEnter('allDay')"
          (dragLeave)="dragLeave('allDay')"
        >
          <div class="cal-day-columns">
            <div class="cal-time-label-column">
              <ng-container *ngTemplateOutlet="allDayEventsLabelTemplate" />
            </div>
            @for (day of days; track day.date.toISOString()) {
              <div
                class="cal-day-column"
                mwlDroppable
                dragOverClass="cal-drag-over"
                (drop)="eventDropped($event, day.date, true)"
                (dragEnter)="dateDragEnter(day.date)"
              ></div>
            }
          </div>
          @for (eventRow of view.allDayEventRows; track eventRow.id) {
            <div #eventRowContainer class="cal-events-row">
              @for (
                allDayEvent of eventRow.row;
                track allDayEvent.event.id ?? allDayEvent.event
              ) {
                <div
                  #event
                  class="cal-event-container"
                  [class.cal-draggable]="
                    allDayEvent.event.draggable && allDayEventResizes.size === 0
                  "
                  [class.cal-starts-within-week]="!allDayEvent.startsBeforeWeek"
                  [class.cal-ends-within-week]="!allDayEvent.endsAfterWeek"
                  [ngClass]="allDayEvent.event?.cssClass"
                  [style.width.%]="(100 / days.length) * allDayEvent.span"
                  [style.marginLeft.%]="
                    rtl ? null : (100 / days.length) * allDayEvent.offset
                  "
                  [style.marginRight.%]="
                    rtl ? (100 / days.length) * allDayEvent.offset : null
                  "
                  mwlResizable
                  [resizeCursors]="resizeCursors"
                  [resizeSnapGrid]="{
                    left: dayColumnWidth,
                    right: dayColumnWidth,
                  }"
                  [validateResize]="validateResize"
                  (resizeStart)="
                    allDayEventResizeStarted(
                      eventRowContainer,
                      allDayEvent,
                      $event
                    )
                  "
                  (resizing)="
                    allDayEventResizing(allDayEvent, $event, dayColumnWidth)
                  "
                  (resizeEnd)="allDayEventResizeEnded(allDayEvent)"
                  mwlDraggable
                  dragActiveClass="cal-drag-active"
                  [dropData]="{
                    event: allDayEvent.event,
                    calendarId: calendarId,
                  }"
                  [dragAxis]="{
                    x:
                      allDayEvent.event.draggable &&
                      allDayEventResizes.size === 0,
                    y:
                      !snapDraggedEvents &&
                      allDayEvent.event.draggable &&
                      allDayEventResizes.size === 0,
                  }"
                  [dragSnapGrid]="
                    snapDraggedEvents ? { x: dayColumnWidth } : {}
                  "
                  [validateDrag]="validateDrag"
                  [touchStartLongPress]="{ delay: 300, delta: 30 }"
                  (dragStart)="
                    dragStarted(eventRowContainer, event, allDayEvent, false)
                  "
                  (dragging)="allDayEventDragMove()"
                  (dragEnd)="dragEnded(allDayEvent, $event, dayColumnWidth)"
                >
                  @if (
                    allDayEvent.event?.resizable?.beforeStart &&
                    !allDayEvent.startsBeforeWeek
                  ) {
                    <div
                      class="cal-resize-handle cal-resize-handle-before-start"
                      mwlResizeHandle
                      [resizeEdges]="{ left: true }"
                    ></div>
                  }
                  <mwl-calendar-week-view-event
                    [locale]="locale"
                    [weekEvent]="allDayEvent"
                    [tooltipPlacement]="tooltipPlacement"
                    [tooltipTemplate]="tooltipTemplate"
                    [tooltipAppendToBody]="tooltipAppendToBody"
                    [tooltipDelay]="tooltipDelay"
                    [customTemplate]="eventTemplate"
                    [eventTitleTemplate]="eventTitleTemplate"
                    [eventActionsTemplate]="eventActionsTemplate"
                    [daysInWeek]="daysInWeek"
                    (eventClicked)="
                      eventClicked.emit({
                        event: allDayEvent.event,
                        sourceEvent: $event.sourceEvent,
                      })
                    "
                  />
                  @if (
                    allDayEvent.event?.resizable?.afterEnd &&
                    !allDayEvent.endsAfterWeek
                  ) {
                    <div
                      class="cal-resize-handle cal-resize-handle-after-end"
                      mwlResizeHandle
                      [resizeEdges]="{ right: true }"
                    ></div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
      <div
        class="cal-time-events"
        mwlDroppable
        (dragEnter)="dragEnter('time')"
        (dragLeave)="dragLeave('time')"
      >
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
              : column;
            let i = $index
          ) {
            <div class="cal-day-column">
              <mwl-oto-calendar-view-break-time-marker
                [columnDate]="column.date"
                [hourDuration]="hourDuration"
                [operationHour]="weekOperationHour[i]"
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
                    [validateResize]="validateResize"
                    [allowNegativeResizes]="true"
                    (resizeStart)="
                      timeEventResizeStarted(dayColumns, timeEvent, $event)
                    "
                    (resizing)="timeEventResizing(timeEvent, $event)"
                    (resizeEnd)="timeEventResizeEnded(timeEvent)"
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
                        [tooltipTemplate]="tooltipTemplate"
                        [tooltipAppendToBody]="tooltipAppendToBody"
                        [tooltipDisabled]="
                          dragActive || timeEventResizes.size > 0
                        "
                        [tooltipDelay]="tooltipDelay"
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
                      (drop)="eventDropped($event, segment.date, false)"
                      (dragEnter)="dateDragEnter(segment.date)"
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
    CalendarWeekViewHeaderComponent,
    DroppableDirective,
    NgTemplateOutlet,
    ResizableDirective,
    DraggableDirective,
    NgClass,
    ResizeHandleDirective,
    CalendarWeekViewEventComponent,
    CalendarWeekViewHourSegmentComponent,
    OtoCalendarViewBreakTimeMarkerComponent,
    ClickDirective,
  ],
})
export class OtoCalendarWeekViewComponent
  implements OnChanges, OnInit, OnDestroy, AfterViewInit
{
  @Input() columns: number;
  @Input() weekOperationHour: Array<OperationDealerHour>;
  @Input() viewDate: Date;

  @Input() events: CalendarEvent[] = [];

  @Input() excludeDays: number[] = [];

  @Input() refresh: Subject<any>;

  @Input() locale: string = inject(LOCALE_ID);

  @Input() tooltipPlacement: PlacementArray = 'auto';

  @Input() tooltipTemplate: TemplateRef<any>;

  @Input() tooltipAppendToBody: boolean = true;

  @Input() tooltipDelay: number | null = null;

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

  private lastDragEnterDate: Date;

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

  timeEventResizeStarted(
    eventsContainer: HTMLElement,
    timeEvent: WeekViewTimeEvent,
    resizeEvent: ResizeEvent,
  ): void {
    this.timeEventResizes.set(timeEvent.event, resizeEvent);
    this.resizeStarted(eventsContainer, timeEvent);
  }

  timeEventResizing(timeEvent: WeekViewTimeEvent, resizeEvent: ResizeEvent) {
    this.timeEventResizes.set(timeEvent.event, resizeEvent);
    const adjustedEvents = new Map<CalendarEvent, CalendarEvent>();

    const tempEvents = [...this.events];

    this.timeEventResizes.forEach((lastResizeEvent, event) => {
      const newEventDates = this.getTimeEventResizedDates(
        event,
        lastResizeEvent,
      );
      const adjustedEvent = { ...event, ...newEventDates };
      adjustedEvents.set(adjustedEvent, event);
      const eventIndex = tempEvents.indexOf(event);
      tempEvents[eventIndex] = adjustedEvent;
    });

    this.restoreOriginalEvents(tempEvents, adjustedEvents, true);
  }
  timeEventResizeEnded(timeEvent: WeekViewTimeEvent) {
    this.view = this.getWeekView(this.events);
    const lastResizeEvent = this.timeEventResizes.get(timeEvent.event);
    if (lastResizeEvent) {
      this.timeEventResizes.delete(timeEvent.event);
      const newEventDates = this.getTimeEventResizedDates(
        timeEvent.event,
        lastResizeEvent,
      );
      this.eventTimesChanged.emit({
        newStart: newEventDates.start,
        newEnd: newEventDates.end,
        event: timeEvent.event,
        type: CalendarEventTimesChangedEventType.Resize,
      });
    }
  }

  allDayEventResizeStarted(
    allDayEventsContainer: HTMLElement,
    allDayEvent: WeekViewAllDayEvent,
    resizeEvent: ResizeEvent,
  ): void {
    this.allDayEventResizes.set(allDayEvent, {
      originalOffset: allDayEvent.offset,
      originalSpan: allDayEvent.span,
      edge: typeof resizeEvent.edges.left !== 'undefined' ? 'left' : 'right',
    });
    this.resizeStarted(
      allDayEventsContainer,
      allDayEvent,
      this.getDayColumnWidth(allDayEventsContainer),
    );
  }

  allDayEventResizing(
    allDayEvent: WeekViewAllDayEvent,
    resizeEvent: ResizeEvent,
    dayWidth: number,
  ): void {
    const currentResize: WeekViewAllDayEventResize =
      this.allDayEventResizes.get(allDayEvent);

    const modifier = this.rtl ? -1 : 1;
    if (typeof resizeEvent.edges.left !== 'undefined') {
      const diff: number =
        Math.round(+resizeEvent.edges.left / dayWidth) * modifier;
      allDayEvent.offset = currentResize.originalOffset + diff;
      allDayEvent.span = currentResize.originalSpan - diff;
    } else if (typeof resizeEvent.edges.right !== 'undefined') {
      const diff: number =
        Math.round(+resizeEvent.edges.right / dayWidth) * modifier;
      allDayEvent.span = currentResize.originalSpan + diff;
    }
  }

  allDayEventResizeEnded(allDayEvent: WeekViewAllDayEvent): void {
    const currentResize: WeekViewAllDayEventResize =
      this.allDayEventResizes.get(allDayEvent);

    if (currentResize) {
      const allDayEventResizingBeforeStart = currentResize.edge === 'left';
      let daysDiff: number;
      if (allDayEventResizingBeforeStart) {
        daysDiff = allDayEvent.offset - currentResize.originalOffset;
      } else {
        daysDiff = allDayEvent.span - currentResize.originalSpan;
      }

      allDayEvent.offset = currentResize.originalOffset;
      allDayEvent.span = currentResize.originalSpan;

      const newDates = this.getAllDayEventResizedDates(
        allDayEvent.event,
        daysDiff,
        allDayEventResizingBeforeStart,
      );

      this.eventTimesChanged.emit({
        newStart: newDates.start,
        newEnd: newDates.end,
        event: allDayEvent.event,
        type: CalendarEventTimesChangedEventType.Resize,
      });
      this.allDayEventResizes.delete(allDayEvent);
    }
  }

  getDayColumnWidth(eventRowContainer: HTMLElement): number {
    return Math.floor(eventRowContainer.offsetWidth / this.days.length);
  }

  dateDragEnter(date: Date) {
    this.lastDragEnterDate = date;
  }

  eventDropped(
    dropEvent: Pick<
      DropEvent<{ event?: CalendarEvent; calendarId?: symbol }>,
      'dropData'
    >,
    date: Date,
    allDay: boolean,
  ): void {
    if (
      shouldFireDroppedEvent(dropEvent, date, allDay, this.calendarId) &&
      this.lastDragEnterDate.getTime() === date.getTime() &&
      (!this.snapDraggedEvents ||
        dropEvent.dropData.event !== this.lastDraggedEvent)
    ) {
      this.eventTimesChanged.emit({
        type: CalendarEventTimesChangedEventType.Drop,
        event: dropEvent.dropData.event,
        newStart: date,
        allDay,
      });
    }
    this.lastDraggedEvent = null;
  }

  dragEnter(type: 'allDay' | 'time') {
    this.eventDragEnterByType[type]++;
  }

  dragLeave(type: 'allDay' | 'time') {
    this.eventDragEnterByType[type]--;
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
        // hide any linked events while dragging
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

  allDayEventDragMove() {
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
      this.eventTimesChanged.emit({
        newStart: start,
        newEnd: end,
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

  protected refreshBody(): void {
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
      hourSegments: this.weekOperationHour[0].hourSegments,
      hourDuration: this.hourDuration,
      dayStart: {
        hour: this.weekOperationHour[0].startHour,
        minute: this.weekOperationHour[0].startMinute,
      },
      dayEnd: {
        hour: this.weekOperationHour[0].endHour,
        minute: this.weekOperationHour[0].endMinute,
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
          this.weekOperationHour[0].hourSegments,
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
        this.weekOperationHour[0].hourSegments,
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
        this.weekOperationHour[0].hourSegments,
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
