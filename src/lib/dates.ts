/** Dictionary of semester-name related constants. */
const SEMESTER_NAMES = {
  f: {
    catalog: "FA",
    full: "fall",
    fullCaps: "Fall",
  },
  s: {
    catalog: "SP",
    full: "spring",
    fullCaps: "Spring",
  },
  i: {
    catalog: "JA",
    full: "iap",
    fullCaps: "IAP",
  },
} as const;

/** Type of semester abbreviations. */
type TSemester = keyof typeof SEMESTER_NAMES;

/** Strings for each weekday. */
export const WEEKDAY_STRINGS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** See {@link TIMESLOT_STRINGS}. */
function generateTimeslotStrings(): Array<string> {
  const res = [];
  for (let i = 8; i <= 11; i++) {
    res.push(`${i}:00 AM`);
    res.push(`${i}:30 AM`);
  }
  res.push("12:00 PM");
  res.push("12:30 PM");
  for (let i = 1; i <= 9; i++) {
    res.push(`${i}:00 PM`);
    res.push(`${i}:30 PM`);
  }
  res.push(`10:00 PM`);
  return res;
}

/** Strings for each slot number, in order. */
export const TIMESLOT_STRINGS = generateTimeslotStrings();

/** We maintain only one copy of each slot object. */
const SLOT_OBJECTS: { [slot: number]: Slot } = {};

/**
 * A thirty-minute slot. Each day has 30 slots from 8 AM to 11 PM, times five
 * days a week. When treated as an instant, a slot represents its start time.
 *
 * Each slot is assigned a slot number. Monday slots are 0 to 29, Tuesday are
 * 30 to 59, etc., slot number 0 is Monday 8 AM to 8:30 AM, etc.
 *
 * The interface ends at 9 PM, so we don't need to worry about the fencepost
 * problem with respect to ending slots.
 */
export class Slot {
  constructor(/** The slot number. */ public slot: number) {}

  static fromSlotNumber(slot: number): Slot {
    if (!SLOT_OBJECTS[slot]) {
      SLOT_OBJECTS[slot] = new Slot(slot);
    }
    return SLOT_OBJECTS[slot];
  }

  /** Converts a date, within 8 AM to 11 PM, to a slot. */
  static fromStartDate(date: Date): Slot {
    return new Slot(
      30 * (date.getDay() - 1) +
        2 * (date.getHours() - 8) +
        Math.floor(date.getMinutes() / 30)
    );
  }

  /** Convert from WEEKDAY_STRINGS and TIMESLOT_STRINGS to slot. */
  static fromDayString(day: string, time: string): Slot {
    return Slot.fromSlotNumber(
      30 * WEEKDAY_STRINGS.indexOf(day) + TIMESLOT_STRINGS.indexOf(time)
    );
  }

  /** The slot after #slots. */
  add(slots: number): Slot {
    return Slot.fromSlotNumber(this.slot + slots);
  }

  /**
   * The (local timezone) date on the day of date that this starts in. Assumes
   * that date is the right day of the week.
   */
  onDate(date: Date): Date {
    const hour = Math.floor((this.slot % 30) / 2) + 8;
    const minute = (this.slot % 2) * 30;
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hour,
      minute
    );
  }

  /** The date in the week of 2001-01-01 that this starts in. */
  get startDate(): Date {
    // conveniently enough, 2001-01-01 is a Monday:
    return this.onDate(new Date(2001, 0, this.weekday));
  }

  /** The date in the week of 2001-01-01 that this ends in. */
  get endDate(): Date {
    return this.add(1).startDate;
  }

  /** The day of the week this slot falls in, as a number from 1 to 5. */
  get weekday(): number {
    return Math.floor(this.slot / 30) + 1;
  }

  /** Convert a slot number to a day string. */
  get dayString(): string {
    return WEEKDAY_STRINGS[this.weekday - 1];
  }

  /** Convert a slot number to a time string. */
  get timeString(): string {
    return TIMESLOT_STRINGS[this.slot % 30];
  }
}

/** Parse a urlName like "f22". */
export function parseUrlName(
  urlName: string
): { year: string; semester: TSemester } {
  return {
    year: urlName.substring(1),
    semester: urlName[0] as TSemester,
  };
}

