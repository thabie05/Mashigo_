export const getSAHolidays = (year) => {
  const holidays = [
    { date: `${year}-01-01`, name: "New Year's Day" },
    { date: `${year}-03-21`, name: "Human Rights Day" },
    { date: `${year}-04-27`, name: "Freedom Day" },
    { date: `${year}-05-01`, name: "Workers' Day" },
    { date: `${year}-06-16`, name: "Youth Day" },
    { date: `${year}-08-09`, name: "National Women's Day" },
    { date: `${year}-09-24`, name: "Heritage Day" },
    { date: `${year}-12-16`, name: "Day of Reconciliation" },
    { date: `${year}-12-25`, name: "Christmas Day" },
    { date: `${year}-12-26`, name: "Day of Goodwill" },
  ];

  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easterSunday = new Date(year, month - 1, day);
  const goodFriday = new Date(easterSunday);
  goodFriday.setDate(easterSunday.getDate() - 2);
  const familyDay = new Date(easterSunday);
  familyDay.setDate(easterSunday.getDate() + 1);

  const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  holidays.push({ date: formatDate(goodFriday), name: "Good Friday" }, { date: formatDate(familyDay), name: "Family Day" });
  return holidays;
};

export const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
