export interface CalendarLinks {
  https: string;
  webcal: string;
  google: string;
  outlook: string;
}

/** Subscription links for the private feed `GET /ical/{token}.ics` of services/api. */
export function calendarLinks(apiUrl: string, token: string): CalendarLinks {
  const https = `${apiUrl.replace(/\/+$/, "")}/ical/${token}.ics`;
  const webcal = https.replace(/^https?:\/\//, "webcal://");
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent("Czyżyk – przedszkole")}`,
  };
}