/**
 * A term object, containing all information about non-class, term-specific
 * information.
 */
export class Term {
  /** Term real year as a two-digit string, e.g. "22" */
  public year: string;
  /** Semester as a character, e.g. "f" */
  public semester: TSemester;
  /** First day of classes, inclusive. */
  public start: Date;
  /** Last day of H1 classes, inclusive. */
  public h1End: Date;
  /** First day of H2 classes, inclusive. */
  public h2Start: Date;
  /** Last day of classes, inclusive. */
  public end: Date;
  /** A Tuesday which runs on Monday schedule, if it exists. */
  public mondaySchedule?: Date;
  /** A list of dates with no class. */
  public holidays: Array<Date>;

  constructor({
    urlName,
    startDate = "",
    h1EndDate = "",
    h2StartDate = "",
    endDate = "",
    mondayScheduleDate,
    holidayDates = [],
  }: {
    urlName: string;
    startDate?: string;
    h1EndDate?: string;
    h2StartDate?: string;
    endDate?: string;
    mondayScheduleDate?: string;
    holidayDates?: Array<string>;
  }) {
    const midnight = (date: string) => new Date(`${date}T00:00:00`);
    const { year, semester } = parseUrlName(urlName);
    this.year = year;
    this.semester = semester;
    this.start = midnight(startDate);
    this.h1End = midnight(h1EndDate);
    this.h2Start = midnight(h2StartDate);
    this.end = midnight(endDate);
    this.mondaySchedule =
      mondayScheduleDate === undefined
        ? undefined
        : midnight(mondayScheduleDate);
    this.holidays = holidayDates.map((date) => midnight(date));
  }

  /** e.g. "2022" */
  get fullRealYear(): string {
    return `20${this.year}`;
  }

  /** The year that the school year ends in, e.g. "2023" */
  get fullSchoolYear(): string {
    return this.semester === "f"
      ? (parseInt(this.fullRealYear, 10) + 1).toString()
      : this.fullRealYear;
  }

  /** e.g. "FA" */
  get semesterCatalog(): string {
    return SEMESTER_NAMES[this.semester].catalog;
  }

  /** e.g. "fall" */
  get semesterFull(): string {
    return SEMESTER_NAMES[this.semester].full;
  }

  /** e.g. "Fall" */
  get semesterFullCaps(): string {
    return SEMESTER_NAMES[this.semester].fullCaps;
  }

  /** e.g. "2023FA" */
  get catalogName(): string {
    return `${this.fullSchoolYear}${this.semesterCatalog}`;
  }

  /** e.g. "Fall 2022" */
  get niceName() {
    return `${this.semesterFullCaps} ${this.fullRealYear}`;
  }

  /** e.g. "f22" */
  get urlName() {
    return `${this.semester}${this.year}`;
  }

  /** e.g. "f22" */
  toString(): string {
    return this.urlName;
  }

  /** The date a slot starts on. */
  startDateFor(slot: Slot, secondHalf: boolean = false): Date {
    let date = new Date((secondHalf ? this.h2Start : this.start).getTime());
    while (date.getDay() !== slot.weekday) {
      date.setDate(date.getDate() + 1);
    }
    return slot.onDate(date);
  }

  /** The date a slot ends on, plus an extra day. */
  endDateFor(slot: Slot, firstHalf: boolean = false): Date {
    let date = new Date((firstHalf ? this.h1End : this.end).getTime());
    while (date.getDay() !== slot.weekday) {
      date.setDate(date.getDate() - 1);
    }
    // plus an extra day, for inclusivity issues
    date.setDate(date.getDate() + 1);
    return slot.onDate(date);
  }

  /** Dates that a given slot *doesn't* run on. */
  exDatesFor(slot: Slot): Array<Date> {
    const res = this.holidays.filter((date) => date.getDay() === slot.weekday);
    // ex dates can't be empty, so add an extra one:
    res.push(new Date("2000-01-01"));
    return res.map((date) => slot.onDate(date));
  }

  /** An extra date a given slot would fall on, if it exists. */
  rDateFor(slot: Slot): Date | undefined {
    return slot.weekday === 1 && this.mondaySchedule
      ? slot.onDate(this.mondaySchedule)
      : undefined;
  }
}
